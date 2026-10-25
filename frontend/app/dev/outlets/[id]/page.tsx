import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  Building2,
  Calculator,
  LayoutDashboard,
  Store,
  TriangleAlert,
  Users,
  Wrench,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { enterMaintenance } from "@/app/dev/maintenance-actions";
import { AuroraBackground } from "@/components/aurora-background";
import { ThemeHeaderActions } from "@/components/theme-header-actions";

export const instant = false;

function formatWib(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

// Bentuk respons backend-go untuk drill-down (lihat internal/handler).
type GoOutlet = {
  id: number;
  name: string;
  address: string;
  phone: string;
  is_active: boolean;
  user_count: number;
  created_at: string;
};
type GoDrillProduct = {
  id: number;
  name: string;
  sku: string | null;
  category: string;
  price: number;
  stock: number;
  min_stock: number;
  unit: string;
  is_active: boolean;
};
type GoDrillUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
};
type GoDrillTransaction = {
  id: number;
  receipt_no: string;
  cashier_name: string;
  total: number;
  status: string;
  created_at: string;
};
type GoDrillDashboard = {
  today: { revenue: number; transactions: number };
  low_stock: unknown[];
};

// Drill-down outlet (Task 34 Fase B) — data bisnis READ-ONLY by design:
// developer MEMBACA untuk memantau, mengubah hanya lewat jalurnya
// masing-masing (produk/stok oleh owner outlet, akun oleh /dev/users).
// Task 35 menambah pintu MAINTENANCE: developer bisa membuka konsol
// owner & POS kasir outlet ini "menjadi stafnya" — memakai cookie
// dev_outlet yang disuntikkan ke sesi (lihat lib/auth.ts), keluar
// kapan saja lewat banner amber.
// v1.6.0: design aurora + glass sadar tema.
// v2.0.0: seluruh data dari backend-go ter-scope ?outlet_id= — outlet
// baru juga bisa di-drill-down, bukan cuma tabel Prisma lama.
export default async function DevOutletDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "DEVELOPER") redirect("/");
  if (!session.user.goToken) {
    throw new Error("Sesi tidak memiliki token backend — silakan login ulang.");
  }
  const goToken = session.user.goToken;

  const { id } = await params;
  const outletId = Number(id);
  if (!Number.isInteger(outletId) || outletId <= 0) notFound();

  // Outlet + data bisnisnya, semuanya ter-scope ?outlet_id= (DEVELOPER
  // wajib eksplisit — inilah aturan scoping backend-go v1.5.0).
  const [outletRes, productsRes, usersRes, transactionsRes, dashRes] =
    await Promise.all([
      goFetch<GoOutlet>(goToken, `/outlets/${outletId}`),
      goFetch<GoDrillProduct[]>(goToken, `/products?all=true&outlet_id=${outletId}`),
      goFetch<GoDrillUser[]>(goToken, `/users?outlet_id=${outletId}`),
      goFetch<GoDrillTransaction[]>(goToken, `/transactions?limit=10&outlet_id=${outletId}`),
      goFetch<GoDrillDashboard>(goToken, `/reports/dashboard?outlet_id=${outletId}`),
    ]);
  // Outlet tidak ada / sudah terhapus -> 404 (pola notFound bawaan).
  if (!outletRes.ok) notFound();
  // Halaman inti super-user gagal keras bila backend mati — tidak ada
  // grid kosong yang terlihat normal.
  if (!productsRes.ok) {
    throw new Error(productsRes.message);
  }
  const outlet = outletRes.data;
  // Data pelengkap gagal = tabel kosong yang jujur, bukan halaman mati.
  const products = productsRes.data.slice(0, 200);
  const users = usersRes.ok ? usersRes.data : [];
  const transactions = transactionsRes.ok ? transactionsRes.data : [];
  const todayRevenue = dashRes.ok ? dashRes.data.today.revenue : 0;
  const todayCount = dashRes.ok ? dashRes.data.today.transactions : 0;
  const lowStockCount = dashRes.ok ? dashRes.data.low_stock.length : 0;

  const omzetToday = todayRevenue;
  const activeUsers = users.filter((u) => u.is_active).length;

  const statCards = [
    {
      label: "Produk",
      value: String(products.length),
      icon: Boxes,
      tint: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      label: "Stok Menipis",
      value: String(lowStockCount),
      icon: TriangleAlert,
      tint: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      label: "Pengguna Aktif",
      value: String(activeUsers),
      icon: Users,
      tint: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Omzet Hari Ini",
      value: formatRupiah(omzetToday),
      icon: Store,
      tint: "border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    },
  ];

  return (
    <div className="relative min-h-dvh bg-slate-100 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        {/* ===== Topbar: brand + breadcrumb + tema ===== */}
        <header className="sticky top-0 z-40 -mx-4 mb-5 border-b border-slate-200/80 bg-slate-100/70 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6 dark:border-slate-800/80 dark:bg-slate-950/70">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Link href="/dev" className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[1px] shadow-md shadow-blue-500/20">
                  <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-white dark:bg-slate-950">
                    <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="block max-w-[200px] truncate text-base leading-none font-extrabold tracking-tight text-slate-900 sm:max-w-none dark:text-white">
                    {outlet.name}
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    Drill-down outlet · baca-saja
                  </span>
                </div>
              </Link>

              <div className="hidden items-center space-x-2 border-l border-slate-200 pl-4 text-xs font-medium text-slate-500 md:flex dark:border-slate-800 dark:text-slate-400">
                <Link
                  href="/dev"
                  className="text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  Konsol
                </Link>
                <span className="text-slate-400 dark:text-slate-600">/</span>
                <span className="truncate font-semibold text-slate-700 dark:text-slate-300">
                  {outlet.name}
                </span>
              </div>
            </div>

            <ThemeHeaderActions />
          </div>
        </header>

        <Link
          href="/dev"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali ke konsol developer
        </Link>

        <header className="mt-4 mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
              {outlet.name}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {outlet.address || "alamat belum diisi"}
              {outlet.phone ? ` · ${outlet.phone}` : ""}
              {!outlet.is_active && (
                <span className="ml-2 rounded-full border border-slate-400/20 bg-slate-400/10 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  nonaktif
                </span>
              )}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              Data bisnis tampil baca-saja; mode maintenance di bawah untuk
              membuka konsol owner / kasir outlet ini.
            </p>
          </div>
        </header>

        {/* Mode maintenance (Task 35): developer "menjadi" staf outlet ini
            — membuka /owner atau /cashier yang isinya mengikuti outlet.
            Masuk & keluar tercatat (DEV_MAINTENANCE_ENTER/EXIT). */}
        <section className="mt-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5 dark:border-amber-500/20 dark:bg-amber-950/20">
          <h2 className="flex items-center gap-2 text-lg font-bold text-amber-900 dark:text-amber-300">
            <Wrench className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            Akses Maintenance
          </h2>
          <p className="mt-0.5 text-sm text-amber-800/90 dark:text-amber-200/80">
            Buka area owner atau kasir outlet {outlet.name} seolah Anda
            stafnya — untuk men-debug, melatih, atau memperbaiki. Banner
            amber di halaman tersebut jadi pengingat bahwa Anda sedang
            bertindak sebagai developer; tekan &quot;Keluar Mode&quot; untuk
            kembali.
          </p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <form action={enterMaintenance.bind(null, String(outlet.id), "owner")}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98]"
              >
                <LayoutDashboard className="h-4 w-4" />
                Buka Konsol Owner
              </button>
            </form>
            <form action={enterMaintenance.bind(null, String(outlet.id), "cashier")}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98]"
              >
                <Calculator className="h-4 w-4" />
                Buka Kasir (POS)
              </button>
            </form>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.map((card) => (
            <div key={card.label} className="glass-card rounded-2xl p-4">
              <p className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                <span className="font-medium">{card.label}</span>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl border ${card.tint}`}
                >
                  <card.icon className="h-4 w-4" />
                </span>
              </p>
              <p
                className={`mt-1.5 truncate text-lg font-black tabular-nums sm:text-xl ${
                  card.label === "Stok Menipis" && lowStockCount > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-slate-900 dark:text-white"
                }`}
              >
                {card.value}
              </p>
            </div>
          ))}
        </section>

        <section className="glass-card mt-4 rounded-2xl border-slate-200/80 p-5 dark:border-slate-800/80">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Produk &amp; Stok (200 teratas)
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-100/70 text-left text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">Produk</th>
                  <th className="px-4 py-3 font-semibold">Kategori</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Harga
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">Stok</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const low = p.is_active && p.stock <= p.min_stock;
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-slate-200/60 transition-colors last:border-0 hover:bg-slate-100/60 dark:border-slate-800/50 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {p.name}
                        {!p.is_active && (
                          <span className="ml-2 rounded-full border border-slate-400/20 bg-slate-400/10 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                            arsip
                          </span>
                        )}
                        <p className="font-mono text-[11px] font-medium tracking-wide text-slate-400 uppercase dark:text-slate-500">
                          {p.sku ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {p.category || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                        {formatRupiah(Math.round(Number(p.price)))}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {p.stock} {p.unit}
                      </td>
                      <td className="px-4 py-3">
                        {low ? (
                          <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                            menipis
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            {p.is_active ? "aman" : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      Outlet ini belum punya produk.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="glass-card rounded-2xl border-slate-200/80 p-5 dark:border-slate-800/80">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Pengguna Outlet
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Kelola akun (reset password, nonaktif, hapus) lewat{" "}
              <Link
                href="/dev/users"
                className="font-semibold text-violet-700 hover:underline dark:text-violet-400"
              >
                Kelola Akun
              </Link>
              . Akun terhapus tidak ditampilkan.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-100/70 text-left text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-400">
                    <th className="px-4 py-3 font-semibold">Nama</th>
                    <th className="px-4 py-3 font-semibold">Peran</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-slate-200/60 transition-colors last:border-0 hover:bg-slate-100/60 dark:border-slate-800/50 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {u.name}
                        </p>
                        <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                          {u.email}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {u.role}
                      </td>
                      <td className="px-4 py-3">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                            aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-500/20 bg-slate-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            nonaktif
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                      >
                        Belum ada pengguna terikat outlet ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="glass-card rounded-2xl border-slate-200/80 p-5 dark:border-slate-800/80">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Transaksi Terbaru
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Hari ini: {todayCount} transaksi ·{" "}
              {formatRupiah(omzetToday)}
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[460px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-100/70 text-left text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-400">
                    <th className="px-4 py-3 font-semibold">Struk</th>
                    <th className="px-4 py-3 font-semibold">Waktu (WIB)</th>
                    <th className="px-4 py-3 font-semibold">Kasir</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-slate-200/60 transition-colors last:border-0 hover:bg-slate-100/60 dark:border-slate-800/50 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {t.receipt_no}
                        {t.status === "REFUNDED" && (
                          <span className="ml-2 rounded-full border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 font-sans text-[10px] font-bold text-rose-600 dark:text-rose-400">
                            refund
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">
                        {formatWib(new Date(t.created_at))}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                        {t.cashier_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                        {formatRupiah(Math.round(Number(t.total)))}
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                      >
                        Belum ada transaksi di outlet ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}