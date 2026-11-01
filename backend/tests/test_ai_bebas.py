"""Test "AI Bebas" (ml-service v3.6.0 / produk v1.2.0).

Keluhan pemilik (tangkapan layar nyata): OSCAR menolak pertanyaan
mudah seperti "berapa satu tambah satu" dan "5 tambah 5" dengan alasan
"data tidak mengandung informasi tentang operasi matematika sederhana"
lalu jawabannya ditandai "tidak lolos validasi data". Pemilik benar:
model AI-nya model bebas (gpt-oss-20b via Groq), bukan AI buatan kita
— ia harus bisa menjawab BERBAGAI HAL, dengan data warung sebagai
TAMBAHAN konteks, bukan penjara.

Akar yang dikunci di sini:
  * maksud "umum" sebagai default klasifikasi (pertanyaan bebas tidak
    lagi dipaksa jadi saran data);
  * sapaan singkat "p"/"hi" ber-spasi pengaman (dulu "p" polos menelan
    semua frasa ber-huruf-p: "berapa", "apa"; "hi" polos menelan kata
    "HITUNG") sehingga "berapa satu tambah satu" salah dianggap sapaan;
  * system prompt DWI-MODE: pertanyaan bebas -> pengetahuan umum model
    (DILARANG menolak dengan alasan data), pertanyaan bisnis warung ->
    wajib berbasis DATA (DILARANG mengarang angka warung);
  * tanggal hari ini disuntik ke prompt + DATA selalu segar per
    pertanyaan (cara OSCAR "membaca data terbaru" tanpa dilatih ulang);
  * validate_numbers HANYA untuk INTENT_BERDATA — angka jawaban umum
    ("5 tambah 5 = 10, naik 100%") bukan klaim data warung.

Semua murni: tanpa DB, tanpa jaringan, tanpa LLM asli.
"""

from __future__ import annotations

import asyncio
from datetime import date
from pathlib import Path

import pytest

from app.services.assistant import (
    INTENT_BERDATA,
    MAX_ANSWER_WORDS,
    MAX_ANSWER_WORDS_UMUM,
    MAX_TOKENS,
    build_system_prompt,
    classify_intent,
    generate_answer,
    tanggal_hari_ini,
)

ROOT_BACKEND = Path(__file__).resolve().parents[1]


def _konteks() -> dict:
    return {
        "outlet": "Warung Sari",
        "penjualan": {
            "hari_ini": {"omzet": 125000, "transaksi": 5},
            "kemarin": {"omzet": 98000, "transaksi": 4},
            "tujuh_hari": {"omzet": 720000, "transaksi": 31},
            "tiga_puluh_hari": {"omzet": 3100000, "transaksi": 133},
        },
        "perubahan_mingguan_pct": 12.5,
        "produk_top": [{"nama": "Kopi Susu", "qty": 12, "omzet": 60000}],
        "stok_kritis": [
            {"nama": "Gula Pasir", "stok": 2, "min_stok": 5, "saran_restok": 8},
        ],
        "prediksi": {"tersedia": True, "engine": "prophet", "mape": 8.4},
    }


# ----------------------------------------------------------------------
# 1) Pertanyaan bebas -> maksud "umum" (default baru)
# ----------------------------------------------------------------------
@pytest.mark.parametrize(
    "tanya",
    [
        "berapa satu tambah satu",
        "5 tambah 5",
        "berapa 1 tambah 1?",
        "apa ibu kota Indonesia?",
        "hitung diskon 20 persen dari 50000",
        "gimana ya?",
        "resep rendang enak dong",
        "kenapa langit biru",
    ],
)
def test_pertanyaan_bebas_jadi_maksud_umum(tanya: str) -> None:
    assert classify_intent(tanya) == "umum"


