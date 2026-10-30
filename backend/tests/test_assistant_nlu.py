"""Test NLU v3.2.0 — jawaban Mode Data per-maksud + per-periode.

Regresi keluhan pemilik (screenshot 2026-10-27): "nama mu siapa" dan
"saran minggu depan" sama-sama dibalas template ringkasan penjualan —
kini tiap maksud + periode punya jawaban sendiri, dan SEMUA angka
jawaban tetap lolos validasi DATA (tidak ada yang karangan).
"""

from __future__ import annotations

import pytest

from app.services.assistant import (
    ASSISTANT_NAME,
    build_offline_answer,
    classify_intent,
    collect_allowed_numbers,
    generate_answer,
    validate_numbers,
)


def _konteks() -> dict:
    """Konteks kaya: tren naik, terlaris, stok kritis, model siap."""
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
        "ml_progress": {
            "hari_data": 40, "hari_pendapatan": 20,
            "gerbang_hari": 28, "gerbang_pendapatan": 14,
            "gerbang_terpenuhi": True,
        },
    }


def _konteks_miskin() -> dict:
    """Konteks kosong mirip warung demo: 2 hari ber-omzet, tanpa model."""
    return {
        "outlet": "Warung DearDor",
        "penjualan": {
            "hari_ini": {"omzet": 45000, "transaksi": 3},
            "kemarin": {"omzet": 0, "transaksi": 0},
            "tujuh_hari": {"omzet": 45000, "transaksi": 3},
            "tiga_puluh_hari": {"omzet": 45000, "transaksi": 3},
        },
        "perubahan_mingguan_pct": None,
        "produk_top": [{"nama": "Nasi Goreng Jawa", "qty": 3, "omzet": 45000}],
        "stok_kritis": [],
        "prediksi": {"tersedia": False, "engine": None, "mape": None},
        "ml_progress": {
            "hari_data": 2, "hari_pendapatan": 2,
            "gerbang_hari": 28, "gerbang_pendapatan": 14,
            "gerbang_terpenuhi": False,
        },
    }


# ----------------------------------------------------------------------
# Regresi inti: pertanyaan berbeda -> jawaban BERBEDA
# ----------------------------------------------------------------------
def test_pertanyaan_berbeda_jawaban_berbeda() -> None:
    """Dua pertanyaan keluhan pemilik tidak lagi kembar jawabannya."""
    k = _konteks()
    a = build_offline_answer(k, classify_intent("nama mu siapa"), "hari")
    b = build_offline_answer(k, classify_intent("saran minggu depan"), "minggu")
    assert a != b
    assert ASSISTANT_NAME in a  # identitas memperkenalkan diri
    assert "saran" in b.lower()  # saran memuat saran tindakan


def test_identitas_dijawab_perkenalan() -> None:
    jawab = build_offline_answer(_konteks(), "identitas", "hari")
    assert ASSISTANT_NAME in jawab
    assert "Warung Sari" in jawab
    assert "omzet" in jawab.lower()  # menawarkan contoh pertanyaan data


def test_kemampuan_mendaftar_Contoh() -> None:
    jawab = build_offline_answer(_konteks(), "kemampuan", "hari")
    assert "omzet" in jawab.lower()
    assert "stok" in jawab.lower()
    assert "terlaris" in jawab.lower()


def test_sapaan_menyapa_dan_meringkas_ringan() -> None:
    jawab = build_offline_answer(_konteks(), "sapaan", "hari")
    assert jawab.startswith("Halo")
    assert "Rp 125.000" in jawab


def test_sapaan_tanpa_omzet_hari_ini() -> None:
    jawab = build_offline_answer(_konteks_miskin(), "sapaan", "hari")
    assert "belum ada penjualan" in jawab or "Rp 45.000" in jawab


def test_terima_kasih_dibalas_santun() -> None:
    jawab = build_offline_answer(_konteks(), "terima_kasih", "hari")
    assert "Sama-sama" in jawab


def test_penjualan_hari_fokus_hari_ini() -> None:
    jawab = build_offline_answer(_konteks(), "penjualan", "hari")
    assert "Omzet hari ini Rp 125.000 (5 transaksi)" in jawab
    assert "kemarin Rp 98.000" in jawab
    assert "3100000" not in jawab.replace(".", "")  # 30 hari tidak dicampur


def test_penjualan_minggu_menyebut_tren() -> None:
    jawab = build_offline_answer(_konteks(), "penjualan", "minggu")
    assert "Rp 720.000" in jawab
    assert "naik 12,5%" in jawab


def test_penjualan_bulan_fokus_30_hari() -> None:
    jawab = build_offline_answer(_konteks(), "penjualan", "bulan")
    assert "Rp 3.100.000" in jawab
    assert "Rp 720.000" in jawab  # sepekan sebagai pembanding ringan


