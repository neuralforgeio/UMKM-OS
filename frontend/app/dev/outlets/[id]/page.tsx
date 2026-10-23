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
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/format";
import { enterMaintenance } from "@/app/dev/maintenance-actions";

export const instant = false;

function formatWib(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

// Drill-down outlet (Task 34 Fase B) — data bisnis READ-ONLY by design:
// developer MEMBACA untuk memantau, mengubah hanya lewat jalurnya
// masing-masing (produk/stok oleh owner outlet, akun oleh /dev/users).
// Task 35 menambah pintu MAINTENANCE: developer bisa membuka konsol
// owner & POS kasir outlet ini "menjadi stafnya" — memakai cookie
// dev_outlet yang disuntikkan ke sesi (lihat lib/auth.ts), keluar
// kapan saja lewat banner amber.
export default async function DevOutletDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "DEVELOPER") redirect("/");

  const { id } = await params;
  const outlet = await prisma.outlet.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      isActive: true,
      createdAt: true,
    },
  });
  if (!outlet) notFound();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [products, users, transactions, todayAgg, lowStockCount] =
    await Promise.all([
      prisma.product.findMany({
        where: { outletId: outlet.id },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        take: 200,
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          stock: true,
          minStock: true,
          unit: true,
          isActive: true,
          category: { select: { name: true } },
        },
      }),
      prisma.user.findMany({
        // Task 35: akun terhapus tidak pernah tampil di sini — dari
        // sudut pandang daftar, hapus = selamanya.
        where: { outletId: outlet.id, deletedAt: null },
        orderBy: [{ role: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      }),
      prisma.transaction.findMany({
        where: { outletId: outlet.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          code: true,
          createdAt: true,
          total: true,
          status: true,
          paymentMethod: true,
          cashier: { select: { name: true } },
        },
      }),
      prisma.transaction.aggregate({
        where: {
          outletId: outlet.id,
          status: "COMPLETED",
          createdAt: { gte: startOfToday },
        },
        _count: true,
        _sum: { total: true },
      }),
      prisma.product.count({
        where: {
          outletId: outlet.id,
          isActive: true,
          stock: { lte: prisma.product.fields.minStock },
        },
      }),
    ]);

  const omzetToday = todayAgg._sum.total
    ? parseFloat(todayAgg._sum.total.toString())
    : 0;
  const activeUsers = users.filter((u) => u.isActive).length;

  const statCards = [
    { label: "Produk", value: String(products.length), icon: Boxes },
    {
      label: "Stok Menipis",
      value: String(lowStockCount),
      icon: TriangleAlert,
    },
    { label: "Pengguna Aktif", value: String(activeUsers), icon: Users },
    {
      label: "Omzet Hari Ini",
      value: formatRupiah(omzetToday),
      icon: Store,
    },
  ];

  return (
    <div className="min-h-dvh bg-slate-100">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:py-8">
        <Link
          href="/dev"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-violet-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali ke konsol developer
        </Link>

        <header className="mt-3 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-slate-900">
              {outlet.name}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {outlet.address ?? "alamat belum diisi"}
              {outlet.phone ? ` · ${outlet.phone}` : ""}
              {!outlet.isActive && (
                <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  nonaktif
                </span>
              )}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Data bisnis tampil baca-saja; mode maintenance di bawah untuk
              membuka konsol owner / kasir outlet ini.
            </p>
          </div>
        </header>

        {/* Mode maintenance (Task 35): developer "menjadi" staf outlet ini
            — membuka /owner atau /cashier yang isinya mengikuti outlet.
            Masuk & keluar tercatat (DEV_MAINTENANCE_ENTER/EXIT). */}
        <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-bold text-amber-900">
            <Wrench className="h-5 w-5 text-amber-600" />
            Akses Maintenance
          </h2>
          <p className="mt-0.5 text-sm text-amber-800/90">
            Buka area owner atau kasir outlet {outlet.name} seolah Anda
            stafnya — untuk men-debug, melatih, atau memperbaiki. Banner
            amber di halaman tersebut jadi pengingat bahwa Anda sedang
            bertindak sebagai developer; tekan "Keluar Mode" untuk kembali.
          </p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <form action={enterMaintenance.bind(null, outlet.id, "owner")}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
              >
                <LayoutDashboard className="h-4 w-4" />
                Buka Konsol Owner
              </button>
            </form>
            <form action={enterMaintenance.bind(null, outlet.id, "cashier")}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
              >
                <Calculator className="h-4 w-4" />
                Buka Kasir (POS)
              </button>
            </form>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl bg-white p-4 shadow-sm"
            >
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <card.icon className="h-3.5 w-3.5" />
                {card.label}
              </p>
              <p
                className={`mt-1.5 truncate text-lg font-bold tabular-nums sm:text-xl ${
                  card.label === "Stok Menipis" && lowStockCount > 0
                    ? "text-amber-600"
                    : "text-slate-900"
                }`}
              >
                {card.value}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Produk &amp; Stok (200 teratas)
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-4 font-semibold">Produk</th>
                  <th className="pb-2 pr-4 font-semibold">Kategori</th>
                  <th className="pb-2 pr-4 text-right font-semibold">
                    Harga
                  </th>
                  <th className="pb-2 pr-4 text-right font-semibold">Stok</th>
                  <th className="pb-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const low = p.isActive && p.stock <= p.minStock;
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-2.5 pr-4 font-semibold text-slate-900">
                        {p.name}
                        {!p.isActive && (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                            arsip
                          </span>
                        )}
                        <p className="font-mono text-[11px] font-medium uppercase tracking-wide text-slate-400">
                          {p.sku}
                        </p>
                      </td>
                      <td className="py-2.5 pr-4 text-slate-500">
                        {p.category?.name ?? "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-semibold tabular-nums text-slate-700">
                        {formatRupiah(Math.round(Number(p.price)))}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-slate-700">
                        {p.stock} {p.unit}
                      </td>
                      <td className="py-2.5">
                        {low ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                            menipis
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {p.isActive ? "aman" : "—"}
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
                      className="py-6 text-center text-sm text-slate-400"
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
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              Pengguna Outlet
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Kelola akun (reset password, nonaktif, hapus) lewat{" "}
              <Link
                href="/dev/users"
                className="font-semibold text-violet-700 hover:underline"
              >
                Kelola Akun
              </Link>
              . Akun terhapus tidak ditampilkan.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="pb-2 pr-4 font-semibold">Nama</th>
                    <th className="pb-2 pr-4 font-semibold">Peran</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-2.5 pr-4">
                        <p className="font-semibold text-slate-900">
                          {u.name}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {u.email}
                        </p>
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600">{u.role}</td>
                      <td className="py-2.5">
                        {u.isActive ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
                            aktif
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
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
                        className="py-6 text-center text-sm text-slate-400"
                      >
                        Belum ada pengguna terikat outlet ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              Transaksi Terbaru
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Hari ini: {todayAgg._count} transaksi ·{" "}
              {formatRupiah(omzetToday)}
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[460px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="pb-2 pr-4 font-semibold">Struk</th>
                    <th className="pb-2 pr-4 font-semibold">Waktu (WIB)</th>
                    <th className="pb-2 pr-4 font-semibold">Kasir</th>
                    <th className="pb-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-2.5 pr-4 font-mono text-xs font-semibold text-slate-700">
                        {t.code}
                        {t.status === "REFUNDED" && (
                          <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 font-sans text-[10px] font-bold text-red-600">
                            refund
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-4 text-xs text-slate-500">
                        {formatWib(t.createdAt)}
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-slate-500">
                        {t.cashier?.name ?? "—"}
                      </td>
                      <td className="py-2.5 text-right font-semibold tabular-nums text-slate-700">
                        {formatRupiah(Math.round(Number(t.total)))}
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-6 text-center text-sm text-slate-400"
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
