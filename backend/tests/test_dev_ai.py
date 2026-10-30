"""Test OSCAR Developer AI v3.4.0 (v2.7.0) — identitas pencipta + privasi.

Yang dikunci:
  - maksud baru "pencipta": pertanyaan asal-usul OSCAR dijawab identitas
    lengkap (nama, singkatan, Dearly Febriano Irwansyah, Surabaya);
  - privasi per-owner: system prompt melarang membahas data toko lain,
    dan jawaban cadangan dev_laporan TIDAK pernah membocorkan data
    lintas toko tanpa PIN;
  - Mode Developer ber-PIN: klasifikasi butuh PIN sah, jawaban chat
    tidak menyentuh DB sebelum PIN lolos, endpoint menolak PIN salah;
  - pelaporan proaktif: pemicu (stok kritis / omzet turun / toko diam),
    digest harian, batas penyimpanan 50 laporan, saklar darurat env.

Semua murni: jalur DB (bangun_ringkasan) di-stub per test — tanpa
PostgreSQL, tanpa jaringan, tanpa LLM asli.
"""

from __future__ import annotations

import asyncio
import json

import pytest

from app.services import assistant as A
from app.services import developer_report as D

PIN_UJI = "OSCAR-UJI-1234"


def _konteks() -> dict:
    """Konteks kaya (samakan bentuk test_oscar.py)."""
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
        ],
        "stok_kritis": [
            {
                "nama": "Gula Pasir", "stok": 2, "min_stok": 5,
                "saran_restok": 8, "kecepatan_hari": 1.0, "hari_habis": 2.0,
            },
        ],
        "jam_ramai": [{"jam": 19, "transaksi": 12}],
        "prediksi": {"tersedia": True, "engine": "prophet", "mape": 8.4},
        "ml_progress": {
            "hari_data": 9, "hari_pendapatan": 7,
            "gerbang_hari": 28, "gerbang_pendapatan": 14,
            "gerbang_terpenuhi": False,
        },
    }


def _ringkas_palsu(toko=None, stok=None, diam=None):
    """Ringkasan lintas toko palsu (data 2 toko + stok kritis)."""
    return {
        "dibuat": "2026-10-30T00:00:00+00:00",
        "jumlah_outlet": 2,
        "toko": toko
        if toko is not None
        else [
            {
                "outlet_id": 1, "nama": "Warung Bu Ira",
                "transaksi": 31, "omzet": 720000, "omzet_lalu": 900000,
            },
            {
                "outlet_id": 2, "nama": "Warung Sari",
                "transaksi": 12, "omzet": 300000, "omzet_lalu": 0,
            },
        ],
        "toko_diam": diam if diam is not None else [],
        "stok_kritis": stok
        if stok is not None
        else [
            {"nama": "Beras 5kg", "stok": 2, "min_stok": 5, "toko": "Warung Bu Ira"},
            {"nama": "Minyak 1L", "stok": 3, "min_stok": 6, "toko": "Warung Bu Ira"},
            {"nama": "Gula 1kg", "stok": 4, "min_stok": 8, "toko": "Warung Sari"},
            {"nama": "Teh 50g", "stok": 5, "min_stok": 10, "toko": "Warung Sari"},
        ],
    }


# ----------------------------------------------------------------------
# Maksud pencipta — identitas lengkap OSCAR
# ----------------------------------------------------------------------
def test_intents_baru_v270() -> None:
    assert "pencipta" in A.INTENTS
    assert "dev_laporan" in A.INTENTS


@pytest.mark.parametrize(
    "tanya",
    [
        "siapa penciptamu?",
        "Siapa yang membuat kamu?",
        "kamu dibuat siapa?",
        "who created you?",
        "OSCAR dari mana asalnya?",
    ],
)
def test_classify_pencipta(tanya: str) -> None:
    assert A.classify_intent(tanya) == "pencipta"


def test_identitas_lama_tetap_utuh() -> None:
    """Pertanyaan identitas biasa tidak tertelan maksud pencipta."""
    assert A.classify_intent("nama mu siapa") == "identitas"
    assert A.classify_intent("dibuat oleh siapa") == "identitas"


