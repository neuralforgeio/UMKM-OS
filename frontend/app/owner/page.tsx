import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Home,
  PackagePlus,
  ReceiptText,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import ForecastSection from "@/components/forecast/forecast-section";
import { AuroraBackground } from "@/components/aurora-background";
import { UserMenu } from "@/components/user-menu";
import { userMenuUser } from "@/lib/session-user";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { getOutletContext, outletLogoUrl } from "@/lib/outlet-context";
import { formatRupiah } from "@/lib/format";

export const instant = false;

// =====================================================================
// Dashboard owner — v3.1.0 restyling "Business overview" (arahan desain
// atasan: indigo, permukaan netral, hierarki tenang).
//
// LOGIKA DATA TIDAK BERUBAH SAMA SEKALI: seluruh angka statistik tetap
// datang dari backend-go lewat satu panggilan GET /api/v1/reports/
// dashboard (ringkasan hari ini & kemarin, grafik 7 hari gap-free,
// porsi metode pembayaran, 5 produk terlaris, stok menipis + saran
// restok, dan 6 transaksi terbaru). Yang berubah hanya penyajiannya:
// kartu KPI tanpa ornamen (label overline 9px → nilai besar → delta),
// judul seksi dengan deskripsi satu baris, satu aksi utama per area,
// grafik satu rona indigo, dan header solid tanpa kaca/blur.
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
    dot: "bg-primary",
    bar: "bg-primary",
    badge: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  },
  {
    key: "QRIS",
    label: "QRIS",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
    badge: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  },
  {
    key: "DEBIT",
    label: "Debit",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
    badge: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
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

// Kartu KPI pola PDF: label overline kecil, nilai besar tabular, lalu
// baris delta/konteks — tanpa ubin ikon dekoratif.
function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
}) {
  return (
    <div className="glass-card p-4">
      <p className="text-overline text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </p>
      <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
        {sub}
      </div>
    </div>
  );
}

