"""Unit test otak asisten + batas laju + cache (ml-service v3.2.0).

Semua murni: tanpa DB, tanpa jaringan, tanpa LLM asli. Angka format
Indonesia dipatok eksplisit supaya parser tidak diam-diam berubah.
Jawaban Mode Data per-maksud diuji lebih lanjut di test_assistant_nlu.py.
"""

from __future__ import annotations

import pytest

from app.services.answer_cache import AnswerCache, normalize_question
from app.services.assistant import (
    HISTORY_TURNS,
    MAX_ANSWER_WORDS,
    build_messages,
    build_offline_answer,
    build_retry_instruction,
    build_system_prompt,
    classify_intent,
    collect_allowed_numbers,
    extract_numbers,
    extract_period,
    format_rupiah_id,
    normalize_text,
    parse_number_id,
    validate_numbers,
)
from app.services.rate_limit import SlidingWindowLimiter


def _konteks() -> dict:
    """Konteks contoh stabil untuk semua test di file ini."""
    return {
        "outlet": "Warung Sari",
        "penjualan": {
            "hari_ini": {"omzet": 125000, "transaksi": 5},
            "kemarin": {"omzet": 98000, "transaksi": 4},
            "tujuh_hari": {"omzet": 720000, "transaksi": 31},
            "tiga_puluh_hari": {"omzet": 3100000, "transaksi": 133},
        },
        "perubahan_mingguan_pct": 12.5,
        "produk_top": [
            {"nama": "Kopi Susu", "qty": 12, "omzet": 60000},
            {"nama": "Teh Panas", "qty": 9, "omzet": 27000},
        ],
        "stok_kritis": [
            {"nama": "Gula Pasir", "stok": 2, "min_stok": 5, "saran_restok": 8},
        ],
        "prediksi": {"tersedia": True, "engine": "prophet", "mape": 8.4},
    }


# ----------------------------------------------------------------------
# classify_intent / extract_period
# ----------------------------------------------------------------------
@pytest.mark.parametrize(
    ("tanya", "maksud"),
    [
        ("Berapa omzet hari ini?", "penjualan"),
        ("pendapatan 7 hari terakhir", "penjualan"),
        ("Stok apa yang menipis?", "stok"),
        ("sisa gula berapa", "stok"),
        ("Produk mana yang paling laku?", "produk"),
        ("terlaris minggu ini apa", "produk"),
        ("Kasih saran dong", "saran_tindakan"),
        ("Apa yang harus saya lakukan?", "saran_tindakan"),
        # v3.2.0: basa-basi & identitas kini maksud tersendiri.
        ("halo", "sapaan"),
        ("Nama mu siapa?", "identitas"),
        ("siapa kamu?", "identitas"),
        ("kamu bisa apa?", "kemampuan"),
        ("makasih ya", "terima_kasih"),
        ("berapa omzet besok", "prediksi"),
        ("ramalan minggu depan gimana?", "prediksi"),
        # saran tetap menang atas penanda masa depan.
        ("saran minggu depan", "saran_tindakan"),
        ("gimana ya?", "saran_tindakan"),
    ],
)
def test_classify_intent(tanya: str, maksud: str) -> None:
    assert classify_intent(tanya) == maksud


@pytest.mark.parametrize(
    ("tanya", "periode"),
    [
        ("omzet hari ini", "hari"),
        ("penjualan kemarin", "hari"),
        ("omzet minggu ini", "minggu"),
        ("7 hari terakhir", "minggu"),
        ("penjualan bulan ini", "bulan"),
        ("sebulan terakhir", "bulan"),
        ("omzet", "hari"),
        # v3.2.0: singkatan ikut ternormalisasi sebelum ekstraksi.
        ("saran minggu dpn", "minggu"),
        ("omzet bln lalu", "bulan"),
    ],
)
def test_extract_period(tanya: str, periode: str) -> None:
    assert extract_period(tanya) == periode


def test_intent_stok_menang_atas_penjualan() -> None:
    # "stok" lebih spesifik daripada "penjualan" dalam satu kalimat.
    assert classify_intent("stok menipis, penjualan gimana?") == "stok"


