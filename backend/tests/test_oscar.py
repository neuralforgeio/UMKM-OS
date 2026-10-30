"""Test OSCAR v3.3.0 — persona baru + obrolan hidup + jam ramai + restok tajam.

v2.6.0 menjawab keluhan "masih kurang pintar":
  - "owalah"/"gitu ya"/"wkwk" kini maksud obrolan — dibalas reaksi hidup
    (5 varian rotasi harian), bukan template saran;
  - pola jam belanja ("jam paling ramai kapan?") dijawab dari data SQL;
  - saran restok menyebut estimasi hari sampai stok habis + kecepatan
    laku/hari;
  - persona berganti nama: OSCAR (Online Shop Center for Assistance &
    Response) — konsisten di Mode Data & system prompt LLM.
"""

from __future__ import annotations

import pytest

from app.services.assistant import (
    ASSISTANT_FULL_NAME,
    ASSISTANT_NAME,
    INTENTS,
    OBROLAN_VARIAN,
    build_messages,
    build_offline_answer,
    build_system_prompt,
    classify_intent,
    collect_allowed_numbers,
    validate_numbers,
)


def _konteks() -> dict:
    """Konteks kaya v2.6.0: + jam_ramai + kecepatan/hari habis stok."""
    return {
        "outlet": "Warung Bu Ira",
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
            {
                "nama": "Gula Pasir", "stok": 2, "min_stok": 5,
                "saran_restok": 8, "kecepatan_hari": 1.0, "hari_habis": 2.0,
            },
        ],
        "jam_ramai": [
            {"jam": 19, "transaksi": 12},
            {"jam": 12, "transaksi": 8},
        ],
        "prediksi": {"tersedia": True, "engine": "prophet", "mape": 8.4},
        "ml_progress": {
            "hari_data": 9, "hari_pendapatan": 7,
            "gerbang_hari": 28, "gerbang_pendapatan": 14,
            "gerbang_terpenuhi": False,
        },
    }


# ----------------------------------------------------------------------
# Persona OSCAR
# ----------------------------------------------------------------------
def test_persona_oscar() -> None:
    assert ASSISTANT_NAME == "OSCAR"
    assert ASSISTANT_FULL_NAME == "Online Shop Center for Assistance & Response"


def test_intents_baru() -> None:
    assert "obrolan" in INTENTS
    assert "jam_ramai" in INTENTS


def test_identitas_memperkenalkan_nama_lengkap() -> None:
    jawab = build_offline_answer(_konteks(), "identitas", "hari")
    assert "OSCAR" in jawab
    assert "Online Shop Center for Assistance & Response" in jawab


# ----------------------------------------------------------------------
# Obrolan hidup
# ----------------------------------------------------------------------
@pytest.mark.parametrize(
    "tanya",
    ["owalah", "Owalah!", "hadeh", "gitu ya", "wkwk", "yaudah deh",
     "walah", "ya ampun", "anjay"],
)
def test_obrolan_dikenali(tanya: str) -> None:
    assert classify_intent(tanya) == "obrolan"


def test_obrolan_tidak_menelan_terima_kasih() -> None:
    # "nice"/"bagus deh" tetap ucapan terima kasih (tanpa huruf p —
    # kata legacy "p" di _KW_SAPAAN menelan frasa ber-huruf-p).
    assert classify_intent("nice") == "terima_kasih"
    assert classify_intent("bagus deh") == "terima_kasih"


def test_obrolan_kalah_dari_pertanyaan_data() -> None:
    assert classify_intent("owalah, omzet berapa?") == "penjualan"
    assert classify_intent("wkwk stok apa yang menipis") == "stok"


def test_jawaban_obrolan_varian_dan_satunya_saran() -> None:
    jawab = build_offline_answer(_konteks(), "obrolan", "hari")
    assert jawab in OBROLAN_VARIAN
    assert jawab.count("Saran:") == 1
    sah, pelanggar = validate_numbers(
        jawab, collect_allowed_numbers(_konteks())
    )
    assert sah, f"obrolan mengarang angka: {pelanggar}"


def test_obrolan_tanpa_angka_berisiko() -> None:
    # Obrolan murni reaksi — tidak boleh menyebut Rp/persen/angka besar.
    for varian in OBROLAN_VARIAN:
        sah, _ = validate_numbers(varian, [7.0, 30.0])
        assert sah


# ----------------------------------------------------------------------
# Jam ramai
# ----------------------------------------------------------------------
def test_jam_ramai_dikenali() -> None:
    assert classify_intent("jam paling ramai kapan?") == "jam_ramai"
    assert classify_intent("kapan paling ramai?") == "jam_ramai"
    assert classify_intent("jam sibuk jam berapa") == "jam_ramai"