def test_pertanyaan_bisnis_tetap_maksud_data() -> None:
    """Arah berlawanan: pertanyaan bisnis TIDAK ikut longgar."""
    assert classify_intent("berapa omzet hari ini?") == "penjualan"
    assert classify_intent("stok apa yang menipis?") == "stok"
    assert classify_intent("produk terlaris minggu ini apa?") == "produk"
    assert classify_intent("berapa omzet besok?") == "prediksi"
    assert classify_intent("kasih saran dong") == "saran_tindakan"
    assert classify_intent("jam paling ramai kapan?") == "jam_ramai"


def test_intent_berdata_isinya_tepat() -> None:
    """Validasi angka hanya berlaku untuk keenam maksud bisnis ini."""
    assert INTENT_BERDATA == frozenset({
        "penjualan", "stok", "produk", "prediksi", "saran_tindakan",
        "jam_ramai",
    })
    assert "umum" not in INTENT_BERDATA
    assert "sapaan" not in INTENT_BERDATA
    assert "obrolan" not in INTENT_BERDATA


# ----------------------------------------------------------------------
# 2) Sapaan singkat: "p"/"hi" hanya berdiri sendiri (regresi v3.6.0)
# ----------------------------------------------------------------------
@pytest.mark.parametrize("tanya", ["p", "P", "hi", "HI", "pagi", "woi"])
def test_sapaan_tunggal_dikenali(tanya: str) -> None:
    assert classify_intent(tanya) == "sapaan"


@pytest.mark.parametrize(
    "tanya",
    [
        "berapa satu tambah satu",
        "apa ibu kota jepang",
        "hitung diskon 20 persen",
        "berapa harga laptop sekarang",   # dulu "top" polos menelan LAPTOP
        "kapasitas penyimpanan berapa",
    ],
)
def test_huruf_dalam_kata_bukan_sapaan(tanya: str) -> None:
    """Dulu keyword "p"/"hi"/"top" polos menelan kata yang memuat huruf
    itu ("beraPa", "HITUNG", "lapTOP") — pertanyaan bebas lalu salah
    dianggap basa-basi sapaan/terima kasih."""
    assert classify_intent(tanya) == "umum"


# ----------------------------------------------------------------------
# 3) System prompt dwi-mode "AI Bebas"
# ----------------------------------------------------------------------
def test_prompt_dwi_mode_bebas_dan_bisnis() -> None:
    p = build_system_prompt(_konteks())
    # Sisi BEBAS: pengetahuan umum + larangan menolak dengan alasan data.
    assert "PENGETAHUAN UMUM" in p
    assert "PERTANYAAN BEBAS" in p
    assert "DILARANG menolak" in p
    # Sisi BISNIS: tetap wajib berbasis DATA, dilarang mengarang.
    assert "PERTANYAAN BISNIS WARUNG" in p
    assert "DILARANG mengarang" in p
    # Aturan matematika: hitungan dikerjakan sendiri, bukan ditolak.
    assert "Hitungan matematika" in p


def test_prompt_tanpa_aturan_penjara_lama() -> None:
    """Akal keluhan pemilik: aturan lama "Jawab HANYA dari DATA" membuat
    gpt-oss menolak "berapa satu tambah satu" secara literal."""
    p = build_system_prompt(_konteks())
    assert "Jawab HANYA dari DATA" not in p
    # Frasa "HANYA dari DATA" boleh ada HANYA untuk kalimat data bisnis,
    # bukan larangan menyentuh pengetahuan umum.
    assert "HANYA boleh membahas data milik toko" in p  # privasi tetap


def test_prompt_batas_kata_dua_mode() -> None:
    p = build_system_prompt(_konteks())
    assert f"Maksimal {MAX_ANSWER_WORDS} kata" in p       # bisnis: ringkas
    assert f"{MAX_ANSWER_WORDS_UMUM} kata" in p           # bebas: lega
    assert MAX_ANSWER_WORDS_UMUM > MAX_ANSWER_WORDS


def test_prompt_memuat_tanggal_hari_ini() -> None:
    """Tanggal segar disuntik — DATA diambil langsung dari database per
    pertanyaan (inilah cara OSCAR "membaca data terbaru" setiap saat)."""
    p = build_system_prompt(_konteks())
    assert "Hari ini " in p
    assert "LANGSUNG dari database" in p
    today = date.today()
    assert f"{today.day} " in p


