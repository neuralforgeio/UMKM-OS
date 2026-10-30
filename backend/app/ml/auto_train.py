"""Auto-training latar belakang (ml-service v3.2.0).

Jawaban atas keluhan pemilik: "saya ingin AI yang selalu terlatih
terus-menerus karena penambahan data, jangan training kecil-kecilan".

Cara kerja (bukan incremental kecil-kecilan — FULL RETRAIN berkala):
  - lifespan FastAPI menyalakan satu task latar saat boot;
  - setiap ML_AUTO_TRAIN_INTERVAL_HOURS (default 6 jam) task memanggil
    train_all_outlets(): seluruh outlet aktif diperiksa gerbangnya,
    lalu yang lulus DILATIH ULANG MENYELURUH atas seluruh jendela data
    180 hari (bukan patch tambahan) melalui trainer.ensure_model;
  - TTL artefak 12 jam menyeimbangkan: interval 6 jam x TTL 12 jam =
    model baru menyerap data kemarin ~2x sehari, pagi dan malam;
  - gerbang tetap berlaku (28 hari / 14 ber-pendapatan) — data kurang
    tidak dipaksa dilatih, tapi setiap hari dicek ulang OTOMATIS:
    begitu gerbang terpenuhi, model pertama muncul tanpa perintah siapa
    pun (dulu: hanya terlatih saat dashboard kebetulan dibuka);
  - jalur proteksi RAM lama tetap berdiri: antrean serial global +
    kunci per outlet di trainer.ensure_model; kegagalan satu outlet
    tidak menjatuhkan putaran.

Pemilik TIDAK PERNAH menunggu training: permintaan ramalan selalu
dijawab statistical in-line / artefak lama; model baru aktif mulai
permintaan berikutnya.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import session_factory
from app.ml import prophet_engine, trainer
from app.ml.store import ModelStore
from app.models import Outlet, Transaction
from app.services.forecast import zero_fill_daily

logger = logging.getLogger(__name__)


def _store() -> ModelStore:
    """Store tunggal putaran ini (fail-safe read-only bila FS kaku)."""
    return ModelStore(settings.ML_MODEL_DIR)


async def fetch_series(
    session: AsyncSession, outlet_id: int
) -> list[tuple[date, float]]:
    """Deret harian zero-filled jendela 180 hari berakhir KEMARIN.

    Logika SAMA PERSIS dengan GET /forecast/revenue (satu sumber
    kebenaran): hari berjalan tidak masuk deret model karena hari yang
    belum selesai bukan hari ber-omzet nol.
    """
    today = date.today()
    yesterday = today - timedelta(days=1)
    start = today - timedelta(days=trainer.MODEL_WINDOW_DAYS - 1)
    rows = (
        await session.execute(
            select(
                func.date(Transaction.created_at).label("d"),
                func.sum(Transaction.total).label("omzet"),
            )
            .where(
                Transaction.status == "COMPLETED",
                Transaction.created_at >= start,
                Transaction.outlet_id == outlet_id,
            )
            .group_by(func.date(Transaction.created_at))
            .order_by(func.date(Transaction.created_at))
        )
    ).all()
    return zero_fill_daily([(r.d, r.omzet or 0) for r in rows], start, yesterday)


async def train_all_outlets(store: ModelStore | None = None) -> dict:
    """Satu putaran: periksa gerbang + latih ulang tiap outlet aktif.

    Mengembalikan ringkasan {"status", "trained": [...], "skipped": [...]}
    untuk log / observabilitas. Tidak pernah melempar — kegagalan satu
    outlet dicatat lalu lanjut ke outlet berikutnya.
    """
    if not settings.PROPHET_ENABLED or not prophet_engine.PROPHET_AVAILABLE:
        return {"status": "skip", "trained": [], "skipped": []}
    if store is None:
        store = _store()

    trained: list[dict] = []
    skipped: list[dict] = []
    async with session_factory() as session:
        outlets = (
            await session.execute(
                select(Outlet)
                .where(Outlet.is_active.is_(True))
                .order_by(Outlet.created_at, Outlet.id)
            )
        ).scalars().all()
        for outlet in outlets:
            oid = str(outlet.id)
            try:
                series = await fetch_series(session, int(outlet.id))
            except Exception as exc:
                logger.warning(
                    "auto-train: gagal mengambil deret outlet %s: %r", oid, exc
                )
                continue
            gate = trainer.gate_status(series)
            if not gate["ok"]:
                skipped.append(
                    {"outlet_id": oid, "days": gate["days"],
                     "nonzero": gate["nonzero"]}
                )
                continue
            try:
                artifact = await trainer.ensure_model(
                    oid, series, store, prophet_enabled=True
                )
            except Exception as exc:
                logger.warning(
                    "auto-train: outlet %s gagal dilatih: %r", oid, exc
                )
                continue
            trained.append(
                {
                    "outlet_id": oid,
                    "winner": (artifact or {}).get("winner"),
                    "fresh": artifact is not None and store.fresh(artifact),
                }
            )
    return {"status": "ok", "trained": trained, "skipped": skipped}


def _interval_timeout() -> float:
    """Detik antar-putaran — fungsi terpisah agar test dapat mempercepat."""
    return float(settings.ML_AUTO_TRAIN_INTERVAL_HOURS * 3600)


async def auto_train_loop(stop: asyncio.Event) -> None:
    """Loop latar: tunggu start-delay, lalu putaran tiap interval.

    `stop` dibangunkan saat shutdown supaya container berhenti cepat;
    antar-putaran memakai wait_for(stop) — bukan sleep polos — agar
    sinyal berhenti tidak menunggu sisa interval.
    """
    await asyncio.sleep(settings.ML_AUTO_TRAIN_START_DELAY_S)
    while not stop.is_set():
        try:
            ringkasan = await train_all_outlets()
            logger.info("auto-train putaran: %r", ringkasan)
        except Exception as exc:  # pragma: no cover — jaring pengaman
            logger.warning("auto-train putaran gagal total: %r", exc)
        try:
            await asyncio.wait_for(stop.wait(), timeout=_interval_timeout())
        except asyncio.TimeoutError:
            pass  # interval habis -> putaran berikutnya