def test_intent_data_menang_atas_basa_basi() -> None:
    # "halo, omzet berapa?" tetap dijawab DATA, bukan sekadar balas sapaan.
    assert classify_intent("halo, omzet berapa?") == "penjualan"


def test_intent_identitas_tidak_jatuh_ke_default() -> None:
    # regresi keluhan pemilik: "nama mu siapa" dulu dibalas ringkasan
    # penjualan template; kini maksud identitas yang dijawab.
    assert classify_intent("nama mu siapa") == "identitas"
    assert classify_intent("siapa nama kamu?") == "identitas"


def test_intent_masa_depan_memindah_ke_prediksi() -> None:
    assert classify_intent("berapa omzet besok?") == "prediksi"
    assert classify_intent("omzet minggu depan berapa") == "prediksi"


# ----------------------------------------------------------------------
# normalize_text (v3.2.0)
# ----------------------------------------------------------------------
@pytest.mark.parametrize(
    ("mentah", "bersih"),
    [
        ("Nama mu siapa??", "nama kamu siapa"),
        ("omzet gmn?", "omzet gimana"),
        ("saran minggu dpn dong", "saran minggu depan dong"),
        ("brp omzet skrg", "berapa omzet sekarang"),
        ("namamu siapa", "nama kamu siapa"),
        ("  Omzet   HARI ini?!  ", "omzet hari ini"),
    ],
)
def test_normalize_text(mentah: str, bersih: str) -> None:
    assert normalize_text(mentah) == bersih


# ----------------------------------------------------------------------
# parse_number_id / extract_numbers
# ----------------------------------------------------------------------
@pytest.mark.parametrize(
    ("token", "nilai"),
    [
        ("1.250.000", 1250000.0),
        ("12,5", 12.5),
        ("1.250.000,50", 1250000.5),
        ("1,250,000", 1250000.0),
        ("1.25", 1.25),
        ("250", 250.0),
    ],
)
def test_parse_number_id(token: str, nilai: float) -> None:
    assert parse_number_id(token) == nilai


def test_parse_number_id_gagal() -> None:
    assert parse_number_id("") is None
    assert parse_number_id("abc") is None


def test_extract_numbers_rp_dan_satuan() -> None:
    hasil = extract_numbers("Omzet Rp 1.250.000 dan Rp 250rb, naik 12,5%")
    nilai = [h[0] for h in hasil]
    assert 1250000.0 in nilai
    assert 250000.0 in nilai
    assert 12.5 in nilai


def test_extract_numbers_juta_desimal() -> None:
    assert extract_numbers("sekitar 1,5 juta")[0][0] == 1500000.0


def test_extract_numbers_tahun_dilewati() -> None:
    nilai = [h[0] for h in extract_numbers("tahun 2026 ramai")]
    assert 2026.0 not in nilai


def test_extract_numbers_angka_kecil_tetap_diambil() -> None:
    # angka kecil non-tahun dilaporkan (penanda rp/persen menentukan
    # validitasnya nanti), kecuali tahun.
    nilai = [h[0] for h in extract_numbers("sisa 2 kg")]
    assert 2.0 in nilai


# ----------------------------------------------------------------------
# validate_numbers
# ----------------------------------------------------------------------
def _allowed() -> list[float]:
    return collect_allowed_numbers(_konteks())


def test_validasi_eksak() -> None:
    sah, pelanggar = validate_numbers("Omzet Rp 125.000", _allowed())
    assert sah and not pelanggar


def test_validasi_toleransi_2_persen() -> None:
    # 126.500 vs 125.000 = 1,2% — masih jujur bagi manusia.
    sah, _ = validate_numbers("Omzet Rp 126.500", _allowed())
    assert sah


def test_validasi_pembulatan_grid() -> None:
    # 720.000 dibulatkan ke 750.000 (GRID 50.000, selisih 4,2%) —
    # MELEBIHI 2,5% => tetap tertolak. Yang sah: 700.000 (GRID 100.000,
    # selisih 2,8%? juga tolak). Eksperimen menunjukkan batas ketat.
    sah_tolak, _ = validate_numbers("7 hari Rp 750.000", _allowed())
    assert not sah_tolak


