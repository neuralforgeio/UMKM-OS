"""Test uji sambungan LLM (ml-service v1.0.0), murni, tanpa jaringan.

Mengunci perilaku run_selftest:
  * sukses Mode AI (stub menjawab SIAP) + kunci dimasker benar;
  * belum terkonfigurasi (saklar mati / URL kosong) => ok False jujur;
  * penyedia menolak => ok False dengan pesan + latensi tetap terukur;
  * jawaban panjang dipotong ke 120 karakter;
  * masker kunci pendek menyatu jadi bintang penuh;
  * jalur KONFIGURASI FILE: save_file_config di tmp_path dibaca kembali
    oleh effective_llm_config() sebagai sumber "file" (monkeypatch
    ML_MODEL_DIR, pola yang sama dengan test_llm_config_store).

Pelajaran v3.4.0 yang dijadikan aturan di sini: JANGAK mengandalkan
monkeypatch env untuk menguji konfigurasi efektif, llm_config.json di
volume mlmodels MENIMPA env di dalam container, sehingga dua test lama
gagal dengan kunci sungguhan ikut terbaca. Semua cfg disuntik eksplisit.
"""

from __future__ import annotations

import asyncio

from app.core.config import settings
from app.services import llm_config_store as store
from app.services import llm_selftest as uji


def jalankan(**kwargs):
    return asyncio.run(uji.run_selftest(**kwargs))


class KlienStub:
    """Pengganti HttpLlmClient: menjawab tetap atau melempar galat."""

    def __init__(self, jawaban: str = "SIAP", galat: Exception | None = None):
        self.jawaban = jawaban
        self.galat = galat
        self.panggilan = 0

    async def complete(self, messages, temperature=0.2, max_tokens=400):
        self.panggilan += 1
        assert messages[0]["role"] == "user"
        assert messages[0]["content"] == uji.UJI_PROMPT
        if self.galat is not None:
            raise self.galat
        return self.jawaban


CFG_AI = {
    "enabled": True,
    "base_url": "https://api.groq.com/openai/v1",
    "api_key": "gsk_ujikotakkunci",
    "model": "openai/gpt-oss-20b",
    "source": "file",
}

CFG_MATI = {
    "enabled": False,
    "base_url": "https://api.groq.com/openai/v1",
    "api_key": "gsk_ujikotakkunci",
    "model": "openai/gpt-oss-20b",
    "source": "file",
}

CFG_KOSONG = {
    "enabled": True,
    "base_url": "",
    "api_key": "",
    "model": "",
    "source": "env",
}


def test_sukses_mode_ai() -> None:
    klien = KlienStub("SIAP")
    hasil = jalankan(klien=klien, cfg=CFG_AI)
    assert hasil["ok"] is True
    assert hasil["configured"] is True
    assert hasil["mode"] == "ai"
    assert hasil["answer_sample"] == "SIAP"
    assert isinstance(hasil["latency_ms"], int)
    assert hasil["error"] is None
    assert hasil["model"] == "openai/gpt-oss-20b"
    # Kunci hanya muncul dalam bentuk dimasker (aturan 11 v2.7.0).
    assert hasil["api_key_masked"] == "gsk_****unci"
    assert "gsk_ujikotakkunci" not in str(hasil)
    assert klien.panggilan == 1


def test_sukses_tanpa_kunci_ollama() -> None:
    cfg = dict(CFG_AI, api_key="", source="env")
    hasil = jalankan(klien=KlienStub("SIAP"), cfg=cfg)
    assert hasil["ok"] is True
    assert hasil["api_key_masked"] == ""
    assert hasil["source"] == "env"


def test_saklar_mati() -> None:
    klien = KlienStub("SIAP")
    hasil = jalankan(klien=klien, cfg=CFG_MATI)
    assert hasil["ok"] is False
    assert hasil["configured"] is False
    assert hasil["mode"] == "data"
    assert "Mode AI belum aktif" in hasil["error"]
    assert klien.panggilan == 0  # tidak pernah menyapa penyedia


def test_belum_dikonfigurasi() -> None:
    hasil = jalankan(cfg=CFG_KOSONG)
    assert hasil["ok"] is False
    assert hasil["configured"] is False
    assert hasil["mode"] == "data"
    assert hasil["error"] is not None
    assert hasil["api_key_masked"] == ""


def test_url_kosong_saklar_nyala() -> None:
    cfg = dict(CFG_AI, base_url="")
    hasil = jalankan(klien=KlienStub("SIAP"), cfg=cfg)
    assert hasil["configured"] is False
    assert hasil["mode"] == "data"
    assert hasil["base_url"] == ""


def test_model_kosong_saklar_nyala() -> None:
    cfg = dict(CFG_AI, model="")
    hasil = jalankan(klien=KlienStub("SIAP"), cfg=cfg)
    assert hasil["configured"] is False
    assert hasil["model"] == ""


def test_galat_penyedia() -> None:
    galat = RuntimeError("LLM menolak (HTTP 401)")
    hasil = jalankan(klien=KlienStub(galat=galat), cfg=CFG_AI)
    assert hasil["ok"] is False
    assert hasil["configured"] is True
    assert hasil["mode"] == "ai"
    assert "RuntimeError" in hasil["error"]
    assert "HTTP 401" in hasil["error"]
    assert isinstance(hasil["latency_ms"], int)


def test_jawaban_panjang_dipotong() -> None:
    klien = KlienStub("SA " * 200)
    hasil = jalankan(klien=klien, cfg=CFG_AI)
    assert hasil["ok"] is True
    assert hasil["answer_sample"] is not None
    assert len(hasil["answer_sample"]) <= 120


def test_jawaban_kosong_tetap_ok() -> None:
    # Model reasoning kadang mengembalikan isi kosong; HTTP 200 tetap
    # berarti sambungan sehat, contoh jawaban None, ok True.
    hasil = jalankan(klien=KlienStub("   "), cfg=CFG_AI)
    assert hasil["ok"] is True
    assert hasil["answer_sample"] is None


def test_masker_kunci_pendek() -> None:
    assert store.mask_key("gsk_1234") == "****"
    cfg = dict(CFG_AI, api_key="pendek")
    hasil = jalankan(klien=KlienStub("SIAP"), cfg=cfg)
    assert hasil["api_key_masked"] == "****"


def test_konfigurasi_file_dibaca_sebagai_sumber(tmp_path, monkeypatch) -> None:
    """Jalur file: simpan ke tmp_path lalu pastikan cfg default (None)
    membacanya kembali dengan source="file" dan mode tetap terdeteksi."""
    monkeypatch.setattr(settings, "ML_MODEL_DIR", str(tmp_path))
    store._reset_cache_for_tests()
    store.save_file_config(
        base_url="https://api.groq.com/openai/v1",
        api_key="gsk_ujifilekunci",
        model="openai/gpt-oss-20b",
        enabled=True)
    hasil = jalankan(klien=KlienStub("SIAP"))
    assert hasil["ok"] is True
    assert hasil["source"] == "file"
    assert hasil["mode"] == "ai"
    assert hasil["api_key_masked"] == "gsk_****unci"
    store._reset_cache_for_tests()
