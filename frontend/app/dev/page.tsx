// Konsol Developer (Fase A + B + penyempurnaan Task 35).
// Super-user lintas outlet: ringkasan sistem, pintasan kelola akun &
// log aktivitas, daftar outlet (klik = drill-down, tombol + = buat baru),
// dan 20 jejak audit terbaru yang tampil dengan LABEL MANUSIAWI +
// tingkat SUKSES/PERINGATAN/GAGAL.
// v1.6.0: design aurora + glassmorphism ala konsol Kelola Akun, kini
// SADAR TEMA (terang/gelap/sistem) + toggle tema & pintu /settings di
// topbar. Logika data Prisma TIDAK berubah sedikit pun.
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
import {
  LEVEL_BADGE,
  actionLabel,
  actionLevel,
} from "@/lib/audit-labels";
import { AuroraBackground } from "@/components/aurora-background";
import { ThemeHeaderActions } from "@/components/theme-header-actions";
import { OutletCreateButton } from "./outlet-create-button";

export const instant = false;

const ROLE_BADGE: Record<string, string> = {
  OWNER: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  KASIR: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  DEVELOPER: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
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
  // Hanya DEVELOPER boleh melihat konsol ini â€” owner & kasir punya
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
    {
      label: "Outlet",
      value: String(outlets.length),
      icon: Building2,
      tint: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400",
    },
    {
      label: "Akun Aktif",
      value: String(activeUsers),
      icon: Users,
      tint: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      label: "Omzet Hari Ini",
      value: formatRupiah(omzetToday),
      icon: Store,
      tint: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Stok Menipis",
      value: String(lowStockCount),
      icon: TriangleAlert,
      tint: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <div className="relative min-h-dvh bg-slate-100 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        {/* ===== Topbar: brand + breadcrumb + tema + keluar ===== */}
        <header className="sticky top-0 z-40 -mx-4 mb-5 border-b border-slate-200/80 bg-slate-100/70 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6 dark:border-slate-800/80 dark:bg-slate-950/70">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Link href="/dev" className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 via-purple-600 to-fuchsia-400 p-[1px] shadow-md shadow-violet-500/20">
                  <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-white dark:bg-slate-950">
                    <ShieldCheck className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                </div>
                <div>
                  <span className="block text-base leading-none font-extrabold tracking-tight text-slate-900 dark:text-white">
                    UMKM OS
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    Konsol Developer
                  </span>
                </div>
              </Link>

              <div className="hidden items-center space-x-2 border-l border-slate-200 pl-4 text-xs font-medium text-slate-500 md:flex dark:border-slate-800 dark:text-slate-400">
                <span className="truncate">
                  {session.user.name ?? "Developer"} Â· akses lintas outlet
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <ThemeHeaderActions />

              <div className="hidden h-6 w-[1px] bg-slate-200 sm:block dark:bg-slate-800" />

              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3.5 py-2 text-sm font-semibold text-slate-600 backdrop-blur transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Keluar</span>
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* Pintasan Fase B: dua pintu utama konsol. Kartu besar + panah â€”
            bukan menu tersembunyi, karena ini alasan konsol ini ada. */}
        <section className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/dev/users"
            className="glass-card group flex items-center justify-between gap-3 rounded-2xl p-5 transition-all hover:border-violet-500/40"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-purple-600 text-white shadow-md shadow-violet-500/20">
                <UserCog className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Kelola Akun
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Buat owner &amp; kasir, reset password, nonaktifkan, hapus -
                  semua outlet.
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-violet-600 dark:text-slate-600 dark:group-hover:text-violet-400" />
          </Link>
          <Link
            href="/dev/logs"
            className="glass-card group flex items-center justify-between gap-3 rounded-2xl p-5 transition-all hover:border-violet-500/40"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20">
                <ScrollText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Log Aktivitas
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Query jejak audit lengkap + filter tingkat &amp; unduh Excel
                  dengan grafik analisa.
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-violet-600 dark:text-slate-600 dark:group-hover:text-violet-400" />
          </Link>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="glass-card rounded-2xl p-4 transition-all"
            >
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Outlet
              </h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Setiap outlet punya produk, stok, dan akunnya sendiri, terpisah
                secara data, satu database, satu pantauan. Klik nama outlet
                untuk drill-down atau masuk mode maintenance.
              </p>
            </div>
            <OutletCreateButton />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-100/70 text-left text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">Outlet</th>
                  <th className="px-4 py-3 font-semibold">Alamat</th>
                  <th className="px-4 py-3 font-semibold">Produk</th>
                  <th className="px-4 py-3 font-semibold">Omzet Hari Ini</th>
                </tr>
              </thead>
              <tbody>
                {outlets.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-slate-200/60 transition-colors last:border-0 hover:bg-slate-100/60 dark:border-slate-800/50 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      <Link
                        href={`/dev/outlets/${o.id}`}
                        className="transition hover:text-violet-700 hover:underline dark:hover:text-violet-400"
                      >
                        {o.name}
                      </Link>
                      {!o.isActive && (
                        <span className="ml-2 rounded-full border border-slate-400/20 bg-slate-400/10 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          nonaktif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {o.address ?? "â€”"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">
                      {o._count.products}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">
                      {formatRupiah(omzetMap.get(o.id) ?? 0)}
                    </td>
                  </tr>
                ))}
                {outlets.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      Belum ada outlet terdaftar â€” tekan &quot;Outlet Baru&quot;
                      untuk membuat yang pertama.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="glass-card mt-4 rounded-2xl border-slate-200/80 p-5 dark:border-slate-800/80">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
            <Activity className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            Jejak Audit Terbaru
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Semua aksi tercatat dengan tingkat keseriusan:{" "}
            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-500/30">
              SUKSES
            </span>{" "}
            selesai normal,{" "}
            <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-500/30">
              PERINGATAN
            </span>{" "}
            aksi sensitif,{" "}
            <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-500/30">
              GAGAL
            </span>{" "}
            percobaan yang error.{" "}
            <Link
              href="/dev/logs"
              className="font-semibold text-violet-700 hover:underline dark:text-violet-400"
            >
              Buka query penuh + unduh Excel â†’
            </Link>
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-100/70 text-left text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">Waktu (WIB)</th>
                  <th className="px-4 py-3 font-semibold">Aktor</th>
                  <th className="px-4 py-3 font-semibold">Outlet</th>
                  <th className="px-4 py-3 font-semibold">Aksi</th>
                  <th className="px-4 py-3 font-semibold">Ringkasan</th>
                </tr>
              </thead>
              <tbody>
                {auditEvents.map((e) => {
                  const level = actionLevel(e.action);
                  return (
                    <tr
                      key={e.id}
                      className={`border-b border-slate-200/60 align-top last:border-0 dark:border-slate-800/50 ${
                        level === "GAGAL"
                          ? "bg-red-50/40 dark:bg-red-950/20"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">
                        {formatWib(e.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {e.actor?.name ?? "Sistem"}
                        </span>
                        {e.actor && (
                          <span
                            className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              ROLE_BADGE[e.actor.role] ??
                              "bg-slate-400/10 text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            {e.actor.role}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {e.outlet?.name ?? "â€”"}
                      </td>
                      <td className="px-4 py-3">
                        {/* Label manusiawi + kode mentah di bawahnya:
                            terbaca cepat DAN tetap bisa dicari. */}
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${LEVEL_BADGE[level]}`}
                        >
                          {actionLabel(e.action)}
                        </span>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                          {e.action}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {e.summary}
                      </td>
                    </tr>
                  );
                })}
                {auditEvents.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      Belum ada aksi tercatat â€” jalankan satu transaksi di
                      kasir lalu muat ulang halaman ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
          Fase A + B + penyempurnaan Task 35 aktif Â· Fase C (kelola kasir oleh
          owner + Akun Saya semua peran) menyusul setelah blok ini
          diverifikasi.
        </p>
      </div>
    </div>
  );
}