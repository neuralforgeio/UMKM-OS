import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Calculator,
  LogOut,
  Store,
  TriangleAlert,
} from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { goFetch } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { LiveClock } from "@/components/live-clock";
import { AuroraBackground } from "@/components/aurora-background";
import { ThemeHeaderActions } from "@/components/theme-header-actions";

export const instant = false;

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Developer punya konsol sendiri lintas outlet - halaman peluncur ini berbasis satu outlet dan tidak relevan untuk super-user
  if (session.user.role === "DEVELOPER") redirect("/dev");

  const outlet = session.user.outletId
    ? await prisma.outlet.findUnique({ where: { id: session.user.outletId } })
    : await prisma.outlet.findFirst();

  const isOwner = session.user.role === "OWNER";
  const displayName = session.user.name ?? "Pengguna";

  // Owner briefing: a tiny live snapshot so the launcher page already
  // answers "how is the warung doing today" without opening reports.
  // Angka kini dari backend-go (satu sumber data) â€” kalau backend tidak
  // merespons, kartu statistik dilewati, halaman tetap terbuka.
  let stats: {
    omzetToday: number;
    trxToday: number;
    itemsToday: number;
    lowStock: number;
  } | null = null;

  if (isOwner && session.user.goToken) {
    const dash = await goFetch<{
      today: { revenue: number; transactions: number; items_sold: number };
      low_stock: unknown[];
    }>(session.user.goToken, "/reports/dashboard");
    // Bentuk respons diverifikasi SEBELUM dibaca: backend lama (pra
    // v1.1.0) menjawab /reports/dashboard dengan kolom rata
    // (today_revenue, low_stock_products) tanpa objek "today" â€” kartu
    // statistik cukup dilewati, halaman peluncur tetap terbuka. Setelah
    // proses lama dimatikan dan backend-go v1.1.0+ yang menjawab, kartu
    // statistik muncul lagi sendirinya.
    if (dash.ok && dash.data.today && Array.isArray(dash.data.low_stock)) {
      stats = {
        omzetToday: dash.data.today.revenue,
        trxToday: dash.data.today.transactions,
        itemsToday: dash.data.today.items_sold,
        lowStock: dash.data.low_stock.length,
      };
    }
  }

  const menu = [
    {
      href: "/cashier",
      title: "Kasir",
      desc: "Buka transaksi penjualan",
      icon: Calculator,
      iconClass: "bg-blue-600 text-white",
    },
    ...(isOwner
      ? [
          {
            href: "/owner",
            title: "Laporan Owner",
            desc: "Omzet, peramalan, dan restok",
            icon: BarChart3,
            iconClass: "bg-indigo-600 text-white",
          },
          {
            href: "/owner/products",
            title: "Kelola Produk",
            desc: "Produk, harga, stok, dan foto",
            icon: Boxes,
            iconClass: "bg-violet-600 text-white",
          },
        ]
      : []),
  ];

  const statCards = stats
    ? [
        { label: "Omzet Hari Ini", value: formatRupiah(stats.omzetToday) },
        { label: "Transaksi", value: String(stats.trxToday) },
        { label: "Item Terjual", value: String(stats.itemsToday) },
        {
          label: "Stok Menipis",
          value: String(stats.lowStock),
          warn: stats.lowStock > 0,
        },
      ]
    : [];

  return (
    // Shell aurora (v1.8.0): beranda/peluncur peran ikut tema pengguna â€”
    // kartu pintasan memakai kaca, toggle tema & /settings ada di header.
    <div className="relative min-h-dvh bg-slate-100 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4 py-5 sm:py-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/25">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight text-slate-900 dark:text-slate-100">
                UMKM OS
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {outlet?.name ?? "Warung"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeHeaderActions />
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                isOwner
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              }`}
            >
              {isOwner ? "PEMILIK" : "KASIR"}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </form>
          </div>
        </header>

        <section className="relative mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 text-white sm:p-9">
          <div
            aria-hidden="true"
            className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl"
          />
          <div className="relative">
            <LiveClock />
            <h1 className="mt-4 text-2xl font-bold leading-tight sm:text-4xl">
              Selamat datang, {displayName}
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-blue-100 sm:text-base">
              Kasir, laporan, stok, dan foto produk warung semuanya siap
              dipakai dalam satu tempat.
            </p>
          </div>
        </section>

        {statCards.length > 0 && (
          <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl glass-card p-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {card.label}
                </p>
                <p
                  className={`mt-1.5 truncate text-lg font-bold tabular-nums sm:text-xl ${
                    card.warn ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-slate-100"
                  }`}
                >
                  {card.value}
                </p>
                {card.warn && (
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                    <TriangleAlert className="h-3 w-3" />
                    perlu restok
                  </p>
                )}
              </div>
            ))}
          </section>
        )}

        <nav className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {menu.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-4 rounded-2xl glass-card p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${item.iconClass}`}
              >
                <item.icon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {item.title}
                </p>
                <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
                  {item.desc}
                </p>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
            </Link>
          ))}
        </nav>

        {!isOwner && (
          <p className="mt-3 rounded-2xl glass-card px-4 py-3 text-center text-xs text-slate-400 dark:text-slate-500">
            Laporan dan pengaturan warung hanya bisa dibuka oleh pemilik.
          </p>
        )}

        <p className="mt-auto pt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          UMKM OS Â· demo warung digital â€” kasir, laporan, dan peramalan
        </p>
      </div>
    </div>
  );
}