def test_validasi_pembulatan_dalam_batas() -> None:
    # 3.100.000 eksak di DATA => sah.
    sah, _ = validate_numbers("30 hari Rp 3.100.000", _allowed())
    assert sah


def test_validasi_pembulatan_1250_untuk_1252() -> None:
    # 1.252.340 -> "Rp 1.250.000" (GRID 5.000, selisih 0,19%) — sah.
    sah, _ = validate_numbers("Rp 1.250.000", [1252340.0])
    assert sah


def test_validasi_halusinasi_ditolak() -> None:
    sah, pelanggar = validate_numbers("Omzet Rp 999.999.999", _allowed())
    assert not sah and 999999999.0 in pelanggar


def test_validasi_persen_hanya_diadu_angka_kecil() -> None:
    # "45%" tidak ada di DATA (yang ada 12,5) => tolak.
    sah, _ = validate_numbers("naik 45%", _allowed())
    assert not sah
    # "12,5%" ada => sah.
    sah, _ = validate_numbers("naik 12,5%", _allowed())
    assert sah


def test_validasi_rp_tidak_lolos_lewat_angka_kecil() -> None:
    # "Rp 25" tidak boleh sah hanya karena ada stok/min_stok 25.
    sah, _ = validate_numbers("Rp 25", [25.0])
    assert not sah


def test_instruksi_retry_menyebut_angka_mencurigakan() -> None:
    teks = build_retry_instruction([999999999.0])
    assert "999.999.999" in teks
    assert "DATA" in teks


# ----------------------------------------------------------------------
# format_rupiah_id / collect_allowed_numbers
# ----------------------------------------------------------------------
def test_format_rupiah_id() -> None:
    assert format_rupiah_id(1250000) == "1.250.000"
    assert format_rupiah_id(0) == "0"
    assert format_rupiah_id(-98000) == "-98.000"


def test_collect_allowed_numbers_mengandung_data_kunci() -> None:
    nilai = collect_allowed_numbers(_konteks())
    for angka in (125000.0, 98000.0, 720000.0, 3100000.0, 12.5, 8.4, 2.0, 5.0,
                  8.0, 12.0, 60000.0, 27000.0, 9.0, 31.0, 133.0, 4.0):
        assert angka in nilai


def test_collect_allowed_numbers_buang_boolean() -> None:
    nilai = collect_allowed_numbers({"prediksi": {"tersedia": True, "mape": 8.4}})
    assert True not in nilai
    assert 8.4 in nilai


# ----------------------------------------------------------------------
# Prompt & pesan
# ----------------------------------------------------------------------
def test_system_prompt_aturan_blueprint() -> None:
    prompt = build_system_prompt(_konteks())
    assert "HANYA dari DATA" in prompt
    assert f"Maksimal {MAX_ANSWER_WORDS} kata" in prompt
    assert "1 saran tindakan" in prompt
    assert "Warung Sari" in prompt
    assert "Rp 125.000 (5 transaksi)" in prompt
    assert "Kopi Susu" in prompt
    assert "Gula Pasir" in prompt


def test_system_prompt_tren_format_indonesia() -> None:
    assert "naik 12,5%" in build_system_prompt(_konteks())


def test_build_messages_bentuk_dan_riwayat() -> None:
    riwayat = [
        {"role": "USER", "content": "halo"},
        {"role": "ASSISTANT", "content": "hai"},
    ]
    pesan = build_messages(_konteks(), riwayat, "omzet?")
    assert pesan[0]["role"] == "system"
    assert pesan[-1] == {"role": "user", "content": "omzet?"}
    assert pesan[1] == {"role": "USER", "content": "halo"}


def test_build_messages_potong_riwayat_maks_5() -> None:
    riwayat = [
        {"role": "USER", "content": str(i)} for i in range(10)
    ]
    pesan = build_messages(_konteks(), riwayat, "tes")
    assert len(pesan) == 1 + HISTORY_TURNS + 1
    assert pesan[1]["content"] == "5"  # 5 terakhir mulai dari indeks 5


