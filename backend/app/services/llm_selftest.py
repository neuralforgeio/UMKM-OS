"""Uji sambungan LLM untuk OSCAR (ml-service v1.0.0).

Mengapa ada: pemilik mengisi pengaturan Mode AI di UI lalu menebak nebak
apakah kunci/model benar benar hidup. Endpoint /assistant/llm-selftest
(POST) menjalankan run_selftest() yang menyapa penyedia SUNGGUHAN dengan
konfigurasi efektif saat itu (file volume menimpa env, aturan yang sama
dipakai obrolan), mengukur latensi, dan mengembalikan contoh jawaban.

Desain agar dapat diuji penuh tanpa jaringan:
  * run_selftest(klien=None, cfg=None), cfg disuntik di test (dict
    biasa), klien bisa berupa stub; tanpa klien dipakai HttpLlmClient
    dari get_llm_client() (panggilan nyata).
  * Kunci hanya keluar dalam bentuk DIMASKER (aturan 11 v2.7.0).

Pelajaran v3.4.0 (dua test gagal di container): test yang mengandalkan
monkeypatch env tidak cukup karena llm_config.json di volume mlmodels
MENIMPA env, di dalam container berkampanye kunci sungguhan. Maka test
v1.0.0 menyuntik cfg secara eksplisit; jalur file diuji terpisah dengan
tmp_path (monkeypatch ML_MODEL_DIR), bukan dengan env.
"""

from __future__ import annotations

import time
from typing import Any

from app.services.llm_config_store import effective_llm_config, mask_key

# Perintah uji: pendek, murah, dan jawabannya mudah diperiksa mata.
UJI_PROMPT = "Balas hanya dengan kata SIAP."

PANJANG_CONTOH = 120


def _configured(cfg: dict[str, Any]) -> bool:
    """Aturan yang sama dengan llm.get_llm_client(): saklar + URL + model.

    Kunci TIDAK diwajibkan (Ollama lokal berjalan tanpa kunci).
    """
    return bool(cfg.get("enabled") and cfg.get("base_url") and cfg.get("model"))


async def run_selftest(
    klien: Any | None = None, cfg: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Uji satu panggilan chat/completions dengan konfigurasi efektif.

    klien : objek dengan `await complete(messages, temperature,
            max_tokens) -> str`. None = bangun klien nyata dari
            konfigurasi efektif (dipakai endpoint production).
    cfg   : konfigurasi efektif (dict dari effective_llm_config()).
            None = baca saat dipanggil (env + file volume).
    """
    if cfg is None:
        cfg = effective_llm_config()
    siap = _configured(cfg)
    hasil: dict[str, Any] = {
        "ok": False,
        "configured": siap,
        "mode": "ai" if siap else "data",
        "answer_sample": None,
        "latency_ms": None,
        "error": None,
        "model": (cfg.get("model") or "").strip(),
        "api_key_masked": mask_key(cfg.get("api_key") or ""),
        "source": cfg.get("source", "env"),
        "base_url": (cfg.get("base_url") or "").strip(),
    }
    if not siap:
        hasil["error"] = (
            "Mode AI belum aktif: saklar, URL dasar, atau nama model "
            "masih kosong."
        )
        return hasil

    if klien is None:
        from app.services.llm import get_llm_client

        klien = get_llm_client()
        if klien is None:
            # Konfigurasi berubah di antara dua pembacaan, sangat jarang.
            hasil["error"] = "Konfigurasi berubah sebelum uji dijalankan."
            return hasil

    mulai = time.perf_counter()
    try:
        jawaban = await klien.complete(
            [{"role": "user", "content": UJI_PROMPT}],
            temperature=0.0,
            max_tokens=800)
    except Exception as exc:  # jaringan/HTTP/bentuk respons penyedia
        hasil["latency_ms"] = int((time.perf_counter() - mulai) * 1000)
        hasil["error"] = f"{type(exc).__name__}: {exc}"
        return hasil
    hasil["latency_ms"] = int((time.perf_counter() - mulai) * 1000)
    contoh = (jawaban or "").strip()
    hasil["answer_sample"] = contoh[:PANJANG_CONTOH] if contoh else None
    hasil["ok"] = True
    return hasil
