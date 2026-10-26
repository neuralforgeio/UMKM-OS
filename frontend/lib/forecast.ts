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
//
// v2.3.0 (ML v3.0.0): getRevenueForecast/getProductsForecast kini
// mengirim outlet_id sesi pemanggil (identitas outlet dari
// lib/outlet-context) sehingga backend bisa memakai model Prophet per
// outlet. Respons revenue membawa `engine` ("prophet" | "statistical")
// dan `quality` (hasil duel backtest MAPE) — badge di ForecastSection
// menampilkan keduanya sebagai bukti mesin mana yang sedang menang.

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

// v2.3.0 — hasil duel backtest MAPE antara Prophet dan statistical.
// Semua nilai dilaporkan apa adanya oleh backend; null = tidak
// terdefinisi (mis. MAPE Prophet saat prophet gagal di-backtest).
export interface ForecastQuality {
  winner: "prophet" | "statistical";
  mape_prophet: number | null;
  mape_statistical: number | null;
  margin_pp: number | null;
  backtest_days: number;
  train_days: number;
  trained_at: string;
  trained_through: string;
}

export interface RevenueForecastResponse {
  outlet_id: string;
  outlet_name: string;
  history_days: number;
  horizon_days: number;
  method: string;
  // v2.3.0 — mesin yang benar-benar menghasilkan deret `forecast`.
  engine?: "prophet" | "statistical";
  quality?: ForecastQuality | null;
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

// outletId opsional: tanpa identitas outlet (sesi tanpa token Go),
// panggilan tetap jalan sebagai agregat lama di sisi backend.
function outletParam(outletId?: number): string {
  return outletId != null && Number.isFinite(outletId)
    ? `&outlet_id=${encodeURIComponent(String(outletId))}`
    : "";
}

export function getRevenueForecast(days = 30, horizon = 7, outletId?: number) {
  return getJson<RevenueForecastResponse>(
    `/api/v1/forecast/revenue?days=${days}&horizon=${horizon}${outletParam(outletId)}`,
  );
}

export function getProductsForecast(limit = 5, outletId?: number) {
  return getJson<ProductsForecastResponse>(
    `/api/v1/forecast/products?limit=${limit}${outletParam(outletId)}`,
  );
}