# ----------------------------------------------------------------------
# Mode Data offline
# ----------------------------------------------------------------------
def test_offline_answer_angka_dari_data() -> None:
    jawab = build_offline_answer(_konteks())
    assert "Rp 125.000" in jawab
    assert "Rp 720.000" in jawab
    assert "Kopi Susu" in jawab
    assert "Gula Pasir" in jawab
    sah, _ = validate_numbers(jawab, _allowed())
    assert sah  # template tidak pernah berangka karangan


def test_offline_answer_saran_restok() -> None:
    assert "restok Gula Pasir +8" in build_offline_answer(_konteks())


def test_offline_answer_tanpa_stok_kritis() -> None:
    konteks = _konteks()
    konteks["stok_kritis"] = []
    assert "rotasi" in build_offline_answer(konteks)


# ----------------------------------------------------------------------
# Batas laju sliding window
# ----------------------------------------------------------------------
def test_limiter_izinkan_di_bawah_batas() -> None:
    lim = SlidingWindowLimiter(limit=3, window_seconds=100)
    assert all(lim.allow("u1", now=1000.0 + i) for i in range(3))


def test_limiter_tolak_setelah_batas() -> None:
    lim = SlidingWindowLimiter(limit=3, window_seconds=100)
    for i in range(3):
        lim.allow("u1", now=1000.0 + i)
    assert not lim.allow("u1", now=1003.0)


def test_limiter_jendela_bergesar() -> None:
    lim = SlidingWindowLimiter(limit=2, window_seconds=100)
    lim.allow("u1", now=1000.0)
    lim.allow("u1", now=1010.0)
    assert not lim.allow("u1", now=1020.0)
    # kejadian pertama sudah keluar jendela di t=1101.
    assert lim.allow("u1", now=1101.0)


def test_limiter_per_kunci_terpisah() -> None:
    lim = SlidingWindowLimiter(limit=1, window_seconds=100)
    assert lim.allow("a", now=1000.0)
    assert lim.allow("b", now=1000.0)
    assert not lim.allow("a", now=1000.5)


def test_limiter_retry_after() -> None:
    lim = SlidingWindowLimiter(limit=1, window_seconds=100)
    lim.allow("u", now=1000.0)
    assert 0 < lim.retry_after_seconds("u", now=1050.0) <= 50


# ----------------------------------------------------------------------
# Cache jawaban
# ----------------------------------------------------------------------
def test_cache_roundtrip_dan_ttl() -> None:
    cache = AnswerCache(ttl_seconds=100)
    cache.put(1, "2", "Omzet hari ini?", "jawaban", now=1000.0)
    assert cache.get(1, "2", "Omzet hari ini?", now=1050.0) == "jawaban"
    assert cache.get(1, "2", "Omzet hari ini?", now=1200.0) is None


def test_cache_normalisasi_pertanyaan() -> None:
    cache = AnswerCache(ttl_seconds=100)
    cache.put(1, "2", "  Omzet hari ini?  ", "j", now=1000.0)
    assert cache.get(1, "2", "omzet hari ini", now=1000.0) == "j"


def test_cache_kunci_user_outlet_berbeda() -> None:
    cache = AnswerCache(ttl_seconds=100)
    cache.put(1, "2", "omzet", "a", now=1000.0)
    assert cache.get(9, "2", "omzet", now=1000.0) is None
    assert cache.get(1, "7", "omzet", now=1000.0) is None


def test_normalize_question_melipat_spasi_tanda_baca() -> None:
    assert normalize_question("  Omzet   HARI ini?!  ") == "omzet hari ini"


def test_cache_buang_tertua_saat_penuh() -> None:
    cache = AnswerCache(ttl_seconds=100, max_entries=2)
    cache.put(1, "1", "a", "satu", now=1000.0)
    cache.put(1, "1", "b", "dua", now=1001.0)
    cache.put(1, "1", "c", "tiga", now=1002.0)  # "a" terlempar
    assert cache.get(1, "1", "a", now=1002.0) is None
    assert cache.get(1, "1", "c", now=1002.0) == "tiga"
