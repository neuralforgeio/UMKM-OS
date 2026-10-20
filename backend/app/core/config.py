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
    VERSION: str = "0.1.0"

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
    # on the frontend side. Expected format:
    #   postgresql+psycopg://USER:PASSWORD@HOST:PORT/DBNAME
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
