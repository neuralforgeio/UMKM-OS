"""Forecasting endpoints (READ-ONLY database access).

GET /api/v1/forecast/revenue   - daily revenue history + forecast (v3.0.0: engine ganda)
GET /api/v1/forecast/products  - per-product 7-day demand forecast + restock advice
GET /api/v1/forecast/models    - status model per outlet (konsol developer)

Sejak integrasi Tahap 4a (ml-service 1.0.0), endpoint membaca tabel milik
backend-go: transactions, transaction_items, products (snake_case, Rupiah
BIGINT utuh). Pasca-v2.1.0 (era Go murni), identitas outlet juga dari tabel
outlets milik Go. v3.0.0 menepati janji router lama: "Per-outlet
forecasting penuh ... di fase ML v3.0.0 bersama training Prophet".

Kontrak per-outlet v3.0.0:
  - `outlet_id` (opsional) memfilter transaksi TETAPI TIDAK mengubah
    bentuk respons. Tanpa param = agregat seluruh outlet (perilaku lama)
    dan jalur model dilewati (statistical in-line); model joblib memang
    milik satu outlet. Frontend owner kini selalu mengirim param ini.
  - Kolom transactions.outlet_id DITULIS Go saat INSERT (transaction.go)
    dan dipakai seluruh laporan per-outlet Go — filter di sini membaca
    kolom yang sama, satu sumber kebenaran.

The forecast window starts TODAY: the owner asks in the morning and
gets today's expected full-day total plus the days after. To keep
that estimate honest the model never sees a day that is not over
yet — today's still-accumulating total would otherwise enter weekday
history as a partial (often zero) observation and drag its own
weekday's estimate down. Display history still includes today as a
live partial view.

Engine ganda (ACC 2026-10-26):
  statistical in-line SELALU tersedia (fallback total); model Prophet
  per outlet dilatih LAZY di background (kunci per outlet + antrean
  serial, lihat app/ml/trainer.py) dan dipakai hanya bila menang duel
  backtest MAPE dengan margin >= 2pp. Permintaan TIDAK PERNAH menunggu
  training — respons pertama memakai statistical, respons berikutnya
  otomatis memakai Prophet bila ia memang menang duel.
"""

import math
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.ml import prophet_engine, trainer
from app.ml.store import ModelStore, TTL_HOURS
from app.models import Outlet, Product, Transaction, TransactionItem
from app.schemas.forecast import (
    DailyRevenue,
    ForecastPoint,
    ForecastQuality,
    ModelStatus,
    ModelsStatusResponse,
    ProductForecast,
    ProductsForecastResponse,
    RevenueForecastResponse,
)
from app.services.forecast import sum_forecast, weekday_forecast, zero_fill_daily

router = APIRouter(prefix="/forecast", tags=["Forecasting"])

# 8 weeks of history: enough same-weekday samples, stale trends ignored.
HISTORY_DAYS = 56

METHOD_STAT = "weekday-seasonal weighted average (up to 4 recent weeks)"
METHOD_STAT_WON = (
    "weekday-seasonal weighted average - menang duel backtest MAPE vs Prophet"
)
METHOD_PROPHET = (
    "Prophet per-outlet (musim mingguan + hari libur ID) - menang duel backtest MAPE"
)

_WEEKDAY_NAMES = (
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
)

# Store tunggal per proses (settings tidak berubah runtime).
_store: ModelStore | None = None


def get_store() -> ModelStore:
    global _store
    if _store is None:
        _store = ModelStore(settings.ML_MODEL_DIR)
    return _store


async def resolve_outlet(
    session: AsyncSession, outlet_id: str | None
) -> tuple[str, str]:
    """(outlet_id, outlet_name).

    Dengan `outlet_id` → outlet itu (404 bila tak ada / 400 bila bukan
    angka). Tanpa param → outlet aktif pertama (perilaku lama; hanya
    untuk NAMA — datanya tetap agregat seluruh outlet).
    """
    if outlet_id:
        try:
            oid = int(outlet_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="outlet_id harus angka")
        row = (
            await session.execute(select(Outlet).where(Outlet.id == oid))
        ).scalars().first()
        if row is None:
            raise HTTPException(
                status_code=404, detail=f"outlet {outlet_id} tidak ditemukan"
            )
        return (str(row.id), row.name)
    first = (
        await session.execute(
            select(Outlet)
            .where(Outlet.is_active.is_(True))
            .order_by(Outlet.created_at, Outlet.id)
        )
    ).scalars().first()
    if first is None:
        return ("", "Warung")
    return (str(first.id), first.name)


