"""Forecasting endpoints (READ-ONLY database access).

GET /api/v1/forecast/revenue   - daily revenue history + weekday-seasonal forecast
GET /api/v1/forecast/products  - per-product 7-day demand forecast + restock advice

Sejak integrasi Tahap 4a (ml-service 1.0.0), kedua endpoint membaca tabel
milik backend-go: transactions, transaction_items, products (snake_case,
Rupiah BIGINT utuh). Pasca-v2.1.0 (era Go murni), identitas outlet juga
beralih ke tabel outlets milik Go — tabel PascalCase era Prisma sudah
tidak ada (lihat resolve_outlet). Per-outlet forecasting penuh (filter
outlet_id dari sesi pemanggil) menyusul di fase ML v3.0.0 bersama
training Prophet; saat ini seluruh data diasumsikan milik warung utama.

The forecast window starts TODAY: the owner asks in the morning and
gets today's expected full-day total plus the days after. To keep
that estimate honest the model never sees a day that is not over
yet — today's still-accumulating total would otherwise enter weekday
history as a partial (often zero) observation and drag its own
weekday's estimate down. Display history still includes today as a
live partial view.
"""

import math
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.models import Outlet, Product, Transaction, TransactionItem
from app.schemas.forecast import (
    DailyRevenue,
    ForecastPoint,
    ProductForecast,
    ProductsForecastResponse,
    RevenueForecastResponse,
)
from app.services.forecast import sum_forecast, weekday_forecast, zero_fill_daily

router = APIRouter(prefix="/forecast", tags=["Forecasting"])

# 8 weeks of history: enough same-weekday samples, stale trends ignored.
HISTORY_DAYS = 56

METHOD = "weekday-seasonal weighted average (up to 4 recent weeks)"


async def resolve_outlet(session: AsyncSession) -> tuple[str, str]:
    """Identitas warung dari tabel outlets milik backend-go.

    v2.1.0 menutup era Prisma: tabel PascalCase "Outlet" sudah di-DROP,
    jadi sumber satu-satunya adalah outlets milik Go (id BIGINT).
    Mengembalikan (outlet_id, outlet_name); ("", "Warung") bila tabel
    kosong — peramalan tetap jalan tanpa identitas outlet.
    """
    outlet = (
        await session.execute(
            select(Outlet)
            .where(Outlet.is_active.is_(True))
            .order_by(Outlet.created_at, Outlet.id)
        )
    ).scalars().first()
    if outlet is None:
        return ("", "Warung")
    return (str(outlet.id), outlet.name)


@router.get("/revenue", response_model=RevenueForecastResponse)
async def forecast_revenue(
    days: int = Query(default=30, ge=7, le=90),
    horizon: int = Query(default=7, ge=1, le=14),
    session: AsyncSession = Depends(get_session),
):
    outlet_id, outlet_name = await resolve_outlet(session)
    today = date.today()
    yesterday = today - timedelta(days=1)
    history_start = today - timedelta(days=HISTORY_DAYS - 1)
    view_start = today - timedelta(days=days - 1)

    rows = (
        await session.execute(
            select(
                func.date(Transaction.created_at).label("d"),
                func.sum(Transaction.total).label("revenue"),
                func.count(Transaction.id).label("trx"),
            )
            .where(
                Transaction.status == "COMPLETED",
                Transaction.created_at >= history_start,
            )
            .group_by(func.date(Transaction.created_at))
            .order_by(func.date(Transaction.created_at))
        )
    ).all()

    # Display history runs to today (live partial view)...
    series = zero_fill_daily([(r.d, r.revenue or 0) for r in rows], history_start, today)
    # ...while the model input stops at yesterday: an unfinished day
    # is not a zero-revenue day.
    model_series = zero_fill_daily(
        [(r.d, r.revenue or 0) for r in rows], history_start, yesterday
    )
    trx_by_date = {r.d: r.trx for r in rows}

    return RevenueForecastResponse(
        outlet_id=outlet_id,
        outlet_name=outlet_name,
        history_days=days,
        horizon_days=horizon,
        method=METHOD,
        history=[
            DailyRevenue(date=d, revenue=round(v, 2), transactions=trx_by_date.get(d, 0))
            for d, v in series
            if d >= view_start
        ],
        forecast=[ForecastPoint(**point) for point in weekday_forecast(model_series, horizon)],
    )


@router.get("/products", response_model=ProductsForecastResponse)
async def forecast_products(
    limit: int = Query(default=5, ge=1, le=20),
    session: AsyncSession = Depends(get_session),
):
    outlet_id, outlet_name = await resolve_outlet(session)
    today = date.today()
    yesterday = today - timedelta(days=1)
    history_start = today - timedelta(days=HISTORY_DAYS - 1)
    rank_start = today - timedelta(days=27)

    # Rank products by quantity sold in the last 28 days.
    rank_rows = (
        await session.execute(
            select(TransactionItem.product_id)
            .join(Transaction, TransactionItem.transaction_id == Transaction.id)
            .where(
                Transaction.status == "COMPLETED",
                Transaction.created_at >= rank_start,
            )
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
            outlet_id=outlet_id, outlet_name=outlet_name, products=[]
        )

    products = (
        await session.execute(select(Product).where(Product.id.in_(product_ids)))
    ).scalars().all()
    product_by_id = {p.id: p for p in products}

    # Daily quantity series per ranked product over the full history window.
    daily_rows = (
        await session.execute(
            select(
                TransactionItem.product_id,
                func.date(Transaction.created_at).label("d"),
                func.sum(TransactionItem.qty).label("qty"),
            )
            .join(Transaction, TransactionItem.transaction_id == Transaction.id)
            .where(
                Transaction.status == "COMPLETED",
                Transaction.created_at >= history_start,
                TransactionItem.product_id.in_(product_ids),
            )
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
        outlet_id=outlet_id, outlet_name=outlet_name, products=items
    )