def test_jawab_pencipta_lengkap() -> None:
    jawab = A.build_offline_answer(_konteks(), "pencipta", "hari")
    assert "OSCAR" in jawab
    assert "Online Shop Center for Assistance & Response" in jawab
    assert "Dearly Febriano Irwansyah" in jawab
    assert "Surabaya" in jawab


def test_jawab_identitas_menyebut_pencipta() -> None:
    jawab = A.build_offline_answer(_konteks(), "identitas", "hari")
    assert "Dearly Febriano Irwansyah" in jawab


def test_jawab_pencipta_lolos_validasi_angka() -> None:
    jawab = A.build_offline_answer(_konteks(), "pencipta", "hari")
    sah, pelanggar = A.validate_numbers(
        jawab, A.collect_allowed_numbers(_konteks())
    )
    assert sah, f"pencipta mengarang angka: {pelanggar}"


def test_prompt_aturan_v270() -> None:
    p = A.build_system_prompt(_konteks())
    assert "Dearly Febriano Irwansyah" in p          # aturan 9 identitas
    assert "Surabaya" in p
    assert "Privasi per-owner" in p                  # aturan 10 privasi
    assert "toko lain" in p
    assert "Rahasia" in p                            # aturan 11 rahasia
    assert "kredensial" in p


def test_jawab_dev_cadangan_tidak_bocor() -> None:
    """Jalur cadangan Mode Data TIDAK menampilkan data lintas toko."""
    jawab = A.build_offline_answer(_konteks(), "dev_laporan", "hari")
    assert "PIN" in jawab
    assert "Rp" not in jawab  # tidak ada angka lintas toko yang bocor


# ----------------------------------------------------------------------
# Mode Developer ber-PIN
# ----------------------------------------------------------------------
@pytest.fixture()
def dev_cfg(tmp_path, monkeypatch):
    monkeypatch.setenv("OSCAR_DEV_CONFIG", str(tmp_path / "dev_config.json"))
    monkeypatch.setenv("OSCAR_DEV_REPORTS", str(tmp_path / "dev_reports.json"))
    (tmp_path / "dev_config.json").write_text(
        json.dumps({"enabled": True, "pin": PIN_UJI, "interval_detik": 900}),
        encoding="utf-8",
    )
    return tmp_path


@pytest.fixture()
def dev_mati(tmp_path, monkeypatch):
    """Env menunjuk berkas config yang TIDAK ada -> mode nonaktif."""
    monkeypatch.setenv("OSCAR_DEV_CONFIG", str(tmp_path / "kosong.json"))
    monkeypatch.setenv("OSCAR_DEV_REPORTS", str(tmp_path / "kosong_rep.json"))
    return tmp_path


def test_classify_dev_laporan_berpin(dev_cfg) -> None:
    tanya = "mode developer " + PIN_UJI + " laporan lintas toko"
    assert A.classify_intent(tanya) == "dev_laporan"
    assert A.classify_intent("mode developer PIN-SALAH laporan") != "dev_laporan"
    assert A.classify_intent("laporan lintas toko tanpa pin") != "dev_laporan"


def test_pesan_dev_sah(dev_cfg) -> None:
    assert D.pesan_dev_sah("mode developer " + PIN_UJI + " laporan")
    assert not D.pesan_dev_sah("mode developer PIN-SALAH laporan")
    assert not D.pesan_dev_sah(PIN_UJI)  # PIN tanpa frasa dev
    assert not D.pesan_dev_sah("halo oscar")


def test_pin_nonaktif(dev_mati) -> None:
    assert not D.pin_sah(PIN_UJI)
    assert not D.pesan_dev_sah("mode developer " + PIN_UJI + " laporan")


def test_jawab_chat_terkunci_tidak_sentuh_db(dev_cfg, monkeypatch) -> None:
    """PIN salah => DB lintas toko TIDAK boleh tersentuh sama sekali."""

    async def jangan_dipanggil() -> dict:
        raise AssertionError("bangun_ringkasan dipanggil tanpa PIN sah")

    monkeypatch.setattr(D, "bangun_ringkasan", jangan_dipanggil)
    teks = asyncio.run(D.jawab_chat("mode developer PIN-SALAH laporan"))
    assert "terkunci" in teks.lower()
    assert "PIN" in teks


