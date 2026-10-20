"""FastAPI application entrypoint.

Start the server (from the backend/ folder):
    python run.py            # reads HOST / PORT / DEBUG from .env

All business endpoints are versioned under {API_PREFIX}/{API_VERSION},
e.g. GET /api/v1/health.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import v1
from app.core.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    debug=settings.DEBUG,
    description="ML service (demand forecasting + RAG assistant) for UMKM OS",
)

# Restrict cross-origin calls to the trusted list defined in .env
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Versioned routers: every endpoint lives under /api/v1
app.include_router(v1.router, prefix=settings.versioned_prefix)


@app.get("/", tags=["root"])
def root() -> dict:
    """Service banner — handy when opening the root URL in a browser."""
    return {
        "service": settings.APP_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "api": settings.versioned_prefix,
        "docs": "/docs",
    }
