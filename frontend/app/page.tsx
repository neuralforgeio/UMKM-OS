import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Calculator,
  Package,
  Receipt,
  Store,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { getOutletContext } from "@/lib/outlet-context";
import { formatRupiah } from "@/lib/format";
import { UserMenu } from "@/components/user-menu";
import { userMenuUser } from "@/lib/session-user";
import { ThemeToggleButton } from "@/components/shell/theme-toggle-button";
import { ActionCard } from "@/components/ui/action-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LocalClock } from "@/components/ui/local-clock";
import { MetricCard } from "@/components/ui/metric-card";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { AppFooter } from "@/components/shell/app-footer";

export const instant = false;

// Beranda pemilik dan kasir UMKM OS v1.0.0, mengikuti referensi desain
// "umkm-os-home-redesign-v2" milik pemilik: bilah atas ringkas (merek +
// saklar tema + profil), sambutan dengan panel waktu lokal hidup, empat
// metrik hari ini, akses cepat, dan aktivitas toko terbaru.
//
// Seluruh angka tetap datang dari backend-go (GET /reports/dashboard);
// kalau backend tidak merespons, kartu metrik dan aktivitas dilewati dan
// halaman tetap terbuka (tidak pernah ada angka palsu).

type DashboardRingkas = {
  today: { revenue: number; transactions: number; items_sold: number };
  yesterday: { revenue: number; transactions: number };
  low_stock: unknown[];
  recent: {
    receipt_no: string;
    cashier_name: string;
    payment_method: string;
    total: number;
    created_at: string;
  }[];
};