// Kepala seksi pola PDF: judul + deskripsi satu baris + meta kanan.
function SectionHead({
  title,
  desc,
  meta,
}: {
  title: string;
  desc?: string;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {desc ? (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {desc}
          </p>
        ) : null}
      </div>
      {meta ? <div className="shrink-0">{meta}</div> : null}
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

  // v2.0.0: identitas outlet (nama & logo) dari backend-go — owner
  // melihat outlet ikatannya sendiri; developer mode maintenance dari
  // cookie dev_outlet.
  const outlet = await getOutletContext();
  if (!outlet) redirect("/");

  // Cache-busted logo URL; null keeps the default storefront tile.
  const logoUrl = outletLogoUrl(outlet);

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
  if (!dash.data.today || !Array.isArray(dash.data.low_stock)) {
    throw new Error(
      "Backend lama masih berjalan di port 8080 (tanpa dashboard v1.1.0). Matikan proses 'go run .' yang lama, jalankan backend-go v1.1.0+ (lokal atau docker compose up -d), lalu muat ulang halaman ini.",
    );
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
      methodBadge:
        meta?.badge ??
        "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400",
      total: r.total,
    };
  });

  return (
    // Shell v3.1.0: latar Cloud/Midnight datar + kartu putih solid,
    // header solid bergaris tepi (tanpa kaca/blur), satu aksi utama.
    <div className="relative flex min-h-dvh flex-col bg-slate-100 font-sans text-slate-900 antialiased selection:bg-primary/20 dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />
      <header className="relative z-10 shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={`Logo ${outlet.name}`}
                className="h-10 w-10 shrink-0 rounded-lg object-contain"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
                <StorefrontIcon className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-overline text-muted-foreground">Konsol Owner</p>
              <h1 className="truncate text-base leading-tight font-bold text-slate-900 dark:text-slate-100">
                Laporan · {outlet.name}
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <UserMenu user={userMenuUser(session)} />
            {/* Navigasi sekunder: tombol ikon senyap (semua tujuan tetap
                terjangkau — tidak ada fungsi yang hilang), lalu SATU aksi
                utama sesuai prinsip "one primary action" arahan desain. */}
            <Link
              href="/"
              title="Beranda"
              aria-label="Beranda"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Home className="h-4 w-4" />
            </Link>
            <Link
              href="/owner/verify"
              title="Verifikasi Struk"
              aria-label="Verifikasi Struk"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ShieldCheck className="h-4 w-4" />
            </Link>
            <Link
              href="/owner/transactions"
              title="Riwayat Transaksi"
              aria-label="Riwayat Transaksi"
              className="hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 sm:flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ReceiptText className="h-4 w-4" />
            </Link>
            <Link
              href="/owner/settings"
              title="Pengaturan"
              aria-label="Pengaturan"
              className="hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 sm:flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <Link
              href="/owner/assistant"
              className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/15"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden md:inline">Asisten</span>
            </Link>
            <Link
              href="/owner/products"
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover"
            >
              <PackagePlus className="h-4 w-4" />
              <span className="hidden sm:inline">Kelola Produk</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6">
        {/* Kepala halaman pola PDF: satu judul utama + deskripsi. */}
        <div>
          <p className="text-overline text-muted-foreground">
            Ringkasan Bisnis
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">
            Gambaran jelas penjualan, stok, dan performa hari ini.
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Seluruh angka di bawah ini langsung dari data transaksi outlet
            Anda — tanpa perkiraan buatan.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Omzet Hari Ini"
            value={formatRupiah(omzetToday)}
            sub={
              deltaPct !== null ? (
                <span
                  className={`inline-flex items-center gap-1 font-semibold ${
                    deltaPct >= 0
                      ? "text-success-strong dark:text-success-strong"
                      : "text-red-600 dark:text-red-400"
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
            label="Transaksi Hari Ini"
            value={String(trxToday)}
            sub={<span>{yesterday.transactions} struk kemarin</span>}
          />
          <StatCard
            label="Item Terjual Hari Ini"
            value={String(itemsToday)}
            sub={<span>unit terjual</span>}
          />
          <StatCard
            label="Rata-rata per Struk"
            value={formatRupiah(avgToday)}
            sub={<span>dari {trxToday} struk</span>}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="glass-card p-4 lg:col-span-2 lg:p-5">
            <SectionHead
              title="Penjualan 7 Hari Terakhir"
              desc={`Total ${formatRupiah(weekTotal)} · ${weekCount} transaksi`}
            />
            {weekCount === 0 ? (
              <div className="mt-8 rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400 dark:border-slate-800 dark:text-slate-500">
                Belum ada penjualan dalam 7 hari terakhir.
              </div>
            ) : (
              <div className="mt-5 flex h-44 items-end gap-2 sm:gap-3">
                {days.map((d, i) => {
                  const barColor =
                    d.total === 0
                      ? "bg-slate-200 dark:bg-slate-800"
                      : i === days.length - 1
                        ? "bg-primary"
                        : "bg-primary/45";
                  return (
                    <div
                      key={d.key}
                      className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                    >
                      <span className="text-[10px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
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
                          className={`w-full rounded-t-md transition-colors ${barColor}`}
                        />
                      </div>
                      <span
                        className={`text-[11px] font-semibold ${
                          i === days.length - 1
                            ? "text-primary"
                            : "text-slate-500 dark:text-slate-400"
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

          <section className="glass-card p-4 lg:p-5">
            <SectionHead title="Metode Pembayaran" desc="7 hari terakhir" />
            <div className="mt-5 space-y-5">
              {METHOD_META.map((m) => {
                const revenue = methodRevenue[m.key] ?? 0;
                const count = methodCount[m.key] ?? 0;
                const share = weekTotal > 0 ? (revenue / weekTotal) * 100 : 0;
                return (
                  <div key={m.key}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                        <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} />
                        {m.label}
                      </span>
                      <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {formatRupiah(revenue)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900">
                      <div
                        className={`h-full rounded-full ${m.bar}`}
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
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
          <section className="glass-card p-4 lg:p-5">
            <SectionHead title="Produk Terlaris" desc="7 hari terakhir" />
            {topList.length === 0 ? (
              <div className="mt-8 rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400 dark:border-slate-800 dark:text-slate-500">
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
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                        i === 0
                          ? "bg-amber-100 text-amber-700 dark:text-amber-300"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {item.qty} {item.unit} terjual
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatRupiah(item.revenue)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="glass-card p-4 lg:p-5">
            <SectionHead
              title="Stok Perlu Restok"
              desc="stok di bawah atau sama dengan batas minimum"
              meta={
                lowStock.length > 0 ? (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                    {lowStock.length} produk
                  </span>
                ) : null
              }
            />
            {lowStock.length === 0 ? (
              <div className="mt-4 flex items-center gap-3 rounded-lg bg-emerald-50 px-4 py-3.5 dark:bg-emerald-950/40">
                <svg
                  className="h-4 w-4 shrink-0 text-success-strong"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  Semua stok aman di atas batas minimum.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-3.5">
                {lowStock.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {p.name}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {p.sku ? `${p.sku} · ` : ""}min {p.minStock} {p.unit}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={`text-xs font-bold ${
                          p.stock === 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {p.stock === 0 ? "Habis" : `sisa ${p.stock}`}
                      </p>
                      <p className="text-[11px] font-medium text-primary">
                        restok +{p.restock}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="glass-card p-4 lg:p-5">
          <SectionHead title="Transaksi Terakhir" desc="6 transaksi terbaru" />
          {recent.length === 0 ? (
            <div className="mt-8 rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400 dark:border-slate-800 dark:text-slate-500">
              Belum ada transaksi tercatat.
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
              {recent.map((r) => (
                <li key={r.code} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {r.code}
                    </p>
                    <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                      {r.cashier} · {r.time}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${r.methodBadge}`}
                  >
                    {r.methodLabel}
                  </span>
                  <span className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
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
