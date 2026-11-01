"""Klien LLM OpenAI-compatible (ml-service v3.5.0) - blueprint BAB 3.

Komunikasi keluar ke LLM terjadi LANGSUNG dari FastAPI (bukan dari
browser) supaya API key tidak pernah melintas ke klien. Endpoint yang
dipakai adalah standar industri `{base_url}/chat/completions` sehingga
penyedia mana pun cocok: OpenAI, Groq, Together, OpenRouter, atau
Ollama lokal (`http://host:11434/v1`, tanpa kunci).

Konfigurasi (semua OPSIONAL - kosong = layanan chat menolak jujur 503):
  env  : LLM_BASE_URL / LLM_API_KEY / LLM_MODEL / LLM_ENABLED
  file : volume mlmodels/llm_config.json - ditulis UI Pengaturan via
         PUT /assistant/llm-config, MENIMPA env tanpa restart (v3.2.0).
  LLM_API_KEY boleh kosong bila penyedianya tidak meminta kunci
  (Ollama lokal) - kunci kosong bukan penghalang Mode AI.

v3.5.1 (v1.1.1 produk, perbaikan "obrolan kedua selalu 502"):
  * normalisasi_pesan() menjadi lapisan pertahanan KEDUA di batas
    transport: penyedia OpenAI-compatible hanya menerima peran huruf
    kecil (system/user/assistant); riwayat database tersimpan huruf
    besar (konvensi migrasi Go). Klien kini menurunkan huruf peran,
    membuang pesan bercacat (peran asing / isi bukan string / kosong),
    dan menolak jujur bila tidak tersisa satu pun pesan sah.

v3.5.0 (v1.1.0 produk, permintaan pemilik "kenapa AI nya tidak bisa"):
  * pesan galat HTTP DITERJEMAHKAN ke bahasa pemilik lewat
    pesan_galat_http() - kunci ditolak (401), tanpa hak (403), batas
    laju penyedia (429), atau server penyedia bermasalah (5xx) kini
    dibedakan jelas; potongan tubuh respons ikut disertakan supaya
    kegagalan tidak lagi "senyap jatuh ke template" seperti dulu;
  * isi jawaban KOSONG dari model reasoning dianggap kegagalan
    (LlmError), bukan jawaban kosong yang dikirim ke pemilik;
  * timeout 45 detik: gpt-oss di Groq memakai token berpikir lebih
    dulu, 30 detik kadang terpotong pada jam sibuk penyedia.

Kegagalan jaringan/HTTP dari penyedia tetap di-raise sebagai LlmError;
pemanggil (routes/assistant.py v1.1.0) meneruskannya sebagai HTTP 502
dengan pesan ramah - asisten tidak pernah lagi menjawab palsu.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.services.llm_config_store import effective_llm_config


class LlmError(RuntimeError):
    """Kegagalan panggilan LLM (jaringan/HTTP/bentuk respons)."""


def pesan_galat_http(status: int, tubuh: str) -> str:
    """Terjemahkan status + tubuh respons penyedia menjadi satu kalimat
    yang bisa dibaca pemilik warung (murni, mudah diuji).

    Contoh: 401 -> kunci ditolak (petunjuk salin ulang dari Groq);
    429 -> batas laju; 5xx -> penyedia bermasalah; lainnya menyertakan
    potongan tubuh respons (mis. nama model tak dikenal).
    """
    potong = " ".join((tubuh or "").split())[:160]
    if status == 401:
        return (
            "LLM menolak (HTTP 401): kunci API ditolak penyedia. Salin "
            "ulang kunci dari console.groq.com/keys lalu simpan di "
            "Pengaturan -> Asisten AI."
        )
    if status == 403:
        return (
            "LLM menolak (HTTP 403): kunci tidak berhak memakai model "
            "ini. Periksa nama model dan hak akses kuncinya."
        )
    if status == 429:
        return (
            "LLM sibuk (HTTP 429): batas laju penyedia tercapai. Tunggu "
            "sebentar lalu kirim ulang."
        )
    if status >= 500:
        return f"LLM sedang bermasalah (HTTP {status}). Coba lagi nanti."
    if potong:
        return f"LLM menolak (HTTP {status}): {potong}"
    return f"LLM menolak (HTTP {status})."


PERAN_SAH = ("system", "user", "assistant")


def normalisasi_pesan(
    messages: list[dict[str, Any]] | None,
) -> list[dict[str, str]]:
    """Normalisasi daftar pesan ke bentuk literal peran OpenAI-compatible.

    Lapisan pertahanan kedua (v1.1.1) di BATAS TRANSPORT: barisan pesan
    dari mana pun (build_messages, retry koreksi, pemanggil baru di masa
    depan) diturunkan ke peran huruf kecil yang sah; pesan bercacat -
    peran asing ("model", "USER" tak ternormalkan, dst.), isi bukan
    string, atau isi kosong - dibuang bersama pesannya. Tanpa ini,
    penyedia menolak seluruh permintaan dengan HTTP 400 discriminator
    property role hanya karena SATU pesan bercacat.
    """
    bersih: list[dict[str, str]] = []
    for m in messages or []:
        if not isinstance(m, dict):
            continue
        peran = str(m.get("role", "")).strip().lower()
        isi = m.get("content")
        if peran not in PERAN_SAH or not isinstance(isi, str) or not isi:
            continue
        bersih.append({"role": peran, "content": isi})
    return bersih


class HttpLlmClient:
    """Panggilan POST /chat/completions memakai httpx async.

    Dibuat per-panggilan-request dari `get_llm_client()`; timeout 45
    detik - gpt-oss berpikir lebih dulu, asisten harus sabar sedikit
    tapi tetap lebih cepat daripada keluhan tidak terjawab.
    """

    def __init__(self, base_url: str, api_key: str, model: str,
                 timeout: float = 45.0) -> None:
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
        pesan_bersih = normalisasi_pesan(messages)
        if not pesan_bersih:
            raise LlmError(
                "Tidak ada satu pun pesan sah untuk dikirim ke LLM "
                "(semua peran/isi bercacat)."
            )
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": pesan_bersih,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        # v2.7.0: model reasoning (gpt-oss di Groq) menghabiskan token
        # berpikir SEBELUM jawaban - anggaran kecil membuat jawaban
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
            raise LlmError(
                f"LLM tidak terjangkau: {type(exc).__name__}: {exc}"
            ) from exc
        if res.status_code >= 400:
            try:
                tubuh = res.text
            except Exception:  # pragma: no cover - res.text tidak pernah gagal di httpx
                tubuh = ""
            raise LlmError(pesan_galat_http(res.status_code, tubuh))
        try:
            isi = res.json()
            jawaban = str(isi["choices"][0]["message"]["content"] or "").strip()
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise LlmError("Bentuk respons LLM tidak dikenal") from exc
        if not jawaban:
            # Model reasoning kadang menghabiskan seluruh anggaran untuk
            # berpikir lalu mengirim isi kosong; itu kegagalan jawaban,
            # bukan jawaban - pemilik berhak tahu dan mencoba lagi.
            raise LlmError("LLM mengirim jawaban kosong. Coba lagi.")
        return jawaban


def llm_configured() -> bool:
    """True bila LLM aktif: saklar menyala + URL + model terisi.

    API key TIDAK diwajibkan (Ollama lokal jalan tanpa kunci) - v3.2.0.
    """
    cfg = effective_llm_config()
    return bool(cfg["enabled"] and cfg["base_url"] and cfg["model"])


def get_llm_client() -> HttpLlmClient | None:
    """Klien siap pakai, atau None bila LLM tidak dikonfigurasi.

    None => pemanggil memakai jalur penolakan jujur 503 (v1.1.0:
    Mode Data dimatikan, tidak ada jawaban template lagi).
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
