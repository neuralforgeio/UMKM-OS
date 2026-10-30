"""Skema request/response Asisten AI (ml-service v3.2.0).

Kontrak:
  - POST /assistant/chat       — tanya jawab (user_id + outlet_id dari
    pintu frontend ber-X-Internal-Key; layanan ML mempercayai gateway).
  - GET  /assistant/history    — riwayat chat terakhir (tampilan panel).
  - GET  /assistant/status     — PUBLIK (tanpa key): mode, model, batas
    laju, versi — supaya konsol dev bisa memeriksa tanpa sesi.
  - GET  /assistant/llm-config — pengaturan LLM efektif (kunci DIMASKER).
  - PUT  /assistant/llm-config — simpan pengaturan LLM dari UI Pengaturan
    (file volume menimpa env; berlaku tanpa restart container).

Semua field baru diberi default agar klien lama tidak patah.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    user_id: int = Field(ge=1)
    question: str = Field(min_length=1, max_length=500)
    outlet_id: str | None = None


class ChatResponse(BaseModel):
    answer: str
    # "ai" = LLM aktif; "data" = Mode Data template (tanpa LLM).
    mode: str = "data"
    intent: str = "saran_tindakan"
    period: str = "hari"
    # False = angka jawaban TIDAK lolos validasi DATA setelah retry —
    # frontend menampilkan peringatan jujur, bukan menyembunyikannya.
    numbers_validated: bool = True
    cached: bool = False
    retried: bool = False
    engine: str = "offline"  # nama model LLM atau "offline"
    outlet_id: str = ""
    outlet_name: str = ""


class ChatHistoryMessage(BaseModel):
    role: str  # USER | ASSISTANT
    content: str
    created_at: datetime


class HistoryResponse(BaseModel):
    messages: list[ChatHistoryMessage]
    total: int


class AssistantStatus(BaseModel):
    version: str
    llm_configured: bool
    llm_model: str | None
    mode: str  # "ai" | "data"
    rate_limit_per_hour: int
    cache_seconds: int
    # v3.2.0: kejujuran soal pembelajaran berkelanjutan — pemilik bisa
    # melihat bahwa model ramalan dilatih ulang otomatis di latar belakang.
    ml_auto_train: bool = True
    ml_auto_train_interval_hours: int = 6
    ml_gate_min_days: int = 28
    ml_gate_min_nonzero: int = 14


class LlmConfigIn(BaseModel):
    """Permintaan simpan pengaturan LLM (UI Pengaturan -> Asisten AI).

    base_url wajib berawalan http:// atau https:// saat enabled; model
    wajib terisi saat enabled; api_key BOLEH kosong (Ollama lokal).
    """
    enabled: bool = True
    base_url: str = Field(default="", max_length=200)
    api_key: str = Field(default="", max_length=200)
    model: str = Field(default="", max_length=100)


class LlmConfigOut(BaseModel):
    """Pengaturan LLM efektif — kunci TIDAK pernah dikirim utuh."""

    enabled: bool = False
    base_url: str = ""
    model: str = ""
    api_key_masked: str = ""
    # "file" = dari UI Pengaturan (volume mlmodels), "env" = compose/.env.
    source: str = "env"
    llm_configured: bool = False
    llm_model: str | None = None
    mode: str = "data"  # "ai" | "data"
