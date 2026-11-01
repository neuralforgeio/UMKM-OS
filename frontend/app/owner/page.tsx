import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Package, Receipt, TrendingDown, TrendingUp, TriangleAlert, Wallet } from "lucide-react";
import ForecastSection from "@/components/forecast/forecast-section";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { getOutletContext, outletLogoUrl } from "@/lib/outlet-context";
import { formatRupiah } from "@/lib/format";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Panel } from "@/components/ui/panel";
import { PrimaryLink } from "@/components/ui/links";
import { SalesChart } from "@/components/ui/sales-chart";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { userMenuUser } from "@/lib/session-user";

export const instant = false;

// =====================================================================
// Dashboard pemilik UMKM OS v1.0.0, mengikuti referensi desain HTML
// "umkm-os-home-redesign" milik pemilik: panel utama, empat metrik,
// grafik tren 7 hari, wawasan, produk terlaris, perlu restok, dan
// transaksi terbaru.
//
// SELURUH angka tetap datang dari backend-go lewat satu panggilan
// GET /api/v1/reports/dashboard (frontend tidak pernah menghitung
// agregat sendiri). Grafik hanya menampilkan 7 hari karena itu jendela
// data yang benar benar tersedia; tidak ada angka rekaan.
// =====================================================================

const METHOD_META: Record<string, { label: string; tone: "primary" | "ok" | "warn" }> = {
  CASH: { label: "Tunai", tone: "primary" },
  QRIS: { label: "QRIS", tone: "ok" },
  DEBIT: { label: "Debit", tone: "warn" },
};