@router.get("/revenue", response_model=RevenueForecastResponse)
async def forecast_revenue(
    days: int = Query(default=30, ge=7, le=90),
    horizon: int = Query(default=7, ge=1, le=14),
    outlet_id: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    outlet_filter_id, outlet_name = await resolve_outlet(session, outlet_id)
    today = date.today()
    yesterday = today - timedelta(days=1)
    history_start = today - timedelta(days=HISTORY_DAYS - 1)
    model_start = today - timedelta(days=trainer.MODEL_WINDOW_DAYS - 1)
    view_start = today - timedelta(days=days - 1)

    conditions = [
        Transaction.status == "COMPLETED",
        Transaction.created_at >= model_start,
    ]
    scoped = bool(outlet_id) and bool(outlet_filter_id)
    if scoped:
        conditions.append(Transaction.outlet_id == int(outlet_filter_id))

    rows = (
        await session.execute(
            select(
                func.date(Transaction.created_at).label("d"),
                func.sum(Transaction.total).label("revenue"),
                func.count(Transaction.id).label("trx"),
            )
            .where(*conditions)
            .group_by(func.date(Transaction.created_at))
            .order_by(func.date(Transaction.created_at))
        )
    ).all()

    # Display history runs to today (live partial view)...
    series = zero_fill_daily([(r.d, r.revenue or 0) for r in rows], model_start, today)
    # ...while the model input stops at yesterday: an unfinished day
    # is not a zero-revenue day.
    model_series = zero_fill_daily(
        [(r.d, r.revenue or 0) for r in rows], model_start, yesterday
    )
    trx_by_date = {r.d: r.trx for r in rows}

    # ---- Engine ganda v3.0.0 -------------------------------------------
    # Model per outlet hanya untuk permintaan TER-SCOPE (deret = satu
    # outlet); permintaan agregat tetap statistical in-line.
    artifact = None
    if scoped:
        artifact = await trainer.ensure_model(
            outlet_filter_id,
            model_series,
            get_store(),
            prophet_enabled=settings.PROPHET_ENABLED,
        )

    quality: ForecastQuality | None = None
    if artifact is not None:
        quality = ForecastQuality(
            winner=artifact["winner"],
            mape_prophet=artifact["mape_prophet"],
            mape_statistical=artifact["mape_statistical"],
            margin_pp=artifact["margin_pp"],
            backtest_days=artifact["backtest_days"],
            train_days=artifact["train_days"],
            trained_at=artifact["trained_at"],
            trained_through=artifact["trained_through"],
        )

    points: list[ForecastPoint] | None = None
    engine = "statistical"
    method = METHOD_STAT
    if artifact is not None:
        method = METHOD_STAT_WON
    if artifact is not None and artifact["winner"] == "prophet":
        engine = "prophet"
        method = METHOD_PROPHET
        try:
            last_day = model_series[-1][0] if model_series else today
            future_dates = [
                last_day + timedelta(days=step) for step in range(1, horizon + 1)
            ]
            bands = prophet_engine.predict_with_bands(
                artifact["model"], future_dates
            )
            points = [
                ForecastPoint(
                    date=day,
                    weekday=_WEEKDAY_NAMES[day.weekday()],
                    point=point,
                    low=low,
                    high=high,
                )
                for day, (point, low, high) in zip(future_dates, bands)
            ]
        except Exception:
            # Prediksi model tersimpan gagal (mis. artefak korup) —
            # jalur statistical tidak pernah boleh ikut tumbang.
            points = None
            engine = "statistical"
            method = METHOD_STAT
    if points is None:
        points = [ForecastPoint(**p) for p in weekday_forecast(model_series, horizon)]

    return RevenueForecastResponse(
        outlet_id=outlet_filter_id,
        outlet_name=outlet_name,
        history_days=days,
        horizon_days=horizon,
        method=method,
        engine=engine,
        quality=quality,
        history=[
            DailyRevenue(date=d, revenue=round(v, 2), transactions=trx_by_date.get(d, 0))
            for d, v in series
            if d >= view_start
        ],
        forecast=points,
    )


@router.get("/products", response_model=ProductsForecastResponse)
async def forecast_products(
    limit: int = Query(default=5, ge=1, le=20),
    outlet_id: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    # Permintaan per produk TETAP statistical (keputusan desain v3.0.0):
    # deret permintaan per produk intermittent — banyak hari nol — dan
    # di wilayah itu rata-rata musiman weekday justru lebih kuat daripada
    # model aditif. Prophet hanya untuk revenue aggregate.
    outlet_filter_id, outlet_name = await resolve_outlet(session, outlet_id)
    today = date.today()
    yesterday = today - timedelta(days=1)
    history_start = today - timedelta(days=HISTORY_DAYS - 1)
    rank_start = today - timedelta(days=27)

    scoped = bool(outlet_id) and bool(outlet_filter_id)
    outlet_condition = (
        Transaction.outlet_id == int(outlet_filter_id) if scoped else None
    )

    # Rank products by quantity sold in the last 28 days.
    rank_conditions = [
        Transaction.status == "COMPLETED",
        Transaction.created_at >= rank_start,
    ]
    if outlet_condition is not None:
        rank_conditions.append(outlet_condition)
    rank_rows = (
        await session.execute(
            select(TransactionItem.product_id)
            .join(Transaction, TransactionItem.transaction_id == Transaction.id)
            .where(*rank_conditions)
            .group_by(TransactionItem.product_id)
            .order_by(func.sum(TransactionItem.qty).desc())
            .limit(limit)
        )
    ).all()
    # ID produk backend-go adalah BIGINT — dikirim ke frontend sebagai
    # string agar bentuk respons tidak berubah (klien lama pakai cuid).
    product_ids = [r.product_id for r in rank_rows]

    if not product_ids:
        return ProductsForecastResponse(
            outlet_id=outlet_filter_id, outlet_name=outlet_name, products=[]
        )

    products = (
        await session.execute(select(Product).where(Product.id.in_(product_ids)))
    ).scalars().all()
    product_by_id = {p.id: p for p in products}

    # Daily quantity series per ranked product over the full history window.
    daily_conditions = [
        Transaction.status == "COMPLETED",
        Transaction.created_at >= history_start,
        TransactionItem.product_id.in_(product_ids),
    ]
    if outlet_condition is not None:
        daily_conditions.append(outlet_condition)
    daily_rows = (
        await session.execute(
            select(
                TransactionItem.product_id,
                func.date(Transaction.created_at).label("d"),
                func.sum(TransactionItem.qty).label("qty"),
            )
            .join(Transaction, TransactionItem.transaction_id == Transaction.id)
            .where(*daily_conditions)
            .group_by(TransactionItem.product_id, func.date(Transaction.created_at))
        )
    ).all()

    series_by_product: dict[int, list[tuple[date, float]]] = {pid: [] for pid in product_ids}
    for row in daily_rows:
        series_by_product[row.product_id].append((row.d, row.qty or 0))

    items: list[ProductForecast] = []
    for pid in product_ids:
        product = product_by_id.get(pid)
        if product is None:
            continue
        # Model input ends yesterday — today is still being sold.
        filled = zero_fill_daily(series_by_product[pid], history_start, yesterday)
        point, low, high = sum_forecast(weekday_forecast(filled, 7))
        restock = max(0, math.ceil(point) - product.stock)
        items.append(
            ProductForecast(
                product_id=str(pid),
                name=product.name,
                unit=product.unit,
                current_stock=product.stock,
                min_stock=product.min_stock,
                forecast_7d_point=point,
                forecast_7d_low=low,
                forecast_7d_high=high,
                restock_suggestion=restock,
            )
        )

    return ProductsForecastResponse(
        outlet_id=outlet_filter_id, outlet_name=outlet_name, products=items
    )


@router.get("/models", response_model=ModelsStatusResponse)
async def forecast_models(
    session: AsyncSession = Depends(get_session),
):
    """Status jujur seluruh model — untuk konsol developer."""
    outlets = (
        await session.execute(
            select(Outlet)
            .where(Outlet.is_active.is_(True))
            .order_by(Outlet.created_at, Outlet.id)
        )
    ).scalars().all()

    store = get_store()
    models: list[ModelStatus] = []
    for outlet in outlets:
        artifact = store.load(str(outlet.id))
        if artifact is None:
            models.append(
                ModelStatus(
                    outlet_id=str(outlet.id),
                    outlet_name=outlet.name,
                    has_model=False,
                )
            )
            continue
        models.append(
            ModelStatus(
                outlet_id=str(outlet.id),
                outlet_name=outlet.name,
                has_model=True,
                winner=artifact.get("winner"),
                fresh=store.fresh(artifact),
                age_hours=store.age_hours(artifact),
                trained_at=artifact.get("trained_at"),
                mape_prophet=artifact.get("mape_prophet"),
                mape_statistical=artifact.get("mape_statistical"),
                backtest_days=artifact.get("backtest_days"),
            )
        )

    status = prophet_engine.prophet_status()
    return ModelsStatusResponse(
        prophet_available=status["available"],
        prophet_note=status["import_error"],
        prophet_enabled=settings.PROPHET_ENABLED,
        ttl_hours=TTL_HOURS,
        models=models,
    )
