"""Konfigurasi LLM runtime (ml-service v3.2.0) — tanpa restart container.

Masalah v3.1.x: LLM hanya bisa diaktifkan lewat env compose (LLM_BASE_URL
/ LLM_API_KEY / LLM_MODEL) yang menuntut edit .env + `docker compose up
-d backend` — pemilik warung hampir tidak pernah melakukannya, akibatnya
asisten tertahan di Mode Data selamanya padahal ia ingin "AI yang pintar".

Solusi v3.2.0: pengaturan disimpan sebagai JSON di volume `mlmodels`
(llm_config.json) lewat PUT /assistant/llm-config (dari UI Pengaturan
frontend) dan langsung berlaku pada permintaan chat BERIKUTNYA karena
get_llm_client() membaca konfigurasi efektif per panggilan.

Aturan penggabungan (file menang, env fallback):
  - file tidak ada / korup           => pakai env apa adanya;
  - field string di file TERISI      => menimpa env;
  - field string di file KOSONG      => mewarisi env (mis. URL+model
    diisi via UI, kunci tetap dari env);
  - "enabled": false di file         => LLM mati total (menimpa env),
    dipakai tombol "Aktifkan Mode AI" di UI.

Keamanan: file ini hidup di dalam volume docker (bersama artefak model),
tidak pernah dibaca browser; GET /assistant/llm-config hanya mengembalikan
kunci yang DIMASKER. Tulis atomik (.tmp + os.replace) supaya pembaca
tidak pernah melihat JSON setengah jadi.
"""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any

from app.core.config import settings

# Nama file konfigurasi di dalam ML_MODEL_DIR (volume docker `mlmodels`).
CONFIG_FILENAME = "llm_config.json"

_LOCK = threading.Lock()
# Cache (mtime, parsed) — stat() murah, json.loads hanya saat file berganti.
_cache: tuple[float | None, dict[str, Any] | None] = (None, None)

_BIDANG = ("enabled", "base_url", "api_key", "model")


def config_path() -> Path:
    """Lokasi file konfigurasi (mengikuti ML_MODEL_DIR saat runtime)."""
    return Path(settings.ML_MODEL_DIR) / CONFIG_FILENAME


def load_file_config() -> dict[str, Any] | None:
    """Baca llm_config.json -> dict, atau None bila tidak ada / korup.

    Hasil di-cache berdasarkan mtime; penyimpanan baru otomatis terlihat
    pada panggilan berikutnya tanpa restart proses.
    """
    global _cache
    with _LOCK:
        try:
            mtime = config_path().stat().st_mtime
        except OSError:
            _cache = (None, None)
            return None
        if _cache[1] is not None and _cache[0] == mtime:
            return _cache[1]
        try:
            data = json.loads(config_path().read_text(encoding="utf-8"))
        except (OSError, ValueError):
            data = None
        cfg = data if isinstance(data, dict) else None
        _cache = (mtime, cfg)
        return cfg


def save_file_config(
    base_url: str, api_key: str, model: str, enabled: bool = True
) -> None:
    """Simpan konfigurasi (atomik). enabled=false = matikan LLM total.

    Menyimpan dengan seluruh field kosong + enabled=false tetap menulis
    file (bukan menghapus) supaya niat "OFF" pengguna menimpa env —
    tanpa itu, env compose diam-diam menyalakannya kembali.
    """
    global _cache
    muat = {
        "enabled": bool(enabled),
        "base_url": (base_url or "").strip(),
        "api_key": (api_key or "").strip(),
        "model": (model or "").strip(),
    }
    with _LOCK:
        path = config_path()
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(".tmp")
            tmp.write_text(
                json.dumps(muat, ensure_ascii=True, indent=2), encoding="utf-8"
            )
            os.replace(tmp, path)
        except OSError:
            return  # FS read-only — env tetap berlaku, tidak melempar
        try:
            _cache = (path.stat().st_mtime, muat)
        except OSError:
            _cache = (None, None)


def effective_llm_config() -> dict[str, Any]:
    """Konfigurasi efektif: file menimpa env per-field (lihat docstring).

    Selalu memuat kunci "source": "file" | "env" — dipakai UI untuk
    menjelaskan dari mana pengaturan aktif berasal.
    """
    hasil: dict[str, Any] = {
        "enabled": bool(settings.LLM_ENABLED),
        "base_url": (settings.LLM_BASE_URL or "").strip(),
        "api_key": (settings.LLM_API_KEY or "").strip(),
        "model": (settings.LLM_MODEL or "").strip(),
    }
    file = load_file_config()
    if file:
        if isinstance(file.get("enabled"), bool):
            hasil["enabled"] = file["enabled"]
        for bidang in ("base_url", "api_key", "model"):
            nilai = file.get(bidang)
            if isinstance(nilai, str) and nilai.strip():
                hasil[bidang] = nilai.strip()
        hasil["source"] = "file"
    else:
        hasil["source"] = "env"
    return hasil


def mask_key(key: str) -> str:
    """Masker kunci utk tampilan: 'gsk_abc...wxyz' -> 'gsk_****wxyz'."""
    kunci = (key or "").strip()
    if not kunci:
        return ""
    if len(kunci) <= 8:
        return "****"
    return f"{kunci[:4]}****{kunci[-4:]}"


def _reset_cache_for_tests() -> None:
    """Pembersih cache internal — HANYA untuk pytest (monkeypatch ML_MODEL_DIR)."""
    global _cache
    with _LOCK:
        _cache = (None, None)
