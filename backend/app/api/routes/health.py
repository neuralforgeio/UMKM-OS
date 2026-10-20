"""Health-check endpoint.

Consumed by:
  - docker-compose healthcheck definitions
  - uptime monitoring in production
  - smoke tests in CI
"""

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()


@router.get("/health")
def health_check() -> dict:
    """Liveness probe — returns 200 as long as the process is up."""
    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }
