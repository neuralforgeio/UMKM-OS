"""Pydantic response models for the forecasting endpoints."""

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


class RevenueForecastResponse(BaseModel):
    outlet_id: str
    outlet_name: str
    history_days: int
    horizon_days: int
    method: str
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
