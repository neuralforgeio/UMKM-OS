"""Test store konfigurasi LLM runtime (v3.2.0) — murni, tmp_path.

Skenario inti: env compose tetap fallback, file volume menimpa per-field,
enabled=false mematikan total, file korup diabaikan, kunci dimasker.
"""

from __future__ import annotations

import json

import pytest

from app.core.config import settings
from app.services import llm_config_store as store


@pytest.fixture()
def direktori(tmp_path, monkeypatch):
    """Arahkan ML_MODEL_DIR ke tmp_path + bersihkan cache mtime."""
    monkeypatch.setattr(settings, "ML_MODEL_DIR", str(tmp_path))
    store._reset_cache_for_tests()
    yield tmp_path
    store._reset_cache_for_tests()


def _env(monkeypatch, **nilai) -> None:
    monkeypatch.setattr(settings, "LLM_ENABLED", True)
    monkeypatch.setattr(settings, "LLM_BASE_URL", nilai.get("base_url", ""))
    monkeypatch.setattr(settings, "LLM_API_KEY", nilai.get("api_key", ""))
    monkeypatch.setattr(settings, "LLM_MODEL", nilai.get("model", ""))


def test_tanpa_file_pakai_env(direktori, monkeypatch) -> None:
    _env(monkeypatch, base_url="https://api.groq.com/openai/v1",
         api_key="gsk_env", model="llama-3.3-70b-versatile")
    cfg = store.effective_llm_config()
    assert cfg["source"] == "env"
    assert cfg["base_url"] == "https://api.groq.com/openai/v1"
    assert cfg["api_key"] == "gsk_env"


def test_file_menimpa_env(direktori, monkeypatch) -> None:
    _env(monkeypatch, base_url="https://env", api_key="env-key",
         model="env-model")
    store.save_file_config(
        base_url="https://api.groq.com/openai/v1",
        api_key="gsk_file",
        model="llama-3.3-70b-versatile",
        enabled=True,
    )
    cfg = store.effective_llm_config()
    assert cfg["source"] == "file"
    assert cfg["base_url"] == "https://api.groq.com/openai/v1"
    assert cfg["api_key"] == "gsk_file"
    assert cfg["model"] == "llama-3.3-70b-versatile"
    assert cfg["enabled"] is True


def test_field_kosong_file_mewarisi_env(direktori, monkeypatch) -> None:
    """UI mengisi URL+model; kunci kosong -> kunci tetap dari env."""
    _env(monkeypatch, base_url="https://env", api_key="env-key",
         model="env-model")
    store.save_file_config(
        base_url="https://api.openai.com/v1",
        api_key="",
        model="gpt-4o-mini",
        enabled=True,
    )
    cfg = store.effective_llm_config()
    assert cfg["base_url"] == "https://api.openai.com/v1"
    assert cfg["model"] == "gpt-4o-mini"
    assert cfg["api_key"] == "env-key"  # diwarisi, bukan kosong


def test_file_disabled_mematikan_env(direktori, monkeypatch) -> None:
    """Saklar UI "OFF" menimpa env yang menyala — niat eksplisit user."""
    _env(monkeypatch, base_url="https://env", api_key="env-key",
         model="env-model")
    store.save_file_config(base_url="", api_key="", model="", enabled=False)
    cfg = store.effective_llm_config()
    assert cfg["enabled"] is False


def test_api_key_kosong_boleh_ollama(direktori, monkeypatch) -> None:
    """Ollama lokal jalan tanpa kunci — URL+model cukup untuk aktif."""
    _env(monkeypatch)
    store.save_file_config(
        base_url="http://host.docker.internal:11434/v1",
        api_key="",
        model="llama3.1",
        enabled=True,
    )
    cfg = store.effective_llm_config()
    assert cfg["enabled"] is True
    assert cfg["api_key"] == ""


def test_file_korup_diabaikan(direktori, monkeypatch) -> None:
    _env(monkeypatch, base_url="https://env", model="env-model")
    (direktori / store.CONFIG_FILENAME).write_text(
        "{bukan json", encoding="utf-8"
    )
    store._reset_cache_for_tests()
    cfg = store.effective_llm_config()
    assert cfg["source"] == "env"  # korup -> seolah tak ada


def test_simpan_ulang_terlihat_tanpa_restart(direktori, monkeypatch) -> None:
    """Cache mtime: simpan kedua langsung terbaca panggilan berikutnya."""
    _env(monkeypatch)
    store.save_file_config("https://a", "kunci-1", "model-1", True)
    assert store.effective_llm_config()["api_key"] == "kunci-1"
    store.save_file_config("https://b", "kunci-2", "model-2", True)
    cfg = store.effective_llm_config()
    assert cfg["base_url"] == "https://b"
    assert cfg["api_key"] == "kunci-2"


def test_bentuk_file_json_rapi(direktori) -> None:
    store.save_file_config("https://x", "kunci", "model", True)
    isi = json.loads(
        (direktori / store.CONFIG_FILENAME).read_text(encoding="utf-8")
    )
    assert isi == {
        "enabled": True,
        "base_url": "https://x",
        "api_key": "kunci",
        "model": "model",
    }


@pytest.mark.parametrize(
    ("kunci", "masker"),
    [
        ("", ""),
        ("abc", "****"),
        ("gsk_abcdefghij", "gsk_****ghij"),
        ("sk-rDNA1234567890WXYZ", "sk-r****WXYZ"),
    ],
)
def test_mask_key(kunci: str, masker: str) -> None:
    assert store.mask_key(kunci) == masker