const METODE: Record<string, { label: string; tone: "primary" | "ok" | "warn" }> = {
  CASH: { label: "Tunai", tone: "primary" },
  QRIS: { label: "QRIS", tone: "ok" },
  DEBIT: { label: "Debit", tone: "warn" },
};

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Developer punya konsol lintas outlet sendiri; beranda ini berbasis
  // satu outlet sehingga tidak relevan bagi super user.
  if (session.user.role === "DEVELOPER") redirect("/dev");

  const outlet = await getOutletContext();
  const isOwner = session.user.role === "OWNER";
  const namaPengguna = session.user.name ?? "Pengguna";
  const namaOutlet = outlet?.name ?? "Warung Anda";

  let data: DashboardRingkas | null = null;
  if (isOwner && session.user.goToken) {
    const dash = await goFetch<DashboardRingkas>(
      session.user.goToken,
      "/reports/dashboard");
    // Bentuk respons diverifikasi sebelum dibaca supaya backend lama
    // tidak pernah membuat halaman ini menampilkan angka kosong palsu.
    if (dash.ok && dash.data.today && Array.isArray(dash.data.low_stock)) {
      data = dash.data;
    }
  }

  const deltaPct =
    data && data.yesterday.revenue > 0
      ? Math.round(
          ((data.today.revenue - data.yesterday.revenue) /
            data.yesterday.revenue) *
            100)
      : null;

  const aktivitas = data ? data.recent.slice(0, 3) : [];

  return (
    <div className="flex min-h-dvh flex-col bg-shell">
      <div className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col px-4 sm:px-6">
        {/* Bilah atas beranda */}
        <header className="flex min-h-[76px] flex-wrap items-center justify-between gap-3 border-b border-shell-line py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-shell-primary text-white shadow-md shadow-shell-primary/25"
            >
              <Store className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-extrabold leading-none tracking-tight text-shell-ink">
                UMKM OS
              </p>
              <p className="mt-1 truncate text-[11px] leading-none text-shell-muted">
                {namaOutlet}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggleButton />
            <UserMenu user={userMenuUser(session)} />
          </div>
        </header>

        <main className="flex-1 pb-10 pt-8">
          {/* Sambutan + panel waktu */}
          <section className="mb-7 flex flex-wrap items-end justify-between gap-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-shell-primary-strong">
                <span aria-hidden="true" className="h-px w-4 bg-shell-primary" />
                Ringkasan toko
              </div>
              <h1 className="mt-2.5 max-w-[760px] text-2xl font-bold leading-tight tracking-tight text-shell-ink sm:text-4xl">
                Selamat datang, {namaPengguna}.
              </h1>
              <p className="mt-3 max-w-[650px] text-sm leading-relaxed text-shell-muted">
                Pantau aktivitas {namaOutlet} dan lanjutkan pekerjaan utama
                Anda dari satu tempat.
              </p>
            </div>
            <LocalClock />
          </section>

          {/* Metrik hari ini (pemilik; angka nyata dari backend) */}
          {data && (
            <section aria-label="Performa hari ini" className="mb-8">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold tracking-tight text-shell-ink">
                    Performa hari ini
                  </h2>
                  <p className="mt-1 text-[11px] text-shell-muted">
                    Ringkasan aktivitas toko pada hari berjalan.
                  </p>
                </div>
                <span className="text-[11px] text-shell-muted">Hari ini</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label="Omzet hari ini"
                  value={formatRupiah(data.today.revenue)}
                  icon={Wallet}
                  foot={
                    deltaPct === null ? (
                      "Belum ada pembanding kemarin"
                    ) : deltaPct >= 0 ? (
                      <span>
                        <span className="font-bold text-shell-ok">
                          naik {deltaPct} persen
                        </span>{" "}
                        dibanding kemarin
                      </span>
                    ) : (
                      <span>
                        <span className="font-bold text-shell-bad">
                          turun {Math.abs(deltaPct)} persen
                        </span>{" "}
                        dibanding kemarin
                      </span>
                    )
                  }
                />
                <MetricCard
                  label="Transaksi"
                  value={String(data.today.transactions)}
                  icon={Receipt}
                  tone="cyan"
                  foot="Jumlah struk selesai hari ini"
                />
                <MetricCard
                  label="Item terjual"
                  value={String(data.today.items_sold)}
                  icon={Package}
                  tone="ok"
                  foot="Total barang keluar hari ini"
                />
                <MetricCard
                  label="Stok menipis"
                  value={String(data.low_stock.length)}
                  icon={TriangleAlert}
                  tone={data.low_stock.length > 0 ? "warn" : "ok"}
                  foot={
                    data.low_stock.length > 0
                      ? "Perlu diperiksa untuk segera restok"
                      : "Tidak ada peringatan stok"
                  }
                />
              </div>
            </section>
          )}

          {/* Akses cepat */}
          <section aria-label="Akses cepat" className="mb-8">
            <div className="mb-3">
              <h2 className="text-sm font-bold tracking-tight text-shell-ink">
                Akses cepat
              </h2>
              <p className="mt-1 text-[11px] text-shell-muted">
                Pilih area kerja yang ingin Anda buka.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ActionCard
                href="/cashier"
                icon={Calculator}
                title="Kasir"
                description="Mulai transaksi penjualan dan pembayaran."
              />
              {isOwner && (
                <>
                  <ActionCard
                    href="/owner"
                    icon={BarChart3}
                    title="Laporan Pemilik"
                    description="Tinjau omzet, tren penjualan, dan performa toko."
                  />
                  <ActionCard
                    href="/owner/products"
                    icon={Boxes}
                    title="Kelola Produk"
                    description="Atur katalog, harga, dan persediaan barang."
                  />
                </>
              )}
            </div>
          </section>

          {/* Aktivitas toko */}
          <Panel
            title="Aktivitas toko"
            subtitle={`Pergerakan terbaru di ${namaOutlet}.`}
            action={
              <Link
                href="/owner/transactions"
                className="text-[10px] font-bold text-shell-primary-strong transition hover:text-shell-ink"
              >
                Semua transaksi
              </Link>
            }
          >
            {aktivitas.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="Belum ada transaksi tercatat"
                description="Transaksi dan aktivitas operasional akan muncul di sini setelah toko mulai berjalan."
                actionHref="/cashier"
                actionLabel="Mulai transaksi"
              />
            ) : (
              <ul className="divide-y divide-shell-line">
                {aktivitas.map((r) => {
                  const metode = METODE[r.payment_method] ?? {
                    label: r.payment_method,
                    tone: "netral" as const,
                  };
                  return (
                    <li
                      key={r.receipt_no}
                      className="flex flex-wrap items-center gap-3 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold tabular-nums text-shell-ink">
                          {r.receipt_no}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-shell-muted">
                          {r.cashier_name}
                        </p>
                      </div>
                      <StatusPill tone={metode.tone}>
                        {metode.label}
                      </StatusPill>
                      <span className="w-28 shrink-0 text-right text-xs font-bold tabular-nums text-shell-ink">
                        {formatRupiah(r.total)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {!isOwner && (
            <p className="mt-6 text-center text-[11px] leading-relaxed text-shell-muted">
              Laporan dan pengaturan warung hanya dapat dibuka oleh pemilik.
            </p>
          )}
        </main>

        <AppFooter outletName={namaOutlet} />
      </div>
    </div>
  );
}
