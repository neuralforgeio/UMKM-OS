"""Klien LLM OpenAI-compatible (ml-service v3.2.0) — blueprint BAB 3.

Komunikasi keluar ke LLM terjadi LANGSUNG dari FastAPI (bukan dari
browser) supaya API key tidak pernah melintas ke klien. Endpoint yang
dipakai adalah standar industri `{base_url}/chat/completions` sehingga
penyedia mana pun cocok: OpenAI, Groq, Together, OpenRouter, atau
Ollama lokal (`http://host:11434/v1`, tanpa kunci).

Konfigurasi (semua OPSIONAL — kosong = Mode Data tanpa LLM):
  env  : LLM_BASE_URL / LLM_API_KEY / LLM_MODEL / LLM_ENABLED
  file : volume mlmodels/llm_config.json — ditulis UI Pengaturan via
         PUT /assistant/llm-config, MENIMPA env tanpa restart (v3.2.0).
  LLM_API_KEY boleh kosong bila penyedianya tidak meminta kunci
  (Ollama lokal) — kunci kosong bukan lagi penghalang Mode AI.

Kegagalan jaringan/HTTP dari penyedia TIDAK menjatuhkan request:
`complete` meng-raise `LlmError` dan pemanggil (routes/assistant.py)
jatuh ke Mode Data offline.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.services.llm_config_store import effective_llm_config


class LlmError(RuntimeError):
    """Kegagalan panggilan LLM (jaringan/HTTP/bentuk respons)."""


class HttpLlmClient:
    """Panggilan POST /chat/completions memakai httpx async.

    Dibuat per-panggilan-request dari `get_llm_client()`; timeout 30
    detik — asisten harus terasa cepat, bukan menunggu model lambat.
    """

    def __init__(self, base_url: str, api_key: str, model: str,
                 timeout: float = 30.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._model = model
        self._timeout = timeout

    @property
    def model(self) -> str:
        return self._model

    async def complete(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 400,
    ) -> str:
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        # v2.7.0: model reasoning (gpt-oss di Groq) menghabiskan token
        # berpikir SEBELUM jawaban — anggaran kecil membuat jawaban
        # kosong. Usaha rendah + anggaran lebih longgar menjaga asisten
        # tetap ringkas namun tidak pernah kosong.
        if "gpt-oss" in self._model.lower():
            payload["max_tokens"] = max(1500, int(max_tokens))
            payload["reasoning_effort"] = "low"
        headers = {"Authorization": f"Bearer {self._api_key}"}
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as klien:
                res = await klien.post(
                    f"{self._base_url}/chat/completions",
                    json=payload,
                    headers=headers,
                )
        except httpx.HTTPError as exc:  # timeout, koneksi, DNS
            raise LlmError(f"LLM tidak terjangkau: {exc}") from exc
        if res.status_code >= 400:
            raise LlmError(f"LLM menolak (HTTP {res.status_code})")
        try:
            isi = res.json()
            return str(isi["choices"][0]["message"]["content"]).strip()
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise LlmError("Bentuk respons LLM tidak dikenal") from exc


def llm_configured() -> bool:
    """True bila LLM aktif: saklar menyala + URL + model terisi.

    API key TIDAK diwajibkan (Ollama lokal jalan tanpa kunci) — v3.2.0.
    """
    cfg = effective_llm_config()
    return bool(cfg["enabled"] and cfg["base_url"] and cfg["model"])


def get_llm_client() -> HttpLlmClient | None:
    """Klien siap pakai, atau None bila LLM tidak dikonfigurasi.

    None => pemanggil memakai jalur Mode Data (build_offline_answer).
    Dibaca PER PERMINTAAN dari konfigurasi efektif (env + file volume)
    sehingga pengaturan baru dari UI langsung berlaku tanpa restart.
    """
    cfg = effective_llm_config()
    if not (cfg["enabled"] and cfg["base_url"] and cfg["model"]):
        return None
    return HttpLlmClient(
        base_url=cfg["base_url"],
        api_key=cfg["api_key"],
        model=cfg["model"],
    )
