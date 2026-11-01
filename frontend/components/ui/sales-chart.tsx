"use client";

// Grafik tren penjualan UMKM OS v1.0.0, SVG murni buatan sendiri.
//
// Menerima titik data (label + nilai) dari server component, menggambar
// garis dengan animasi mengalir (stroke-dashoffset), area bergradasi,
// garis bantu, dan titik berujudul (tooltip asli SVG) per hari. Semua
// angka berasal dari data nyata yang dikirim backend.

import { useMemo } from "react";

export type ChartPoint = { label: string; value: number };

function ringkas(nilai: number): string {
  if (nilai >= 1_000_000) {
    return `${(nilai / 1_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} jt`;
  }
  if (nilai >= 1_000) return `${Math.round(nilai / 1_000)} rb`;
  return String(Math.round(nilai));
}

const LEBAR = 700;
const TINGGI = 190;
const KIRI = 46;
const BAWAH = 172;
const ATAS = 22;

export function SalesChart({
  points,
  ariaLabel = "Grafik penjualan",
}: {
  points: ChartPoint[];
  ariaLabel?: string;
}) {
  const geometri = useMemo(() => {
    const n = Math.max(points.length, 2);
    const maks = Math.max(...points.map((p) => p.value), 1);
    const langkah = (LEBAR - KIRI - 24) / (n - 1);
    const x = (i: number) => KIRI + i * langkah;
    const y = (v: number) =>
      BAWAH - (v / maks) * (BAWAH - ATAS);
    const koordinat = points.map((p, i) => ({ x: x(i), y: y(p.value) }));
    const garis = koordinat
      .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(" ");
    const area = `${garis} L${koordinat[koordinat.length - 1]?.x.toFixed(1) ?? KIRI} ${BAWAH} L${KIRI} ${BAWAH} Z`;
    // Perkiraan panjang garis untuk animasi aliran (akumulasi jarak).
    let panjang = 0;
    for (let i = 1; i < koordinat.length; i += 1) {
      panjang += Math.hypot(
        koordinat[i].x - koordinat[i - 1].x,
        koordinat[i].y - koordinat[i - 1].y);
    }
    return { koordinat, garis, area, panjang: Math.ceil(panjang) + 8, maks };
  }, [points]);

  const labelY = [1, 0.66, 0.33, 0].map(
    (rasio) => BAWAH - rasio * (BAWAH - ATAS));
  const labelNilai = [1, 0.66, 0.33, 0].map((rasio) =>
    ringkas(Math.round(geometri.maks * rasio)));

  return (
    <svg
      viewBox={`0 0 ${LEBAR} ${TINGGI}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
      className="h-[190px] w-full overflow-visible"
    >
      <defs>
        <linearGradient id="areaGrafik" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--shell-primary)" stopOpacity="0.26" />
          <stop offset="100%" stopColor="var(--shell-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {labelY.map((y, i) => (
        <line
          key={i}
          className="stroke-shell-line"
          strokeWidth="1"
          strokeDasharray="3 5"
          x1={KIRI}
          x2={LEBAR - 8}
          y1={y}
          y2={y}
        />
      ))}
      {labelY.map((y, i) => (
        <text
          key={`teks-${i}`}
          x={0}
          y={y + 3}
          className="fill-shell-muted"
          style={{ fontSize: 9 }}
        >
          {labelNilai[i]}
        </text>
      ))}
      <path d={geometri.area} fill="url(#areaGrafik)" />
      <path
        d={geometri.garis}
        fill="none"
        stroke="var(--shell-primary)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animate-chart-line"
        style={{ ["--panjang-garis" as string]: `${geometri.panjang}` }}
      />
      {points.map((p, i) => (
        <circle
          key={p.label + i}
          cx={geometri.koordinat[i].x}
          cy={geometri.koordinat[i].y}
          r="4.5"
          className="fill-shell-primary-strong stroke-shell-card"
          strokeWidth="3"
        >
          <title>{`${p.label}: ${p.value.toLocaleString("id-ID")}`}</title>
        </circle>
      ))}
      {points.map((p, i) => (
        <text
          key={`label-${p.label}-${i}`}
          x={geometri.koordinat[i].x}
          y={TINGGI - 6}
          textAnchor="middle"
          className="fill-shell-muted"
          style={{ fontSize: 9 }}
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}
