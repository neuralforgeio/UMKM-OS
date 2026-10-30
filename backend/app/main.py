"""FastAPI application entrypoint.

Start the server (from the backend/ folder):
    python run.py            # reads HOST / PORT / DEBUG from .env

All business endpoints are versioned under {API_PREFIX}/{API_VERSION},
e.g. GET /api/v1/health.

v3.2.0: lifespan menyalankan AUTO-TRAIN latar belakang (app/ml/
auto_train.py) — model ramalan tiap outlet dilatih ulang menyeluruh
secara berkala (default tiap 6 jam, TTL artefak 12 jam) supaya selalu
menyerap penambahan data tanpa perintah apa pun. Saklar: ML_AUTO_TRAIN
=false mematikannya (mis. mesin sangat terbatas).
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import v1
from app.core.config import settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Nyalakan/mati sumber daya proses — tepat satu kali per hidup."""
    stop = asyncio.Event()
    task: asyncio.Task | None = None
    dev_task: asyncio.Task | None = None
    if settings.ML_AUTO_TRAIN:
        from app.ml import trainer as _trainer
        from app.ml.auto_train import auto_train_loop

        task = asyncio.create_task(auto_train_loop(stop))
        logger.info(
            "auto-train aktif: interval %s jam (gerbang %s hari / %s ber-pendapatan)",
            settings.ML_AUTO_TRAIN_INTERVAL_HOURS,
            _trainer.MIN_DAYS,
            _trainer.MIN_NONZERO,
        )
    # v2.7.0: pelaporan proaktif OSCAR Developer AI — loop latar
    # belakang memeriksa pemicu lintas toko (stok kritis gabungan /
    # omzet turun / toko diam / digest harian) dan menyimpan laporan
    # TANPA diminta. Saklar darurat: env OSCAR_DEV_PROACTIVE=0.
    try:
        from app.services.developer_report import proactive_loop

        dev_task = asyncio.create_task(proactive_loop())
        logger.info("pelaporan proaktif OSCAR Developer AI aktif")
    except Exception:
        dev_task = None
    try:
        yield
    finally:
        stop.set()
        if task is not None:
            await asyncio.gather(task, return_exceptions=True)
        if dev_task is not None:
            await asyncio.gather(dev_task, return_exceptions=True)


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    debug=settings.DEBUG,
    description="ML service (demand forecasting + RAG assistant) for UMKM OS",
    lifespan=lifespan,
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
