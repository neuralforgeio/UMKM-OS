// Pure SVG chart: revenue history (solid blue line + soft area) blending
// into the forecast (dashed emerald line inside a low-high band).
// Hand-rolled on purpose â€” zero chart dependencies, scales with the
// card width, and still looks fine in print/screenshots.
//
// Color language mirrors the owner dashboard: blue = actual data
// (same family as the "Penjualan 7 Hari" bars), emerald = prediction.
// v1.8.0: garis kisi, label sumbu, dan divider kini memakai kelas
// Tailwind stroke-/fill- sadar tema â€” heks hardcoded hanya untuk warna
// brand (biru/hijau) yang memang sama di kedua tema. Axis labels use compact units (rb / jt) because full formatRupiah
// values cannot fit; every money value shown in the surrounding card
// text still goes through formatRupiah (site-wide money contract).

import type { DailyRevenue, ForecastPoint } from "@/lib/forecast";

const W = 720;
const H = 230;
const PAD = { top: 16, right: 14, bottom: 30, left: 62 };

// Same compact formatter as app/owner/page.tsx â€” keep them identical
// so both charts label money the same way.
function compactRp(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)} rb`;
  return String(Math.round(value));
}

function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export default function ForecastChart({
  history,
  forecast,
}: {
  history: DailyRevenue[];
  forecast: ForecastPoint[];
}) {
  const hLen = history.length;
  const n = hLen + forecast.length;
  if (hLen === 0 || forecast.length === 0 || n < 2) return null;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const yMax =
    Math.max(
      1,
      ...history.map((d) => d.revenue),
      ...forecast.map((f) => f.high),
    ) * 1.1;

  const x = (i: number) => PAD.left + (i / (n - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH;
  const baseline = y(0);

  const historyPath = history
    .map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.revenue)}`)
    .join(" ");
  const areaPath = `${historyPath} L${x(hLen - 1)},${baseline} L${x(0)},${baseline} Z`;

  const lastRevenue = history[hLen - 1].revenue;
  const forecastPath = [
    `M${x(hLen - 1)},${y(lastRevenue)}`,
    ...forecast.map((f, j) => `L${x(hLen + j)},${y(f.point)}`),
  ].join(" ");

  // Uncertainty band: forward along the highs, back along the lows.
  const bandPolygon = [
    `${x(hLen - 1)},${y(lastRevenue)}`,
    ...forecast.map((f, j) => `${x(hLen + j)},${y(f.high)}`),
    ...forecast
      .map((f, j) => ({ f, j }))
      .reverse()
      .map(({ f, j }) => `${x(hLen + j)},${y(f.low)}`),
  ].join(" ");

  const gridValues = [yMax, (yMax * 2) / 3, yMax / 3];
  const labelIndices = Array.from({ length: n }, (_, i) => i).filter(
    (i) => i % 7 === 0 || i === n - 1,
  );
  const dividerX = (x(hLen - 1) + x(hLen)) / 2;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Grafik pendapatan harian dan ramalan 7 hari ke depan"
      className="h-auto w-full"
    >
      <defs>
        <linearGradient id="historyArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {gridValues.map((value, i) => (
        <g key={i}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(value)}
            y2={y(value)}
            className="stroke-slate-200 dark:stroke-slate-800"
            strokeWidth="1"
          />
          <text
            x={PAD.left - 8}
            y={y(value) + 3}
            textAnchor="end"
            fontSize="10"
            className="fill-slate-400 dark:fill-slate-500"
          >
            {compactRp(value)}
          </text>
        </g>
      ))}

      <path d={areaPath} fill="url(#historyArea)" />
      <path
        d={historyPath}
        fill="none"
        stroke="#2563eb"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polygon points={bandPolygon} fill="#10b981" fillOpacity="0.12" />
      <path
        d={forecastPath}
        fill="none"
        stroke="#059669"
        strokeWidth="2"
        strokeDasharray="6 5"
        strokeLinecap="round"
      />

      <line
        x1={dividerX}
        x2={dividerX}
        y1={PAD.top}
        y2={baseline}
        className="stroke-slate-300 dark:stroke-slate-700"
        strokeDasharray="4 4"
        strokeWidth="1"
      />
      <text x={dividerX + 6} y={PAD.top + 8} fontSize="10" className="fill-slate-400 dark:fill-slate-500">
        ramalan
      </text>

      {forecast.map((f, j) => (
        <circle
          key={f.date}
          cx={x(hLen + j)}
          cy={y(f.point)}
          r={j === 0 ? 4.5 : 3}
          className={
            j === 0
              ? "fill-emerald-600 stroke-emerald-600"
              : "fill-white stroke-emerald-600 dark:fill-slate-950"
          }
          strokeWidth="2"
        />
      ))}

      {labelIndices.map((i) => (
        <text
          key={i}
          x={x(i)}
          y={H - 8}
          textAnchor="middle"
          fontSize="10"
          className="fill-slate-400 dark:fill-slate-500"
        >
          {shortDate(i < hLen ? history[i].date : forecast[i - hLen].date)}
        </text>
      ))}
    </svg>
  );
}