def test_jawab_chat_sah(dev_cfg, monkeypatch) -> None:
    async def palsu() -> dict:
        return _ringkas_palsu()

    monkeypatch.setattr(D, "bangun_ringkasan", palsu)
    teks = asyncio.run(
        D.jawab_chat("mode developer " + PIN_UJI + " laporan lintas toko")
    )
    assert "MODE DEVELOPER AKTIF" in teks
    assert "Warung Bu Ira" in teks
    assert "Beras 5kg" in teks
    assert "PEMICU LAPORAN" in teks


def test_api_report_berpin(dev_cfg, monkeypatch) -> None:
    async def palsu() -> dict:
        return _ringkas_palsu()

    monkeypatch.setattr(D, "bangun_ringkasan", palsu)
    sah, muatan = asyncio.run(D.api_report(PIN_UJI))
    assert sah
    assert muatan["ok"] is True
    assert "teks" in muatan
    sah2, muatan2 = asyncio.run(D.api_report("PIN-SALAH"))
    assert not sah2
    assert muatan2["ok"] is False


# ----------------------------------------------------------------------
# Pelaporan proaktif
# ----------------------------------------------------------------------
def test_cek_pemicu() -> None:
    cfg = {"omzet_turun_persen": 20.0, "stok_kritis_min": 5}
    pemicu = D.cek_pemicu(_ringkas_palsu(), cfg)
    gabung = " | ".join(pemicu).lower()
    assert "stok kritis" in gabung       # 4 produk kritis (>= 3)
    assert "omzet turun" not in gabung   # total naik (1.020.000 > 900.000)
    assert "toko tanpa transaksi" not in gabung  # tidak ada toko diam


def test_cek_pemicu_turun_dan_diam() -> None:
    cfg = {"omzet_turun_persen": 20.0}
    r = _ringkas_palsu(
        toko=[
            {"outlet_id": 1, "nama": "Warung A", "transaksi": 5,
             "omzet": 100000, "omzet_lalu": 200000},
        ],
        stok=[],
        diam=[{"outlet_id": 2, "nama": "Warung B"}],
    )
    pemicu = D.cek_pemicu(r, cfg)
    gabung = " | ".join(pemicu).lower()
    assert "omzet turun 50%" in gabung
    assert "1 toko tanpa transaksi" in gabung


def test_teks_laporan() -> None:
    teks = D.teks_laporan(_ringkas_palsu(), ["pemicu contoh"])
    assert "LAPORAN DEVELOPER" in teks
    assert "Warung Bu Ira" in teks
    assert "Stok kritis gabungan" in teks
    assert "PEMICU LAPORAN" in teks
    assert "pemicu contoh" in teks


def test_laporan_proaktif_paksa(dev_cfg, monkeypatch) -> None:
    async def palsu() -> dict:
        return _ringkas_palsu()

    monkeypatch.setattr(D, "bangun_ringkasan", palsu)
    entri = asyncio.run(D.laporan_proaktif(paksa=True))
    assert entri is not None
    assert entri["jenis"] == "peringatan"
    assert len(D.muat_laporan()) == 1


def test_laporan_proaktif_digest_harian(dev_cfg, monkeypatch) -> None:
    async def palsu() -> dict:
        return _ringkas_palsu(toko=[], stok=[], diam=[])

    monkeypatch.setattr(D, "bangun_ringkasan", palsu)
    entri = asyncio.run(D.laporan_proaktif(paksa=True))
    assert entri["jenis"] == "digest-harian"


def test_laporan_proaktif_nonaktif(dev_mati) -> None:
    assert asyncio.run(D.laporan_proaktif(paksa=True)) is None


def test_simpan_laporan_batas(dev_cfg) -> None:
    for i in range(55):
        D.simpan_laporan(
            {"waktu": "2026-10-30T00:00:00+00:00", "jenis": "uji",
             "teks": "t" + str(i)}
        )
    assert len(D.muat_laporan()) == 50


def test_umur_jam() -> None:
    assert D._umur_jam("2000-01-01T00:00:00+00:00") > 1000.0
    assert D._umur_jam("bukan-iso") == 999.0


def test_proactive_loop_saklar_mati(monkeypatch) -> None:
    monkeypatch.setenv("OSCAR_DEV_PROACTIVE", "0")
    assert asyncio.run(D.proactive_loop()) is None