// Label hari singkat dari tanggal YYYY-MM-DD milik backend (dibaca dengan
// zona UTC supaya hari tidak pernah bergeser antar zona waktu server).
const weekdayShortId = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).toLocaleDateString(
    "id-ID",
    { weekday: "short", timeZone: "UTC" });
};

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
    throw new Error("Sesi tidak memiliki token backend. Silakan masuk kembali.");
  }

  const outlet = await getOutletContext();
  if (!outlet) redirect("/");

  // Satu panggilan untuk seluruh dashboard. Backend tidak merespons =
  // halaman gagal dengan pesan yang jelas, bukan angka palsu.
  const dash = await goFetch<DashboardData>(
    session.user.goToken,
    "/reports/dashboard");
  if (!dash.ok) {
    throw new Error(dash.message);
  }
  if (!dash.data.today || !Array.isArray(dash.data.low_stock)) {
    throw new Error(
      "Backend lama masih berjalan tanpa data dashboard. Matikan proses lama, jalankan backend-go terbaru (docker compose up -d), lalu muat ulang halaman ini.");
  }
  const data = dash.data;

  const days = data.week.map((d) => ({
    key: d.date,
    label: weekdayShortId(d.date),
    total: d.revenue,
    count: d.count,
  }));

  const omzetToday = data.today.revenue;
  const trxToday = data.today.transactions;
  const avgToday = trxToday > 0 ? omzetToday / trxToday : 0;
  const avgYesterday =
    data.yesterday.transactions > 0
      ? data.yesterday.revenue / data.yesterday.transactions
      : 0;
  const deltaPct =
    data.yesterday.revenue > 0
      ? Math.round(((omzetToday - data.yesterday.revenue) / data.yesterday.revenue) * 100)
      : null;
  const deltaAvgPct =
    avgYesterday > 0
      ? Math.round(((avgToday - avgYesterday) / avgYesterday) * 100)
      : null;

  const weekTotal = data.week_total;
  const weekCount = data.week_count;
  const rataHarian = weekTotal / 7;
  const hariTerbaik = days.reduce(
    (m, d) => (d.total > m.total ? d : m),
    { key: "", label: "", total: 0, count: 0 });
  const porsiHariIni =
    hariTerbaik.total > 0
      ? Math.min(100, Math.round((omzetToday / hariTerbaik.total) * 100))
      : 0;

  const topList = data.top_products;
  const lowStock = data.low_stock;
  const recent = data.recent;
  const unggulan = topList[0];

  const tanggalServer = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date());

  const deltaNode =
    deltaPct === null ? (
      "Belum ada pembanding kemarin"
    ) : deltaPct >= 0 ? (
      <span>
        <span className="font-bold text-shell-ok">naik {deltaPct} persen</span>{" "}
        dibanding kemarin
      </span>
    ) : (
      <span>
        <span className="font-bold text-shell-bad">turun {Math.abs(deltaPct)} persen</span>{" "}
        dibanding kemarin
      </span>
    );

  return (
    <AppShell
      role={session.user.role === "DEVELOPER" ? "DEVELOPER" : "OWNER"}
      user={userMenuUser(session)}
      outlet={{
        name: outlet.name,
        logoUrl: outletLogoUrl(outlet),
        address: outlet.address,
      }}
      crumb="Menu Utama"
      title="Ringkasan"
      subtitle={outlet.name}
    >
      <PageHeader
        eyebrow="Operasional toko"
        title={`Selamat datang, ${session.user.name ?? "Pemilik"}.`}
        description={`Ringkasan aktivitas ${outlet.name} hari ini beserta tren tujuh hari terakhir.`}
        actions={
          <>
            <span className="hidden rounded-xl border border-shell-line bg-shell-card px-3.5 py-2.5 text-[11px] text-shell-ink-soft md:inline-flex">
              {tanggalServer}
            </span>
            <PrimaryLink href="/cashier" title="Buka kasir">
              Transaksi baru
            </PrimaryLink>
          </>
        }
      />

      {/* Panel utama + ringkasan tujuh hari */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.75fr)]">
        <section className="relative overflow-hidden rounded-2xl border border-shell-primary/20 bg-gradient-to-br from-shell-primary/12 via-shell-card to-shell-cyan/8 p-6 sm:p-7">
          <span
            aria-hidden="true"
            className="absolute -right-16 -top-20 h-60 w-60 rounded-full border border-shell-primary/10 bg-shell-primary/5"
          />
          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-shell-primary-strong">
              Pusat kendali warung
            </p>
            <h2 className="mt-3 text-xl font-bold leading-snug tracking-tight text-shell-ink sm:text-2xl">
              Semua operasional dalam satu kendali.
            </h2>
            <p className="mt-2 max-w-[430px] text-xs leading-relaxed text-shell-ink-soft">
              Pantau penjualan, kelola persediaan, dan ambil keputusan lebih
              cepat untuk {outlet.name}.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/owner/transactions"
                className="text-[10px] font-bold text-shell-primary-strong transition hover:text-shell-ink"
              >
                Lihat ringkasan bisnis
              </Link>
              <span className="text-[10px] text-shell-muted">
                Data diperbarui setiap halaman dibuka
              </span>
            </div>
          </div>
        </section>

        <section className="flex flex-col justify-between rounded-2xl border border-shell-line bg-shell-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-shell-ink">Omzet tujuh hari</p>
            <span
              aria-hidden="true"
              className="grid h-7 w-7 place-items-center rounded-lg bg-shell-ok/12 text-shell-ok"
            >
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-shell-ink">
              {formatRupiah(weekTotal)}
            </p>
            <p className="mt-1 text-[11px] text-shell-muted">
              {weekCount.toLocaleString("id-ID")} transaksi · rata-rata{" "}
              {formatRupiah(Math.round(rataHarian))} per hari
            </p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-shell-soft">
              <div
                className="h-full rounded-full bg-gradient-to-r from-shell-primary to-shell-cyan"
                style={{ width: `${porsiHariIni}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-shell-muted">
              Hari ini mencapai {porsiHariIni} persen dari hari terbaik
              minggu ini{hariTerbaik.label ? ` (${hariTerbaik.label})` : ""}
            </p>
          </div>
        </section>
      </div>

      {/* Metrik hari ini */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Omzet hari ini"
          value={formatRupiah(omzetToday)}
          icon={Wallet}
          foot={deltaNode}
        />
        <MetricCard
          label="Transaksi"
          value={String(trxToday)}
          icon={Receipt}
          tone="cyan"
          foot={
            data.yesterday.transactions > 0 ? (
              <span>
                <span
                  className={
                    trxToday >= data.yesterday.transactions
                      ? "font-bold text-shell-ok"
                      : "font-bold text-shell-bad"
                  }
                >
                  {trxToday >= data.yesterday.transactions ? "naik" : "turun"}{" "}
                  {Math.abs(trxToday - data.yesterday.transactions)} struk
                </span>{" "}
                dari kemarin
              </span>
            ) : (
              "Jumlah struk selesai hari ini"
            )
          }
        />
        <MetricCard
          label="Rata-rata belanja"
          value={formatRupiah(Math.round(avgToday))}
          icon={BarChart3}
          tone="ok"
          foot={
            deltaAvgPct === null ? (
              "Nilai per transaksi hari ini"
            ) : deltaAvgPct >= 0 ? (
              <span>
                <span className="font-bold text-shell-ok">naik {deltaAvgPct} persen</span>{" "}
                dari kemarin
              </span>
            ) : (
              <span>
                <span className="font-bold text-shell-bad">turun {Math.abs(deltaAvgPct)} persen</span>{" "}
                dari kemarin
              </span>
            )
          }
        />
        <MetricCard
          label="Stok menipis"
          value={`${lowStock.length} produk`}
          icon={TriangleAlert}
          tone={lowStock.length > 0 ? "warn" : "ok"}
          foot={
            lowStock.length > 0
              ? "Perlu diperiksa untuk segera restok"
              : "Tidak ada peringatan stok"
          }
        />
      </div>

      {/* Grafik tren + wawasan */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(270px,0.8fr)]">
        <Panel
          title="Tren penjualan"
          subtitle="Pergerakan omzet tujuh hari terakhir"
          action={<span className="text-[10px] text-shell-muted">7 hari</span>}
        >
          <div className="flex items-baseline gap-3">
            <p className="text-2xl font-bold tracking-tight text-shell-ink">
              {formatRupiah(weekTotal)}
            </p>
            {deltaPct !== null && (
              <span
                className={`flex items-center gap-1 text-[10px] font-bold ${
                  deltaPct >= 0 ? "text-shell-ok" : "text-shell-bad"
                }`}
              >
                {deltaPct >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(deltaPct)} persen dibanding kemarin
              </span>
            )}
          </div>
          <div className="mt-2">
            <SalesChart
              points={days.map((d) => ({ label: d.label, value: d.total }))}
              ariaLabel="Grafik omzet tujuh hari terakhir"
            />
          </div>
        </Panel>

        <Panel title="Wawasan untuk Anda" subtitle="Hal yang patut diperhatikan hari ini">
          <ul className="grid gap-3.5">
            <li className="flex gap-3">
              <span
                aria-hidden="true"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-shell-ok/12 text-shell-ok"
              >
                <TrendingUp className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-[11px] font-bold text-shell-ink">
                  {deltaPct === null
                    ? "Belum ada pembanding harian"
                    : deltaPct >= 0
                      ? "Penjualan meningkat"
                      : "Penjualan menurun"}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-shell-muted">
                  {deltaPct === null
                    ? "Omzet kemarin belum tercatat sehingga perbandingan harian belum tersedia."
                    : `Omzet hari ini ${deltaPct >= 0 ? "naik" : "turun"} ${Math.abs(deltaPct)} persen dibandingkan hari sebelumnya.`}
                </p>
              </div>
            </li>
            <li className="flex gap-3 border-t border-shell-line pt-3.5">
              <span
                aria-hidden="true"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-shell-warn/12 text-shell-warn"
              >
                <TriangleAlert className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-[11px] font-bold text-shell-ink">
                  {lowStock.length > 0 ? "Periksa persediaan" : "Persediaan terkendali"}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-shell-muted">
                  {lowStock.length > 0
                    ? `${lowStock.length} produk berada pada atau di bawah batas minimum dan perlu dijadwalkan untuk restok.`
                    : "Tidak ada produk di bawah batas minimum stok saat ini."}
                </p>
              </div>
            </li>
            <li className="flex gap-3 border-t border-shell-line pt-3.5">
              <span
                aria-hidden="true"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-shell-primary/12 text-shell-primary-strong"
              >
                <Package className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-[11px] font-bold text-shell-ink">Produk unggulan</p>
                <p className="mt-1 text-[10px] leading-relaxed text-shell-muted">
                  {unggulan
                    ? `${unggulan.name} menjadi produk dengan penjualan tertinggi tujuh hari terakhir (${unggulan.qty} ${unggulan.unit}).`
                    : "Belum ada penjualan produk pada tujuh hari terakhir."}
                </p>
              </div>
            </li>
          </ul>
          <Link
            href="/owner/assistant"
            className="mt-4 inline-block text-[10px] font-bold text-shell-primary-strong transition hover:text-shell-ink"
          >
            Minta analisis OSCAR
          </Link>
        </Panel>
      </div>

      {/* Widget ramalan (data nyata dari layanan ML) */}
      <div className="mb-4">
        <ForecastSection />
      </div>

      {/* Produk terlaris + perlu restok */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(270px,0.8fr)]">
        <Panel
          title="Produk terlaris"
          subtitle="Tujuh hari terakhir"
          action={
            <Link
              href="/owner/products"
              className="text-[10px] font-bold text-shell-primary-strong transition hover:text-shell-ink"
            >
              Lihat semua
            </Link>
          }
          bodyClassName="overflow-x-auto"
        >
          {topList.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Belum ada produk terjual"
              description="Daftar produk terlaris akan muncul setelah transaksi pertama tercatat."
              actionHref="/cashier"
              actionLabel="Mulai transaksi"
            />
          ) : (
            <table className="w-full min-w-[460px] border-collapse">
              <thead>
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-shell-muted">
                  <th className="border-b border-shell-line pb-2 pr-3">Produk</th>
                  <th className="border-b border-shell-line pb-2 pr-3">Terjual</th>
                  <th className="border-b border-shell-line pb-2 pr-3">Pendapatan</th>
                  <th className="border-b border-shell-line pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {topList.map((p) => (
                  <tr key={p.name} className="align-middle">
                    <td className="border-b border-shell-line/60 py-3 pr-3">
                      <p className="truncate text-xs font-semibold text-shell-ink">
                        {p.name}
                      </p>
                      <p className="mt-0.5 text-[10px] text-shell-muted">
                        Satuan {p.unit}
                      </p>
                    </td>
                    <td className="border-b border-shell-line/60 py-3 pr-3 text-xs tabular-nums text-shell-ink-soft">
                      {p.qty}
                    </td>
                    <td className="border-b border-shell-line/60 py-3 pr-3 text-xs font-semibold tabular-nums text-shell-ink">
                      {formatRupiah(p.revenue)}
                    </td>
                    <td className="border-b border-shell-line/60 py-3">
                      <StatusPill tone="ok">
                        {p === unggulan ? "Terlaris" : "Stabil"}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel
          title="Perlu restok"
          subtitle="Produk pada atau di bawah batas minimum"
          action={
            <Link
              href="/owner/stock"
              className="text-[10px] font-bold text-shell-primary-strong transition hover:text-shell-ink"
            >
              Kelola stok
            </Link>
          }
        >
          {lowStock.length === 0 ? (
            <EmptyState
              icon={TriangleAlert}
              title="Semua stok terkendali"
              description="Tidak ada produk yang berada di bawah batas minimum saat ini."
              actionHref="/owner/stock"
              actionLabel="Buka kartu stok"
            />
          ) : (
            <ul className="grid gap-4">
              {lowStock.slice(0, 4).map((p) => {
                const porsi = Math.min(
                  100,
                  Math.round((p.stock / Math.max(p.min_stock * 2, 1)) * 100));
                return (
                  <li key={p.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-xs font-semibold text-shell-ink">
                        {p.name}
                      </p>
                      <span className="shrink-0 text-xs font-bold tabular-nums text-shell-warn">
                        sisa {p.stock} {p.unit}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-shell-muted">
                      Minimum {p.min_stock} {p.unit} · saran tambah {p.restock} {p.unit}
                    </p>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-shell-soft">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-shell-warn to-shell-bad"
                        style={{ width: `${porsi}%` }}
                      />
                    </div>
                  </li>
                );
              })}
              {lowStock.length > 4 && (
                <li className="flex items-center justify-between gap-2 border-t border-shell-line pt-3">
                  <span className="text-[10px] text-shell-muted">
                    {lowStock.length} produk membutuhkan perhatian
                  </span>
                  <Link
                    href="/owner/stock"
                    className="text-[10px] font-bold text-shell-primary-strong transition hover:text-shell-ink"
                  >
                    Lihat daftar
                  </Link>
                </li>
              )}
            </ul>
          )}
        </Panel>
      </div>

      {/* Transaksi terbaru */}
      <Panel
        title="Transaksi terbaru"
        subtitle="Aktivitas transaksi terakhir di outlet ini"
        action={
          <Link
            href="/owner/transactions"
            className="text-[10px] font-bold text-shell-primary-strong transition hover:text-shell-ink"
          >
            Semua transaksi
          </Link>
        }
        bodyClassName="overflow-x-auto"
      >
        {recent.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Belum ada transaksi tercatat"
            description="Transaksi terbaru akan muncul di sini setelah kasir menyelesaikan penjualan pertama."
            actionHref="/cashier"
            actionLabel="Mulai transaksi"
          />
        ) : (
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-shell-muted">
                <th className="border-b border-shell-line pb-2 pr-3">Nomor struk</th>
                <th className="border-b border-shell-line pb-2 pr-3">Kasir</th>
                <th className="border-b border-shell-line pb-2 pr-3">Metode</th>
                <th className="border-b border-shell-line pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => {
                const metode =
                  METHOD_META[r.payment_method] ?? {
                    label: r.payment_method,
                    tone: "primary" as const,
                  };
                return (
                  <tr key={r.id}>
                    <td className="border-b border-shell-line/60 py-3 pr-3 text-xs font-semibold tabular-nums text-shell-ink">
                      {r.receipt_no}
                    </td>
                    <td className="border-b border-shell-line/60 py-3 pr-3 text-xs text-shell-ink-soft">
                      {r.cashier_name}
                    </td>
                    <td className="border-b border-shell-line/60 py-3 pr-3">
                      <StatusPill tone={metode.tone}>{metode.label}</StatusPill>
                    </td>
                    <td className="border-b border-shell-line/60 py-3 text-right text-xs font-bold tabular-nums text-shell-ink">
                      {formatRupiah(r.total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </AppShell>
  );
}
