// Server-side client for the FastAPI ML service (read-only, S5).
//
// The base URL is a SERVER-ONLY env var (no NEXT_PUBLIC_ prefix): the
// browser never calls FastAPI directly — this module runs inside
// server components only, which also makes CORS irrelevant here.
// The default points at the local dev server started with `python run.py`.
//
// Every failure path returns null instead of throwing, so the
// dashboard keeps rendering when the ML service is down (ForecastSection
// shows a graceful fallback card in that case).

const BASE_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

// Forecast responses are cached for 15 minutes: the numbers barely
// move, and the backend is shielded from per-request load.
const REVALIDATE_SECONDS = 900;

export interface DailyRevenue {
  date: string; // ISO date, e.g. "2026-10-21"
  revenue: number;
  transactions: number;
}

export interface ForecastPoint {
  date: string;
  weekday: string; // English weekday from the API; mapped to ID in the UI
  point: number;
  low: number;
  high: number;
}

export interface RevenueForecastResponse {
  outlet_id: string;
  outlet_name: string;
  history_days: number;
  horizon_days: number;
  method: string;
  history: DailyRevenue[];
  forecast: ForecastPoint[];
}

export interface ProductForecast {
  product_id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  forecast_7d_point: number;
  forecast_7d_low: number;
  forecast_7d_high: number;
  restock_suggestion: number;
}

export interface ProductsForecastResponse {
  outlet_id: string;
  outlet_name: string;
  products: ProductForecast[];
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Network error / backend down — the widget renders its fallback
    // instead of taking the whole dashboard page down with it.
    return null;
  }
}

export function getRevenueForecast(days = 30, horizon = 7) {
  return getJson<RevenueForecastResponse>(
    `/api/v1/forecast/revenue?days=${days}&horizon=${horizon}`,
  );
}

export function getProductsForecast(limit = 5) {
  return getJson<ProductsForecastResponse>(
    `/api/v1/forecast/products?limit=${limit}`,
  );
}
