"""Test alur generasi asisten dengan LLM stub ber-oracle (v3.1.0).

Stub meniru LLM nyata: mengembalikan jawaban yang ANGKANYA disiapkan
test (oracle), lalu memeriksa apakah orkestrator memanggil retry tepat
satu kali dan menandai hasil akhirnya dengan jujur.

Test sinkron memakai asyncio.run() — pytest-asyncio sengaja tidak
ditambahkan ke requirements supaya image container tidak membengkak.
"""

from __future__ import annotations

import asyncio

from app.services.assistant import generate_answer


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


class StubLlm:
    """LLM palsu ber-oracle: jawaban diantre per panggilan.

    `panggilan` merekam (messages, temperature, max_tokens) supaya test
    bisa memastikan retry mengirim instruksi koreksi yang benar.
    """

    def __init__(self, jawaban: list[str]) -> None:
        self._antre = list(jawaban)
        self.panggilan: list[tuple[list[dict], float, int]] = []

    async def complete(self, messages, temperature=0.2, max_tokens=400):
        self.panggilan.append((messages, temperature, max_tokens))
        return self._antre.pop(0)


def _jalankan(korutin):
    return asyncio.run(korutin)


def test_jawaban_bersah_tanpa_retry() -> None:
    stub = StubLlm(["Omzet hari ini Rp 125.000 dari 5 transaksi. "
                    "Saran: tawarkan paket Kopi Susu."])
    hasil = _jalankan(generate_answer("omzet hari ini?", _konteks(), [], stub))
    assert hasil["mode"] == "ai"
    assert hasil["numbers_validated"] is True
    assert hasil["retried"] is False
    assert len(stub.panggilan) == 1
    assert stub.panggilan[0][1] == 0.2  # temperatur blueprint
    assert stub.panggilan[0][2] == 400  # maks token blueprint


def test_halusinasi_lalu_koreksi_satu_kali() -> None:
    stub = StubLlm(
        [
            "Omzet hari ini Rp 500.000 sekali jalan.",
            "Omzet hari ini Rp 125.000. Saran: pasangkan Teh Panas.",
        ]
    )
    hasil = _jalankan(generate_answer("omzet?", _konteks(), [], stub))
    assert hasil["numbers_validated"] is True
    assert hasil["retried"] is True
    assert len(stub.panggilan) == 2
    # Panggilan kedua memuat instruksi koreksi + jawaban pertama.
    pesan_kedua = stub.panggilan[1][0]
    assert any("TIDAK ada di DATA" in m["content"] for m in pesan_kedua)
    assert any("500.000" in m["content"] for m in pesan_kedua)


def test_halusinasi_dua_kali_ditandai_jujur() -> None:
    stub = StubLlm(
        [
            "Omzet Rp 500.000.",
            "Omzet Rp 777.000.",
        ]
    )
    hasil = _jalankan(generate_answer("omzet?", _konteks(), [], stub))
    assert hasil["numbers_validated"] is False
    assert hasil["retried"] is True
    assert len(stub.panggilan) == 2  # hanya 1 retry, tidak berulang
    assert "777.000" in hasil["answer"]


def test_tanpa_llm_mode_data() -> None:
    hasil = _jalankan(generate_answer("omzet hari ini?", _konteks(), [], None))
    assert hasil["mode"] == "data"
    assert hasil["numbers_validated"] is True
    assert "Rp 125.000" in hasil["answer"]


def test_riwayat_terkirim_ke_llm() -> None:
    stub = StubLlm(["Baik. Saran: restok Gula Pasir."])
    riwayat = [
        {"role": "USER", "content": "halo"},
        {"role": "ASSISTANT", "content": "hai, ada yang bisa dibantu?"},
    ]
    _jalankan(generate_answer("stok menipis?", _konteks(), riwayat, stub))
    pesan = stub.panggilan[0][0]
    assert pesan[1]["content"] == "halo"
    assert pesan[2]["content"] == "hai, ada yang bisa dibantu?"


def test_intent_dan_period_ikut_hasil() -> None:
    stub = StubLlm(["Ringkas saja. Saran: cek stok."])
    hasil = _jalankan(
        generate_answer("produk terlaris minggu ini apa?", _konteks(), [], stub)
    )
    assert hasil["intent"] == "produk"
    assert hasil["period"] == "minggu"
