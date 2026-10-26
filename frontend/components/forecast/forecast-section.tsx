// "Ramalan Pendapatan" dashboard section (S5).
//
// One async server component that fetches BOTH ML endpoints in
// parallel, then renders: the revenue card (period total, live-today
// chip, SVG chart, per-day breakdown) and the ML restock suggestions
// card. When the FastAPI service is unreachable it degrades into a
// hint card instead of breaking the whole dashboard.
//
// Styling mirrors app/owner/page.tsx exactly — rounded-2xl bg-white
// p-5 shadow-sm cards, small bold headings, decorative icon top-right
// — so the widget reads as a native part of the dashboard. Color
// language: blue = actual (history), emerald = prediction (forecast).
//
// Money contract: every Rupiah amount rendered as text goes through
// formatRupiah() — the single site-wide formatter. Only chart axis
// labels and the tiny per-cell ranges use compact units (rb/jt),
// because full values do not fit; hovering a cell (title attribute)
// still reveals the full formatRupiah range.

import type {
  ForecastPoint,
  ForecastQuality,
  ProductForecast,
  ProductsForecastResponse,
  RevenueForecastResponse,
} from "@/lib/forecast";
import { getProductsForecast, getRevenueForecast } from "@/lib/forecast";
import { formatRupiah } from "@/lib/format";
import { getOutletContext } from "@/lib/outlet-context";
import ForecastChart from "./forecast-chart";

const WEEKDAY_ID: Record<string, string> = {
  Monday: "Senin",
  Tuesday: "Selasa",
  Wednesday: "Rabu",
  Thursday: "Kamis",
  Friday: "Jumat",
  Saturday: "Sabtu",
  Sunday: "Minggu",
};

// Same compact formatter as app/owner/page.tsx.
function compactRp(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)} rb`;
  return String(Math.round(value));
}

function sumTotals(forecast: ForecastPoint[]) {
  const sum = (pick: (f: ForecastPoint) => number) =>
    Math.round(forecast.reduce((acc, f) => acc + pick(f), 0));
  return {
    point: sum((f) => f.point),
    low: sum((f) => f.low),
    high: sum((f) => f.high),
  };
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m22 7-8.5 8.5-5-5L2 17" />
      <path d="M16 7h6v6" />
    </svg>
  );
}

function PackageIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

function PlugIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 7V4M15 7V4" />
      <path d="M7 7h10v4a5 5 0 0 1-10 0V7z" />
      <path d="M12 16v4" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function BackendDown() {
  return (
    <div className="rounded-2xl glass-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Ramalan Pendapatan
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Layanan ML (FastAPI) belum berjalan
          </p>
        </div>
        <PlugIcon className="h-5 w-5 shrink-0 text-slate-300" />
      </div>
      <div className="mt-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4 py-10 text-center">
        <p className="text-sm text-slate-400 dark:text-slate-500">
          Widget ramalan akan muncul otomatis setelah backend dinyalakan.
        </p>
        <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
          Jalankan dari folder{" "}
          <code className="rounded bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 text-[11px]">
            backend
          </code>
          :{" "}
          <code className="rounded bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 text-[11px]">
            python run.py
          </code>
        </p>
      </div>
    </div>
  );
}

// v2.3.0 — badge engine ramalan: bukti visual mesin mana yang sedang
// menang duel backtest MAPE (Prophet vs statistik) untuk outlet ini.
function formatMapeId(value: number): string {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function EngineBadge({
  engine,
  quality,
}: {
  engine?: "prophet" | "statistical";
  quality?: ForecastQuality | null;
}) {
  const isProphet = engine === "prophet";
  const winnerMape = quality
    ? isProphet
      ? quality.mape_prophet
      : quality.mape_statistical
    : null;
  const mapeProphet =
    quality?.mape_prophet != null ? formatMapeId(quality.mape_prophet) : "n/a";
  const mapeStatistik =
    quality?.mape_statistical != null
      ? formatMapeId(quality.mape_statistical)
      : "n/a";
  const title = quality
    ? `Duel backtest ${quality.backtest_days} hari — Prophet MAPE ${mapeProphet} vs statistik ${mapeStatistik}; pemenang: ${quality.winner}.`
    : isProphet
      ? "Ramalan Prophet per-outlet."
      : "Rata-rata musiman hari-minggu (hingga 4 minggu terakhir).";
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
        isProphet
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      }`}
    >
      {isProphet ? "Prophet" : "Statistik"}
      {winnerMape != null ? ` · MAPE ${formatMapeId(winnerMape)}` : ""}
    </span>
  );
}