def test_jawaban_jam_ramai_berdata() -> None:
    jawab = build_offline_answer(_konteks(), "jam_ramai", "hari")
    assert "jam 19" in jawab
    assert "12 transaksi" in jawab
    assert "puncaknya jam 19" in jawab
    sah, pelanggar = validate_numbers(
        jawab, collect_allowed_numbers(_konteks())
    )
    assert sah, f"jam ramai mengarang angka: {pelanggar}"


def test_jawaban_jam_ramai_jujur_saat_kosong() -> None:
    k = _konteks()
    k["jam_ramai"] = []
    jawab = build_offline_answer(k, "jam_ramai", "hari")
    assert "belum ada transaksi" in jawab.lower()


def test_angka_jam_ramai_masuk_daftar_sah() -> None:
    allowed = collect_allowed_numbers(_konteks())
    assert 19.0 in allowed
    assert 12.0 in allowed


# ----------------------------------------------------------------------
# Saran restok tajam + prompt kaya
# ----------------------------------------------------------------------
def test_stok_menyebut_estimasi_hari_habis() -> None:
    jawab = build_offline_answer(_konteks(), "stok", "hari")
    assert "Gula Pasir sisa 2" in jawab
    assert "~2 hari lagi" in jawab
    sah, pelanggar = validate_numbers(
        jawab, collect_allowed_numbers(_konteks())
    )
    assert sah, f"stok mengarang angka: {pelanggar}"


def test_saran_menyebut_hari_habis_dan_jam_puncak() -> None:
    jawab = build_offline_answer(_konteks(), "saran_tindakan", "minggu")
    assert "~2 hari lagi" in jawab
    assert "jam 19" in jawab
    sah, pelanggar = validate_numbers(
        jawab, collect_allowed_numbers(_konteks())
    )
    assert sah, f"saran mengarang angka: {pelanggar}"


def test_saran_tren_jujur_menyebut_umur_data() -> None:
    k = _konteks()
    k["perubahan_mingguan_pct"] = None
    jawab = build_offline_answer(k, "saran_tindakan", "minggu")
    assert "belum ada data pembanding" in jawab
    assert "catatan baru berjalan 9 hari" in jawab


def test_prompt_oscar_lengkap() -> None:
    p = build_system_prompt(_konteks())
    assert "OSCAR" in p
    assert "Online Shop Center for Assistance & Response" in p
    assert "Gaya campuran" in p
    assert "RIWAYAT percakapan" in p


def test_prompt_memuat_jam_dan_estimasi_habis() -> None:
    p = build_system_prompt(_konteks())
    assert "jam 19 (12 transaksi)" in p
    assert "Gula Pasir habis sekitar 2 hari lagi" in p
    assert "laku 1/hari" in p


def test_prompt_jujur_tanpa_jam_dan_tanpa_hari_habis() -> None:
    k = _konteks()
    k["jam_ramai"] = []
    k["stok_kritis"] = [
        {"nama": "Gula Pasir", "stok": 2, "min_stok": 5, "saran_restok": 8}
    ]
    p = build_system_prompt(k)
    assert "belum ada data 7 hari terakhir" in p
    assert "tidak terhitung" in p


# ----------------------------------------------------------------------
# Ingatan percakapan (RIWAYAT) — kontrak build_messages
# ----------------------------------------------------------------------
def test_messages_membawa_riwayat_dan_persona() -> None:
    riwayat = [
        {"role": "USER", "content": "omzet hari ini berapa"},
        {"role": "ASSISTANT", "content": "Rp 125.000 dari 5 transaksi."},
        {"role": "USER", "content": "kalau yang murah aja?"},
    ]
    msgs = build_messages(_konteks(), riwayat, "produk paling laku")
    assert [m["role"] for m in msgs] == [
        "system", "USER", "ASSISTANT", "USER", "user",
    ]
    assert "OSCAR" in msgs[0]["content"]
    assert msgs[-1]["content"] == "produk paling laku"


# ----------------------------------------------------------------------
# Kejujuran angka: jawaban maksud baru lolos validasi DATA
# ----------------------------------------------------------------------
@pytest.mark.parametrize("maksud", ["obrolan", "jam_ramai"])
@pytest.mark.parametrize("periode", ["hari", "minggu", "bulan"])
def test_jawaban_baru_lolos_validasi_angka(
    maksud: str, periode: str
) -> None:
    k = _konteks()
    jawab = build_offline_answer(k, maksud, periode)
    sah, pelanggar = validate_numbers(jawab, collect_allowed_numbers(k))
    assert sah, f"maksud={maksud} periode={periode} pelanggar={pelanggar}"
