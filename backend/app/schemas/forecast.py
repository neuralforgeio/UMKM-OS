"""Pydantic response models for the forecasting endpoints.

v3.0.0 — engine ganda per-outlet:
  - RevenueForecastResponse membawa `engine` ("prophet" | "statistical")
    dan `quality` (hasil duel backtest MAPE; None bila gerbang data gagal
    sehingga tidak pernah ada duel). Field baru semuanya opsional/ber-
    default agar klien lama tetap aman.
  - ModelStatus/ModelsStatusResponse melayani GET /forecast/models
    (konsol developer: usia model, MAPE, ketersediaan Prophet).
"""

from datetime import date

from pydantic import BaseModel


class DailyRevenue(BaseModel):
    date: date
    revenue: float
    transactions: int


class ForecastPoint(BaseModel):
    date: date
    weekday: str
    point: float
    low: float
    high: float


class ForecastQuality(BaseModel):
    """Hasil duel backtest — dilaporkan apa adanya, tanpa dijanjikan."""

    winner: str
    mape_prophet: float | None = None
    mape_statistical: float | None = None
    margin_pp: float | None = None
    backtest_days: int
    train_days: int
    trained_at: str  # ISO UTC
    trained_through: str  # tanggal data terakhir yang dilatih


class RevenueForecastResponse(BaseModel):
    outlet_id: str
    outlet_name: str
    history_days: int
    horizon_days: int
    method: str
    # v3.0.0: mesin yang benar-benar menghasilkan `forecast`.
    engine: str = "statistical"
    quality: ForecastQuality | None = None
    history: list[DailyRevenue]
    forecast: list[ForecastPoint]


class ProductForecast(BaseModel):
    product_id: str
    name: str
    unit: str
    current_stock: int
    min_stock: int
    forecast_7d_point: float
    forecast_7d_low: float
    forecast_7d_high: float
    restock_suggestion: int


class ProductsForecastResponse(BaseModel):
    outlet_id: str
    outlet_name: str
    products: list[ProductForecast]


class ModelStatus(BaseModel):
    """Status satu outlet — modelnya ada atau belum, dan sehat tidaknya."""

    outlet_id: str
    outlet_name: str
    has_model: bool
    winner: str | None = None
    fresh: bool | None = None
    age_hours: float | None = None
    trained_at: str | None = None
    mape_prophet: float | None = None
    mape_statistical: float | None = None
    backtest_days: int | None = None


class ModelsStatusResponse(BaseModel):
    prophet_available: bool
    prophet_note: str | None = None  # pesan error import, bila gagal
    prophet_enabled: bool
    ttl_hours: int
    models: list[ModelStatus]
