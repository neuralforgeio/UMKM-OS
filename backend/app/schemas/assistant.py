"""Skema request/response Asisten AI (ml-service v3.1.0).

Kontrak:
  - POST /assistant/chat    — tanya jawab (user_id + outlet_id dari
    pintu frontend ber-X-Internal-Key; layanan ML mempercayai gateway).
  - GET  /assistant/history — riwayat chat terakhir (tampilan panel).
  - GET  /assistant/status  — PUBLIK (tanpa key): mode, model, batas
    laju, versi — supaya konsol dev bisa memeriksa tanpa sesi.

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
