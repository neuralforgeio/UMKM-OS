"""Test mode AI murni (ml-service v3.5.0) - Mode Data dimatikan v1.1.0.

Permintaan pemilik: "AI nya menggunakan groq console saja, tidak
menggunakan AI sendiri, dan matikan AI buatan sendiri." Yang dikunci:

  * generate_answer tanpa LLM melempar ModeAiNonaktif (bukan template);
  * pesan_galat_http menerjemahkan status penyedia ke bahasa pemilik
    (401 kunci, 403 hak, 429 batas laju, 5xx bermasalah, potongan
    tubuh respons ikut disertakan);
  * klien LLM menolak isi jawaban kosong dari model reasoning;
  * jalur chat TIDAK lagi jatuh ke build_offline_answer: rute menolak
    jujur 503 bila LLM tidak aktif dan 502 bila penyedia gagal
    (penjaga file, pola penjaga vitest frontend).

Semua murni: tanpa DB, tanpa jaringan, tanpa LLM asli.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from app.services.assistant import ModeAiNonaktif, generate_answer
from app.services.llm import pesan_galat_http

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
        "stok_kritis": [],
        "prediksi": {"tersedia": False, "engine": None, "mape": None},
    }


# ----------------------------------------------------------------------
# generate_answer tanpa LLM => menolak, bukan template
# ----------------------------------------------------------------------
def test_tanpa_llm_melempar_mode_ai_nonaktif() -> None:
    with pytest.raises(ModeAiNonaktif):
        asyncio.run(generate_answer("omzet hari ini?", _konteks(), [], None))


def test_pesan_mode_ai_nonaktif_menyebut_jalur_pengaturan() -> None:
    exc = ModeAiNonaktif(
        "Mode AI tidak aktif: OSCAR hanya menjawab lewat AI (Groq). "
        "Periksa Pengaturan -> Asisten AI lalu coba lagi."
    )
    teks = str(exc)
    assert "Mode AI" in teks
    assert "Groq" in teks
    assert "Pengaturan" in teks


# ----------------------------------------------------------------------
# pesan_galat_http: status penyedia -> bahasa pemilik
# ----------------------------------------------------------------------
@pytest.mark.parametrize(
    ("status", "kata_kunci"),
    [
        (401, "kunci API ditolak"),
        (401, "console.groq.com/keys"),
        (403, "tidak berhak"),
        (429, "batas laju"),
        (500, "bermasalah"),
        (503, "bermasalah"),
    ],
)
def test_pesan_galat_http_per_status(status: int, kata_kunci: str) -> None:
    pesan = pesan_galat_http(
        status, '{"error":{"message":"api key invalid"}}')
    assert str(status) in pesan
    assert kata_kunci in pesan


def test_pesan_galat_http_menyertakan_potongan_tubuh() -> None:
    pesan = pesan_galat_http(400, '{"error":{"message":"model_not_found"}}')
    assert "model_not_found" in pesan


def test_pesan_galat_http_tubuh_kosong_tetap_jelas() -> None:
    assert pesan_galat_http(400, "") == "LLM menolak (HTTP 400)."
    assert pesan_galat_http(418, "   ") == "LLM menolak (HTTP 418)."


def test_pesan_galat_http_memotong_tubuh_panjang() -> None:
    pesan = pesan_galat_http(400, "x" * 500)
    assert len(pesan) < 220  # potongan 160 + kerangka kalimat


# ----------------------------------------------------------------------
# Penjaga file: rute murni AI, klien menolak jawaban kosong
# ----------------------------------------------------------------------
def test_rute_chat_murni_ai_tanpa_jatuh_ke_mode_data() -> None:
    """Rute TIDAK memanggil build_offline_answer lagi dan menolak jujur
    503 (AI belum aktif) serta 502 (penyedia gagal)."""
    rute = (ROOT_BACKEND / "app" / "api" / "routes" / "assistant.py").read_text(
        encoding="utf-8")
    assert "build_offline_answer" not in rute
    assert "status_code=503" in rute
    assert "status_code=502" in rute
    assert "ModeAiNonaktif" in rute


def test_klien_llm_menolak_jawaban_kosong() -> None:
    """Isi kosong dari model reasoning dianggap kegagalan (LlmError),
    bukan jawaban kosong yang dikirim ke pemilik."""
    klien = (ROOT_BACKEND / "app" / "services" / "llm.py").read_text(
        encoding="utf-8")
    assert "jawaban kosong" in klien
    assert "pesan_galat_http" in klien


# ----------------------------------------------------------------------
# v1.1.1: peran pesan HURUF KECIL di batas penyedia (bug obrolan kedua)
# Gejala nyata di web pemilik: pesan pertama sebuah sesi terjawab, pesan
# berikutnya selalu 502 "LLM mengembalikan HTTP 400 ... discriminator
# property 'role' has invalid value" - riwayat database berperan huruf
# besar (USER/ASSISTANT) diteruskan apa adanya ke Groq.
# ----------------------------------------------------------------------
def test_build_messages_menormalkan_peran_huruf_besar() -> None:
    from app.services.assistant import build_messages

    pesan = build_messages(
        _konteks(),
        [
            {"role": "USER", "content": "halo"},
            {"role": "ASSISTANT", "content": "hai"},
        ],
        "lanjut",
    )
    assert [m["role"] for m in pesan] == [
        "system", "user", "assistant", "user",
    ]


def test_normalisasi_pesan_lapisan_transport() -> None:
    """Klien menormalkan barisan pesan dari pemanggil mana pun: peran
    diturunkan ke huruf kecil, pesan bercacat dibuang."""
    from app.services.llm import normalisasi_pesan

    hasil = normalisasi_pesan(
        [
            {"role": "system", "content": "aturan"},
            {"role": "USER", "content": "halo"},
            {"role": "Assistant", "content": "hai"},
            {"role": "model", "content": "peran era SDK lain"},
            {"role": "user"},  # tanpa isi -> dibuang
            "bukan-dict",  # cacat -> dibuang
            None,
        ]
    )
    assert hasil == [
        {"role": "system", "content": "aturan"},
        {"role": "user", "content": "halo"},
        {"role": "assistant", "content": "hai"},
    ]


def test_normalisasi_pesan_kosong_atau_semua_cacat() -> None:
    from app.services.llm import normalisasi_pesan

    assert normalisasi_pesan([]) == []
    assert normalisasi_pesan(None) == []
    assert normalisasi_pesan([{"role": "alien", "content": "x"}]) == []


def test_penjaga_sumber_normalisasi_dua_lapis() -> None:
    """Normalisasi harus ada di KEDUA lapisan: pembangun pesan (riwayat
    huruf besar -> huruf kecil) dan klien transport (belt-and-braces)."""
    layanan = (
        ROOT_BACKEND / "app" / "services" / "assistant.py"
    ).read_text(encoding="utf-8")
    klien = (ROOT_BACKEND / "app" / "services" / "llm.py").read_text(
        encoding="utf-8")
    assert "peran" in layanan and ".lower()" in layanan
    assert "def normalisasi_pesan" in klien
    assert "normalisasi_pesan(messages)" in klien