function RevenueCard({ data }: { data: RevenueForecastResponse }) {
  // The API history includes today as a LIVE partial row while the
  // forecast also starts today — drop the duplicate from the chart
  // input so the x-axis stays continuous, but keep it as a chip.
  const duplicatedToday =
    data.forecast.length > 0 &&
    data.history.length > 0 &&
    data.history[data.history.length - 1].date === data.forecast[0].date;
  const chartHistory = duplicatedToday
    ? data.history.slice(0, -1)
    : data.history;
  const today = duplicatedToday ? data.history[data.history.length - 1] : null;
  const totals = sumTotals(data.forecast);

  if (data.forecast.length === 0) {
    return (
      <div className="rounded-2xl glass-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Ramalan Pendapatan
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {data.outlet_name} · {data.horizon_days} hari ke depan
            </p>
          </div>
          <SparkIcon className="h-5 w-5 shrink-0 text-slate-300" />
        </div>
        <div className="mt-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
          Belum ada data penjualan untuk diramal.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl glass-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Ramalan Pendapatan
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {data.outlet_name} · {data.horizon_days} hari ke depan
          </p>
          <div className="mt-1.5">
            <EngineBadge engine={data.engine} quality={data.quality} />
          </div>
        </div>
        <SparkIcon className="h-5 w-5 shrink-0 text-slate-300" />
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatRupiah(totals.point)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Rentang konservatif{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {formatRupiah(totals.low)}
            </span>
            {" – "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {formatRupiah(totals.high)}
            </span>
          </p>
        </div>
        {today && today.transactions > 0 && (
          <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            Hari ini {formatRupiah(Math.round(today.revenue))} ·{" "}
            {today.transactions} trx
          </span>
        )}
      </div>

      <div className="mt-3">
        <ForecastChart history={chartHistory} forecast={data.forecast} />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {data.forecast.map((f, i) => (
          <div
            key={f.date}
            title={`${i === 0 ? "Hari ini" : (WEEKDAY_ID[f.weekday] ?? f.weekday)}: ${formatRupiah(Math.round(f.low))} – ${formatRupiah(Math.round(f.high))}`}
            className={`rounded-lg border px-2 py-2 text-center ${
              i === 0 ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 " : "border-slate-200 dark:border-slate-800"
            }`}
          >
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {i === 0 ? "Hari ini" : (WEEKDAY_ID[f.weekday] ?? f.weekday)}
            </p>
            <p className="mt-0.5 truncate text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {formatRupiah(Math.round(f.point))}
            </p>
            <p className="truncate text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
              {compactRp(f.low)}–{compactRp(f.high)}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">{data.method}</p>
    </div>
  );
}

function RestockRow({ p }: { p: ProductForecast }) {
  const needed = Math.max(1, Math.ceil(p.forecast_7d_point));
  const coverage = Math.min(100, (p.current_stock / needed) * 100);
  const safe = p.restock_suggestion <= 0;
  const critical = p.current_stock <= p.min_stock;

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
          {p.name}
          <span className="ml-1 text-xs font-normal text-slate-400 dark:text-slate-500">
            / {p.unit}
          </span>
        </p>
        {safe ? (
          <span className="shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            Stok aman
          </span>
        ) : (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              critical ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 " : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 "
            }`}
          >
            Belanja +{p.restock_suggestion} {p.unit}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-3">
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900">
          <div
            className={`h-full rounded-full ${safe ? "bg-emerald-500" : "bg-amber-500"}`}
            style={{ width: `${coverage}%` }}
          />
        </div>
        <p className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
          stok{" "}
          <span className="font-semibold text-slate-600 dark:text-slate-400">
            {p.current_stock}
          </span>{" "}
          · perkiraan{" "}
          <span className="font-semibold text-slate-600 dark:text-slate-400">{needed}</span>
        </p>
      </div>
    </div>
  );
}

function RestockCard({ data }: { data: ProductsForecastResponse }) {
  const sorted = [...data.products].sort(
    (a, b) => b.restock_suggestion - a.restock_suggestion,
  );
  const anyRestock = sorted.some((p) => p.restock_suggestion > 0);

  return (
    <div className="flex h-full flex-col rounded-2xl glass-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Saran Restock (ML)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Perkiraan permintaan 7 hari ke depan
          </p>
        </div>
        {anyRestock ? (
          <span className="shrink-0 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
            {sorted.filter((p) => p.restock_suggestion > 0).length} produk
          </span>
        ) : (
          <PackageIcon className="h-5 w-5 shrink-0 text-slate-300" />
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
          Belum ada data penjualan produk untuk dianalisis.
        </div>
      ) : anyRestock ? (
        <div className="mt-2 divide-y divide-slate-100">
          {sorted.map((p) => (
            <RestockRow key={p.product_id} p={p} />
          ))}
        </div>
      ) : (
        <div className="mt-4 flex flex-1 items-center gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3.5">
          <CheckIcon className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            Semua stok cukup untuk 7 hari ke depan.
          </p>
        </div>
      )}
    </div>
  );
}

export default async function ForecastSection() {
  // v2.3.0 — identitas outlet sesi: model Prophet memang per-outlet.
  // Tanpa identitas (sesi tanpa token Go / layanan outlet mati),
  // panggilan tetap jalan sebagai agregat lama di sisi backend.
  const outlet = await getOutletContext();
  const [revenue, products] = await Promise.all([
    getRevenueForecast(30, 7, outlet?.id),
    getProductsForecast(5, outlet?.id),
  ]);

  if (!revenue && !products) {
    return <BackendDown />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {revenue ? <RevenueCard data={revenue} /> : <BackendDown />}
      </div>
      <div className="lg:col-span-1">
        {products ? <RestockCard data={products} /> : <BackendDown />}
      </div>
    </div>
  );
}