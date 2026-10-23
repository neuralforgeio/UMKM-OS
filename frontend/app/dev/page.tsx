// Konsol Developer (Fase A + B).
// Super-user lintas outlet: ringkasan sistem, pintasan kelola akun &
// log aktivitas, daftar outlet (klik = drill-down), dan 20 jejak audit
// terbaru. Fase C menambah kelola akun oleh owner + Akun Saya.
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Building2,
  LogOut,
  ScrollText,
  ShieldCheck,
  Store,
  TriangleAlert,
  UserCog,
  Users,
} from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/format";

export const instant = false;

const ROLE_BADGE: Record<string, string> = {
  OWNER: "bg-blue-100 text-blue-700",
  KASIR: "bg-emerald-100 text-emerald-700",
  DEVELOPER: "bg-violet-100 text-violet-700",
};

function formatWib(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export default async function DevConsolePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Hanya DEVELOPER boleh melihat konsol ini — owner & kasir punya
  // halamannya sendiri dan tidak boleh membaca data lintas outlet.
  if (session.user.role !== "DEVELOPER") redirect("/");

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    outlets,
    activeUsers,
    todayAgg,
    lowStockCount,
    omzetByOutlet,
    auditEvents,
  ] = await Promise.all([
    prisma.outlet.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        isActive: true,
        _count: { select: { products: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.count({ where: { isActive: true, deletedAt: null } }),
    prisma.transaction.aggregate({
      where: { status: "COMPLETED", createdAt: { gte: startOfToday } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.product.count({
      where: {
        isActive: true,
        stock: { lte: prisma.product.fields.minStock },
      },
    }),
    prisma.transaction.groupBy({
      by: ["outletId"],
      where: { status: "COMPLETED", createdAt: { gte: startOfToday } },
      _sum: { total: true },
    }),
    prisma.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        actor: { select: { name: true, role: true } },
        outlet: { select: { name: true } },
      },
    }),
  ]);

  const omzetToday = todayAgg._sum.total
    ? parseFloat(todayAgg._sum.total.toString())
    : 0;
  const omzetMap = new Map<string, number>();
  for (const row of omzetByOutlet) {
    omzetMap.set(
      row.outletId,
      row._sum.total ? parseFloat(row._sum.total.toString()) : 0,
    );
  }

  const statCards = [
    { label: "Outlet", value: String(outlets.length), icon: Building2 },
    { label: "Akun Aktif", value: String(activeUsers), icon: Users },
    { label: "Omzet Hari Ini", value: formatRupiah(omzetToday), icon: Store },
    {
      label: "Stok Menipis",
      value: String(lowStockCount),
      icon: TriangleAlert,
    },
  ];

  return (
    <div className="min-h-dvh bg-slate-100">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:py-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight text-slate-900">
                UMKM OS — Konsol Developer
              </p>
              <p className="truncate text-xs text-slate-500">
                {session.user.name ?? "Developer"} · akses lintas outlet
              </p>
            </div>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </form>
        </header>

        {/* Pintasan Fase B: dua pintu utama konsol. Kartu besar + panah —
            bukan menu tersembunyi, karena ini alasan konsol ini ada. */}
        <section className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link
            href="/dev/users"
            className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-violet-300 hover:shadow-md"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
                <UserCog className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">Kelola Akun</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Buat owner & kasir, reset password, nonaktifkan, hapus —
                  semua outlet.
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-600" />
          </Link>
          <Link
            href="/dev/logs"
            className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-violet-300 hover:shadow-md"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
                <ScrollText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">
                  Log Aktivitas
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Query jejak audit lengkap: filter aksi/outlet/aktor/tanggal
                  + unduh CSV.
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-600" />
          </Link>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          <h2 className="text-lg font-bold text-slate-900">Outlet</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Setiap outlet punya produk, stok, dan akunnya sendiri — terpisah
            secara data, satu database, satu pantauan. Klik nama outlet untuk
            drill-down detail.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-4 font-semibold">Outlet</th>
                  <th className="pb-2 pr-4 font-semibold">Alamat</th>
                  <th className="pb-2 pr-4 font-semibold">Produk</th>
                  <th className="pb-2 font-semibold">Omzet Hari Ini</th>
                </tr>
              </thead>
              <tbody>
                {outlets.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="py-2.5 pr-4 font-semibold text-slate-900">
                      <Link
                        href={`/dev/outlets/${o.id}`}
                        className="transition hover:text-violet-700 hover:underline"
                      >
                        {o.name}
                      </Link>
                      {!o.isActive && (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          nonaktif
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-500">
                      {o.address ?? "—"}
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums text-slate-700">
                      {o._count.products}
                    </td>
                    <td className="py-2.5 tabular-nums text-slate-700">
                      {formatRupiah(omzetMap.get(o.id) ?? 0)}
                    </td>
                  </tr>
                ))}
                {outlets.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      Belum ada outlet terdaftar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Activity className="h-5 w-5 text-violet-600" />
            Jejak Audit Terbaru
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Semua aksi tercatat: transaksi, refund, penyajian struk, stok,
            produk, pengaturan, akun, dan login.{" "}
            <Link
              href="/dev/logs"
              className="font-semibold text-violet-700 hover:underline"
            >
              Buka query penuh + unduh CSV →
            </Link>
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-4 font-semibold">Waktu (WIB)</th>
                  <th className="pb-2 pr-4 font-semibold">Aktor</th>
                  <th className="pb-2 pr-4 font-semibold">Outlet</th>
                  <th className="pb-2 pr-4 font-semibold">Aksi</th>
                  <th className="pb-2 font-semibold">Ringkasan</th>
                </tr>
              </thead>
              <tbody>
                {auditEvents.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-slate-100 last:border-0 align-top"
                  >
                    <td className="whitespace-nowrap py-2.5 pr-4 text-xs text-slate-500">
                      {formatWib(e.createdAt)}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="font-semibold text-slate-800">
                        {e.actor?.name ?? "Sistem"}
                      </span>
                      {e.actor && (
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            ROLE_BADGE[e.actor.role] ??
                            "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {e.actor.role}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-500">
                      {e.outlet?.name ?? "—"}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                          e.action === "LOGIN_FAILED"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {e.action}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-700">{e.summary}</td>
                  </tr>
                ))}
                {auditEvents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      Belum ada aksi tercatat — jalankan satu transaksi di kasir
                      lalu muat ulang halaman ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-4 text-center text-xs text-slate-400">
          Fase A + B aktif · Fase C (kelola kasir oleh owner + log CSV owner +
          Akun Saya semua peran) menyusul setelah blok ini diverifikasi.
        </p>
      </div>
    </div>
  );
}
