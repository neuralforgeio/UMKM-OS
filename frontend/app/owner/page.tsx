import Link from "next/link";
import { redirect } from "next/navigation";
import { PackagePlus, Settings, ShieldCheck, ReceiptText } from "lucide-react";
import ForecastSection from "@/components/forecast/forecast-section";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { goFetch } from "@/lib/api";
import { formatRupiah } from "@/lib/format";

export const instant = false;

// =====================================================================
// Dashboard owner — Tahap 4a (frontend v1.0.0, file dilengkapi di v1.0.1).
//
// SELURUH angka statistik kini datang dari backend-go lewat satu
// panggilan GET /api/v1/reports/dashboard: ringkasan hari ini & kemarin,
// grafik 7 hari (gap-free), porsi metode pembayaran, 5 produk terlaris,
// stok menipis + saran restok, dan 6 transaksi terbaru. Frontend tidak
// lagi menghitung agregat sendiri — PostgreSQL tetap satu-satunya sumber
// data lewat tangan Go, dan kasir/owner/peluncur melihat angka yang sama.
//
// Satu-satunya yang masih Prisma: identitas outlet (nama & logo) untuk
// header — pindah ke backend-go menyusul pada fase multi-outlet.
// =====================================================================

// Compact chart labels: 1250000 -> "1,3 jt", 45000 -> "45 rb".
const compactRp = (value: number) => {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)} rb`;
  return String(Math.round(value));
};

const METHOD_META = [
  {
    key: "CASH",
    label: "Tunai",
    dot: "bg-blue-500",
    bar: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700",
  },
  {
    key: "QRIS",
    label: "QRIS",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700",
  },
  {
    key: "DEBIT",
    label: "Debit",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700",
  },
] as const;

function StorefrontIcon({ className }: { className?: string }) {
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
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <path d="M2 7h20" />
    </svg>
  );
}

function TrendUpIcon({ className }: { className?: string }) {
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
      <path d="m22 7-8.5 8.5-5-5L2 17" />
      <path d="M16 7h6v6" />
    </svg>
  );
}

function TrendDownIcon({ className }: { className?: string }) {
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
      <path d="m22 17-8.5-8.5-5 5L2 7" />
      <path d="M16 17h6v-6" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
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
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

function ReceiptIcon({ className }: { className?: string }) {
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
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 17.5v-11" />
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

function BasketIcon({ className }: { className?: string }) {
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
      <path d="m15 11-1 9" />
      <path d="m19 11-4-7" />
      <path d="M2 11h20" />
      <path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4" />
      <path d="m4.5 15.15 2.75-2.22 3 2.5 3.5-3 3.25 2.5" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
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
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}

function TrophyIcon({ className }: { className?: string }) {
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
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
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
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
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
      <path d="M21 12a9 9 0 1 1-9-9" />
      <path d="M21 3v9h-9" />
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

function StatCard({
  icon,
  label,
  value,
  sub,
  iconBg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: React.ReactNode;
  iconBg: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
        >
          {icon}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">
        {value}
      </p>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}

// Label hari singkat ("Sen", "Sel", ...) dari tanggal "YYYY-MM-DD" milik
// backend. String diparse sebagai UTC lalu dibaca dengan timeZone UTC
// supaya hari tidak pernah bergeser akibat zona waktu server (container
// defaultnya UTC, mesin lokal bisa WIB — keduanya dapat hasil sama).
const weekdayShortId = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).toLocaleDateString(
    "id-ID",
    { weekday: "short", timeZone: "UTC" },
  );
};

// Bentuk respons GET /reports/dashboard (backend-go v1.1.0+). Uang sudah
// berupa Rupiah bulat (BIGINT) — tidak ada lagi konversi Prisma Decimal.
type DashboardData = {
  today: { revenue: number; transactions: number; items_sold: number };
  yesterday: { revenue: number; transactions: number };
  week: { date: string; revenue: number; count: number }[];
  week_total: number;
  week_count: number;
  payments: { method: string; revenue: number; count: number }[];
  top_products: { name: string; unit: string; qty: number; revenue: number }[];
  low_stock: {
    id: number;
    name: string;
    sku: string;
    stock: number;
    min_stock: number;
    unit: string;
    restock: number;
  }[];
  recent: {
    id: number;
    receipt_no: string;
    cashier_name: string;
    payment_method: string;
    total: number;
    created_at: string;
  }[];
};

export default async function OwnerPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "OWNER" && session.user.role !== "DEVELOPER")
    redirect("/cashier");
  if (!session.user.goToken) {
    throw new Error("Sesi tidak memiliki token backend — silakan login ulang.");
  }

  // Identitas outlet (nama & logo) masih dari Prisma — menyusul pindah
  // ke backend-go pada fase multi-outlet, sama seperti halaman peluncur.
  const outlet = session.user.outletId
    ? await prisma.outlet.findUnique({ where: { id: session.user.outletId } })
    : await prisma.outlet.findFirst();
  if (!outlet) redirect("/");

  // Cache-busted logo URL; null keeps the default storefront tile.
  const logoUrl = outlet.logoMimeType
    ? `/api/outlet/logo?v=${outlet.logoVersion}`
    : null;

  // Satu panggilan untuk seluruh dashboard. Backend mati = halaman gagal
  // dengan pesan yang jelas (pola yang sama dengan halaman kelola produk)
  // — tidak ada angka palsu yang ditampilkan.
  const dash = await goFetch<DashboardData>(
    session.user.goToken,
    "/reports/dashboard",
  );
  if (!dash.ok) {
    throw new Error(dash.message);
  }
  const data = dash.data;

  // Grafik 7 hari: backend sudah mengirim gap-free tertua dulu, lengkap
  // dengan hari nol penjualan; label hari dihitung dari tanggalnya.
  const days = data.week.map((d) => ({
    key: d.date,
    label: weekdayShortId(d.date),
    total: d.revenue,
    count: d.count,
  }));

  const today = data.today;
  const yesterday = data.yesterday;
  const weekTotal = data.week_total;
  const weekCount = data.week_count;
  const maxDay = Math.max(...days.map((d) => d.total), 1);

  const omzetToday = today.revenue;
  const trxToday = today.transactions;
  const itemsToday = today.items_sold;
  const avgToday = trxToday > 0 ? omzetToday / trxToday : 0;
  const deltaPct =
    yesterday.revenue > 0
      ? Math.round(((omzetToday - yesterday.revenue) / yesterday.revenue) * 100)
      : null;

  // Porsi CASH/QRIS/DEBIT di jendela 7 hari yang sama dengan grafik.
  const methodRevenue: Record<string, number> = { CASH: 0, QRIS: 0, DEBIT: 0 };
  const methodCount: Record<string, number> = { CASH: 0, QRIS: 0, DEBIT: 0 };
  for (const p of data.payments) {
    methodRevenue[p.method] = (methodRevenue[p.method] ?? 0) + p.revenue;
    methodCount[p.method] = (methodCount[p.method] ?? 0) + p.count;
  }

  const topList = data.top_products;

  // Field snake_case dari Go dipetakan ke bentuk halaman (minStock) agar
  // markup di bawah tidak berubah dari desain aslinya.
  const lowStock = data.low_stock.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    stock: p.stock,
    minStock: p.min_stock,
    unit: p.unit,
    restock: p.restock,
  }));

  const recent = data.recent.map((r) => {
    const meta = METHOD_META.find((m) => m.key === r.payment_method);
    return {
      code: r.receipt_no,
      cashier: r.cashier_name || "-",
      time: new Date(r.created_at).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      methodLabel: meta?.label ?? r.payment_method,
      methodBadge: meta?.badge ?? "bg-slate-100 text-slate-600",
      total: r.total,
    };
  });

  return (
    <div className="flex min-h-dvh flex-col bg-slate-100">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={`Logo ${outlet.name}`}
                className="h-10 w-10 shrink-0 rounded-xl object-contain"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                <StorefrontIcon className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight text-slate-900">
                Laporan — {outlet.name}
              </h1>
              <p className="truncate text-xs text-slate-500">
                {session.user.name ?? "Pemilik"} · Pemilik
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/owner/verify"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Verifikasi Struk</span>
            </Link>
            <Link
              href="/owner/settings"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Pengaturan</span>
            </Link>
            <Link
              href="/owner/transactions"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ReceiptText className="h-4 w-4" />
              <span className="hidden sm:inline">Riwayat Transaksi</span>
              <span className="sm:hidden">Riwayat</span>
            </Link>
            <Link
              href="/owner/products"
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <PackagePlus className="h-4 w-4" />
              <span className="hidden sm:inline">Kelola Produk</span>
              <span className="sm:hidden">Produk</span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Beranda
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<WalletIcon className="h-5 w-5 text-blue-600" />}
            iconBg="bg-blue-50"
            label="Omzet Hari Ini"
            value={formatRupiah(omzetToday)}
            sub={
              deltaPct !== null ? (
                <span
                  className={`inline-flex items-center gap-1 font-semibold ${
                    deltaPct >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {deltaPct >= 0 ? (
                    <TrendUpIcon className="h-3.5 w-3.5" />
                  ) : (
                    <TrendDownIcon className="h-3.5 w-3.5" />
                  )}
                  {deltaPct >= 0 ? "+" : ""}
                  {deltaPct}% vs kemarin
                </span>
              ) : (
                <span>vs kemarin —</span>
              )
            }
          />
          <StatCard
            icon={<ReceiptIcon className="h-5 w-5 text-violet-600" />}
            iconBg="bg-violet-50"
            label="Transaksi Hari Ini"
            value={String(trxToday)}
            sub={<span>{yesterday.transactions} struk kemarin</span>}
          />
          <StatCard
            icon={<PackageIcon className="h-5 w-5 text-emerald-600" />}
            iconBg="bg-emerald-50"
            label="Item Terjual Hari Ini"
            value={String(itemsToday)}
            sub={<span>unit terjual</span>}
          />
          <StatCard
            icon={<BasketIcon className="h-5 w-5 text-amber-600" />}
            iconBg="bg-amber-50"
            label="Rata-rata per Struk"
            value={formatRupiah(avgToday)}
            sub={<span>dari {trxToday} struk</span>}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Penjualan 7 Hari Terakhir
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Total {formatRupiah(weekTotal)} · {weekCount} transaksi
                </p>
              </div>
              <ChartIcon className="h-5 w-5 shrink-0 text-slate-300" />
            </div>
            {weekCount === 0 ? (
              <div className="mt-8 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
                Belum ada penjualan dalam 7 hari terakhir.
              </div>
            ) : (
              <div className="mt-5 flex h-44 items-end gap-2 sm:gap-3">
                {days.map((d, i) => {
                  const barColor =
                    d.total === 0
                      ? "bg-slate-200"
                      : i === days.length - 1
                        ? "bg-blue-600"
                        : "bg-blue-400";
                  return (
                    <div
                      key={d.key}
                      className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                    >
                      <span className="text-[10px] font-semibold tabular-nums text-slate-500">
                        {compactRp(d.total)}
                      </span>
                      <div className="flex w-full flex-1 items-end">
                        <div
                          title={`${d.label}: ${formatRupiah(d.total)} (${d.count} transaksi)`}
                          style={{
                            height:
                              d.total > 0
                                ? `${Math.max((d.total / maxDay) * 100, 6)}%`
                                : "3px",
                          }}
                          className={`w-full rounded-t-lg transition-colors ${barColor}`}
                        />
                      </div>
                      <span
                        className={`text-[11px] font-semibold ${
                          i === days.length - 1
                            ? "text-blue-600"
                            : "text-slate-500"
                        }`}
                      >
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Metode Pembayaran
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">7 hari terakhir</p>
              </div>
              <WalletIcon className="h-5 w-5 shrink-0 text-slate-300" />
            </div>
            <div className="mt-5 space-y-5">
              {METHOD_META.map((m) => {
                const revenue = methodRevenue[m.key] ?? 0;
                const count = methodCount[m.key] ?? 0;
                const share = weekTotal > 0 ? (revenue / weekTotal) * 100 : 0;
                return (
                  <div key={m.key}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-medium text-slate-700">
                        <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} />
                        {m.label}
                      </span>
                      <span className="font-semibold tabular-nums text-slate-900">
                        {formatRupiah(revenue)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${m.bar}`}
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {count} struk · {Math.round(share)}%
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <ForecastSection />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Produk Terlaris
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">7 hari terakhir</p>
              </div>
              <TrophyIcon className="h-5 w-5 shrink-0 text-slate-300" />
            </div>
            {topList.length === 0 ? (
              <div className="mt-8 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
                Belum ada penjualan minggu ini.
              </div>
            ) : (
              <ol className="mt-4 space-y-3.5">
                {topList.map((item, i) => (
                  <li
                    key={`${item.name}-${i}`}
                    className="flex items-center gap-3"
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {item.qty} {item.unit} terjual
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                      {formatRupiah(item.revenue)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Stok Perlu Restok
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  stok di bawah atau sama dengan batas minimum
                </p>
              </div>
              {lowStock.length > 0 ? (
                <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                  {lowStock.length} produk
                </span>
              ) : (
                <AlertIcon className="h-5 w-5 shrink-0 text-slate-300" />
              )}
            </div>
            {lowStock.length === 0 ? (
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3.5">
                <CheckIcon className="h-4 w-4 shrink-0 text-emerald-600" />
                <p className="text-sm text-emerald-700">
                  Semua stok aman di atas batas minimum.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-3.5">
                {lowStock.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {p.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {p.sku ? `${p.sku} · ` : ""}min {p.minStock} {p.unit}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={`text-xs font-bold ${
                          p.stock === 0 ? "text-red-600" : "text-amber-600"
                        }`}
                      >
                        {p.stock === 0 ? "Habis" : `sisa ${p.stock}`}
                      </p>
                      <p className="text-[11px] font-medium text-blue-600">
                        restok +{p.restock}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Transaksi Terakhir
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                6 transaksi terbaru
              </p>
            </div>
            <ClockIcon className="h-5 w-5 shrink-0 text-slate-300" />
          </div>
          {recent.length === 0 ? (
            <div className="mt-8 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
              Belum ada transaksi tercatat.
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {recent.map((r) => (
                <li key={r.code} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold tabular-nums text-slate-900">
                      {r.code}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {r.cashier} · {r.time}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${r.methodBadge}`}
                  >
                    {r.methodLabel}
                  </span>
                  <span className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">
                    {formatRupiah(r.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
