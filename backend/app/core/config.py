"""
Application configuration.

Every runtime value is loaded from environment variables (or a local
`.env` file) so that no credential is ever hard-coded in source code:

  1. Copy `backend/.env.example` to `backend/.env`
  2. Fill in the values for your environment
  3. `.env` is git-ignored; `.env.example` is committed as documentation

"""

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import BeforeValidator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

def parse_cors_origins(value):
    """Allow CORS origins to be written as a comma-separated string.

    Example (in .env):
        CORS_ORIGINS=http://localhost:3000,http://localhost:3001
    """
    if isinstance(value, str):
        return [origin.strip() for origin in value.split(",") if origin.strip()]
    return value

class Settings(BaseSettings):
    """Single source of truth for every configurable value of the service."""

    # ------------------------------------------------------------------
    # Service identity
    # ------------------------------------------------------------------
    APP_NAME: str = "UMKM OS Backend"
    # Semantic Versioning — 3.3.0 = OSCAR: persona berganti nama (OSCAR
    # — Online Shop Center for Assistance & Response), obrolan hidup
    # (owalah/gitu ya dijawab reaksi, bukan template), pola jam ramai,
    # estimasi hari stok habis + kecepatan laku, prompt gaya campuran
    # + aturan pertanyaan lanjutan dari riwayat. (3.2.0 = Asisten
    # Cerdas: NLU per-maksud; 3.1.1 = hotfix created_at chat_history;
    # 3.1.0 = Asisten AI RAG; 3.0.0 = engine ganda Prophet; 2.0.0
    # sengaja dilewati menepati janji router v1.)
    VERSION: str = "3.3.0"

    # Running mode: development | production | test
    ENVIRONMENT: Literal["development", "production", "test"] = "development"

    # Auto-reload + verbose errors. ALWAYS false in production.
    DEBUG: bool = True

    # ------------------------------------------------------------------
    # API routing
    # ------------------------------------------------------------------
    # Every endpoint lives under {API_PREFIX}/{API_VERSION}/* (e.g. /api/v1/*).
    # When a breaking change is needed later, add a v2 aggregator alongside
    # and keep v1 alive during the migration window.
    API_PREFIX: str = "/api"
    API_VERSION: str = "v1"

    # ------------------------------------------------------------------
    # HTTP server
    # ------------------------------------------------------------------
    # 127.0.0.1 for local development; must be 0.0.0.0 inside Docker.
    HOST: str = "127.0.0.1"
    PORT: int = 8000

    # ------------------------------------------------------------------
    # Database (REQUIRED — no default value on purpose).
    # The ML service has READ-ONLY access; the schema is owned by Prisma
    # on the frontend side. Expected format (async driver — core/database.py
    # builds an ASYNC engine):
    #   postgresql+psycopg_async://USER:PASSWORD@HOST:PORT/DBNAME
    # ------------------------------------------------------------------
    DATABASE_URL: str

    # ------------------------------------------------------------------
    # Security
    # ------------------------------------------------------------------
    # Origins allowed to call this API (CORS). Comma-separated in .env.
    # NoDecode: tell pydantic-settings NOT to json.loads the raw string;
    # BeforeValidator then splits it into a list of origins.
    CORS_ORIGINS: Annotated[
        list[str],
        NoDecode,
        BeforeValidator(parse_cors_origins),
    ] = ["http://localhost:3000"]

    # ------------------------------------------------------------------
    # ML v3.0.0 — engine Prophet per-outlet
    # ------------------------------------------------------------------
    # Saklar total jalur Prophet: false = murni statistical (ramalan
    # tetap jalan, tanpa training, tanpa joblib). Import prophet yang
    # gagal pun otomatis mem-fallback ke jalur ini (lihat
    # app/ml/prophet_engine.py).
    PROPHET_ENABLED: bool = True
    # Direktori artefak model (joblib) per outlet. Default relatif ke
    # direktori kerja: lokal = backend/mlmodels, docker = /app/mlmodels
    # (volume bernama "mlmodels" di docker-compose.yml).
    ML_MODEL_DIR: str = "mlmodels"

    # v3.2.0 — AUTO-TRAIN latar belakang: model ramalan tiap outlet
    # dilatih ulang MENYELURUH berkala (default tiap 6 jam; TTL artefak
    # 12 jam) supaya selalu menyerap penambahan data tanpa perintah.
    # ML_AUTO_TRAIN=false mematikan loop (mis. mesin sangat terbatas);
    # delay boot memberi waktu backend-go menyelesaikan migrasi schema.
    ML_AUTO_TRAIN: bool = True
    ML_AUTO_TRAIN_INTERVAL_HOURS: int = 6
    ML_AUTO_TRAIN_START_DELAY_S: int = 90

    # ------------------------------------------------------------------
    # Asisten AI v3.1.0 — LLM opsional + gerbang + batas biaya
    # ------------------------------------------------------------------
    # Semua kosong = Mode Data (jawaban template tanpa LLM). Endpoint
    # standar {LLM_BASE_URL}/chat/completions => agnostik penyedia
    # (OpenAI / Groq / Together / OpenRouter / Ollama lokal).
    LLM_ENABLED: bool = True
    LLM_BASE_URL: str = ""
    LLM_API_KEY: str = ""
    LLM_MODEL: str = ""
    # Batas laju per pengguna (sliding window 1 jam) & TTL cache
    # jawaban — mitigasi biaya blueprint BAB 9.3.
    ASSISTANT_RATE_LIMIT_PER_HOUR: int = 12
    ASSISTANT_CACHE_SECONDS: int = 600
    # Kunci antar-layanan (blueprint BAB 5.4): frontend mengirim
    # X-Internal-Key ini ke /assistant/chat & /history. Kosong =
    # terbuka (dev lokal tanpa docker); compose mengisi dari AUTH_SECRET.
    INTERNAL_API_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",          # resolved relative to the working dir
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",           # tolerate unrelated vars (e.g. POSTGRES_*)
    )

    @property
    def versioned_prefix(self) -> str:
        """Full mount path of the current API version, e.g. '/api/v1'."""
        return f"{self.API_PREFIX}/{self.API_VERSION}"

@lru_cache
def get_settings() -> Settings:
    """Build Settings once per process and cache the instance."""
    return Settings()

# Module-level singleton — import this everywhere:
#   from app.core.config import settings
settings = get_settings()