@pytest.mark.parametrize(
    ("hari", "teks"),
    [
        (date(2026, 11, 1), "Minggu, 1 November 2026"),
        (date(2026, 11, 2), "Senin, 2 November 2026"),
        (date(2024, 2, 29), "Kamis, 29 Februari 2024"),
        (date(2025, 12, 25), "Kamis, 25 Desember 2025"),
    ],
)
def test_tanggal_hari_ini_deterministik(hari: date, teks: str) -> None:
    assert tanggal_hari_ini(hari) == teks


def test_max_token_naik_untuk_jawaban_umum() -> None:
    """400 token memotong jawaban pengetahuan umum; 700 memberi ruang
    (klien tetap menaikkan sendiri ke >= 1500 untuk gpt-oss)."""
    assert MAX_TOKENS == 700


# ----------------------------------------------------------------------
# 4) generate_answer: validasi angka hanya untuk pertanyaan bisnis
# ----------------------------------------------------------------------
class StubLlm:
    def __init__(self, jawaban: list[str]) -> None:
        self._antre = list(jawaban)
        self.panggilan: list[tuple[list[dict], float, int]] = []

    async def complete(self, messages, temperature=0.2, max_tokens=700):
        self.panggilan.append((messages, temperature, max_tokens))
        return self._antre.pop(0)


def test_jawaban_umum_berangka_tidak_divalidasi() -> None:
    """Jawaban "5 tambah 5 = 10 (naik 100%)" memuat angka berisiko (100%,
    Rp 999.999) yang TIDAK ada di DATA — untuk pertanyaan umum itu wajar
    (hitungan/pengetahuan), jadi TIDAK di-retry dan TIDAK ditandai."""
    stub = StubLlm([
        "5 tambah 5 = 10, dua kali lipat (naik 100%). Bayangkan saja "
        "Rp 999.999 — tetap hitungan, bukan data warung."
    ])
    hasil = asyncio.run(
        generate_answer("5 tambah 5?", _konteks(), [], stub)
    )
    assert hasil["numbers_validated"] is True
    assert hasil["retried"] is False
    assert len(stub.panggilan) == 1


def test_jawaban_umum_tidak_dicap_gagal_validasi() -> None:
    """Skenario persis tangkapan layar pemilik: dulu jawaban 5+5 yang
    menyertut persentase ditandai gagal validasi lalu frontend
    menampilkan peringatan 'cek dashboard dulu' — tampak bodoh."""
    stub = StubLlm(["Jawabannya 10. Kalau dibanding 5 ya naik 100%."])
    hasil = asyncio.run(
        generate_answer("berapa 5 tambah 5", _konteks(), [], stub)
    )
    assert hasil["numbers_validated"] is True


def test_penjaga_sumber_validasi_terbatas() -> None:
    """Penjaga file: gerbang validasi di generate_answer benar-benar
    memakai INTENT_BERDATA (bukan memvalidasi semua jawaban lagi)."""
    layanan = (
        ROOT_BACKEND / "app" / "services" / "assistant.py"
    ).read_text(encoding="utf-8")
    assert "if intent in INTENT_BERDATA:" in layanan
    assert "INTENT_BERDATA = frozenset(" in layanan


def test_prompt_dipakai_build_messages_bawa_pengetahuan_umum() -> None:
    """Integrasi: pesan system yang sampai ke penyedia memuat dwi-mode —
    bukti ujung-ke-ujung bahwa LLM menerima aturan AI Bebas."""
    from app.services.assistant import build_messages

    pesan = build_messages(_konteks(), [], "berapa satu tambah satu?")
    sistem = pesan[0]["content"]
    assert pesan[-1]["content"] == "berapa satu tambah satu?"
    assert "PENGETAHUAN UMUM" in sistem
    assert "DILARANG menolak" in sistem