def test_produk_mengurutkan_terlaris() -> None:
    jawab = build_offline_answer(_konteks(), "produk", "minggu")
    assert "Kopi Susu 12x" in jawab
    assert "Teh Panas 9x" in jawab


def test_stok_menyebut_sisa_dan_restok() -> None:
    jawab = build_offline_answer(_konteks(), "stok", "hari")
    assert "Gula Pasir sisa 2 (minimum 5)" in jawab
    assert "Gula Pasir +8" in jawab


def test_prediksi_model_siap() -> None:
    jawab = build_offline_answer(_konteks(), "prediksi", "minggu")
    assert "model terlatih" in jawab
    assert "prophet" in jawab
    assert "MAPE 8,4%" in jawab


def test_prediksi_model_belum_siap_jelaskan_gerbang_otomatis() -> None:
    """Konteks miskin: jawaban menjelaskan kemajuan + auto-train jujur."""
    jawab = build_offline_answer(_konteks_miskin(), "prediksi", "minggu")
    assert "14" in jawab          # gerbang hari ber-pendapatan
    assert "2 hari" in jawab      # kemajuan saat ini
    assert "OTOMATIS" in jawab    # auto-train latar belakang
    assert "statistik" in jawab.lower()  # ramalan tetap tersedia


def test_prediksi_tanpa_ml_progress_tetap_hidup() -> None:
    k = _konteks()
    k.pop("ml_progress")
    k["prediksi"] = {"tersedia": False, "engine": None, "mape": None}
    jawab = build_offline_answer(k, "prediksi", "minggu")
    assert "statistik" in jawab.lower()
    assert "otomatis" in jawab.lower()


def test_saran_minggu_berisi_bahan_keputusan() -> None:
    jawab = build_offline_answer(_konteks(), "saran_tindakan", "minggu")
    assert "naik 12,5%" in jawab              # tren
    assert "Kopi Susu" in jawab               # andalan
    assert "Gula Pasir +8" in jawab           # prioritas restok
    assert "Saran" in jawab                   # aksi konkret penutup


def test_saran_konteks_miskin_tetap_berguna() -> None:
    jawab = build_offline_answer(_konteks_miskin(), "saran_tindakan", "minggu")
    assert "Nasi Goreng Jawa" in jawab
    assert "terlatih otomatis" in jawab  # menjelaskan gerbang secara positif


# ----------------------------------------------------------------------
# Kejujuran angka: semua jawaban per-maksud lolos validasi DATA
# ----------------------------------------------------------------------
@pytest.mark.parametrize(
    "maksud",
    [
        "identitas", "kemampuan", "sapaan", "terima_kasih",
        "penjualan", "produk", "stok", "prediksi", "saran_tindakan",
        "ringkasan",
    ],
)
@pytest.mark.parametrize("periode", ["hari", "minggu", "bulan"])
def test_semua_jawaban_lolos_validasi_angka(maksud: str, periode: str) -> None:
    k = _konteks()
    jawab = build_offline_answer(k, maksud if maksud != "ringkasan" else None,
                                 periode)
    sah, pelanggar = validate_numbers(jawab, collect_allowed_numbers(k))
    assert sah, f"maksud={maksud} periode={periode} pelanggar={pelanggar}"


@pytest.mark.parametrize(
    "maksud",
    ["identitas", "kemampuan", "sapaan", "penjualan", "produk", "stok",
     "prediksi", "saran_tindakan"],
)
def test_jawaban_within_batas_kata(maksud: str) -> None:
    from app.services.assistant import MAX_ANSWER_WORDS

    jawab = build_offline_answer(_konteks(), maksud, "minggu")
    assert len(jawab.split()) <= MAX_ANSWER_WORDS


# ----------------------------------------------------------------------
# Jalur generate_answer offline membawa maksud yang benar
# ----------------------------------------------------------------------
def test_generate_answer_offline_per_maksud() -> None:
    import asyncio

    hasil = asyncio.run(
        generate_answer("nama mu siapa", _konteks(), [], None)
    )
    assert hasil["mode"] == "data"
    assert hasil["intent"] == "identitas"
    assert ASSISTANT_NAME in hasil["answer"]


def test_generate_answer_offline_saran_minggu_depan() -> None:
    import asyncio

    hasil = asyncio.run(
        generate_answer("saran minggu depan", _konteks(), [], None)
    )
    assert hasil["intent"] == "saran_tindakan"
    assert hasil["period"] == "minggu"
    assert "naik 12,5%" in hasil["answer"]


def test_fuzzy_typo_tetap_terdeteksi() -> None:
    """Typo ringan ("nam" untuk "nama") tidak membuat asisten bingung."""
    assert classify_intent("siapa nam kamu") == "identitas"
