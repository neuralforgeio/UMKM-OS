import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/format";

export const instant = false;

// Prisma Decimal -> number (money leaves the DB as Decimal, never Float).
const dec = (value: { toString(): string } | null | undefined) =>
  value ? parseFloat(value.toString()) : 0;

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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

export default async function OwnerPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "OWNER") redirect("/cashier");

  const outlet = session.user.outletId
    ? await prisma.outlet.findUnique({ where: { id: session.user.outletId } })
    : await prisma.outlet.findFirst();
  if (!outlet) redirect("/");

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const [weekRows, itemsTodayAgg, topItems, allProducts, recentRows] =
    await Promise.all([
      prisma.transaction.findMany({
        where: {
          outletId: outlet.id,
          status: "COMPLETED",
          createdAt: { gte: sevenDaysAgo },
        },
        select: { createdAt: true, total: true, paymentMethod: true },
      }),
      prisma.transactionItem.aggregate({
        where: {
          transaction: {
            outletId: outlet.id,
            status: "COMPLETED",
            createdAt: { gte: startOfToday },
          },
        },
        _sum: { quantity: true },
      }),
      prisma.transactionItem.groupBy({
        by: ["productId"],
        where: {
          transaction: {
            outletId: outlet.id,
            status: "COMPLETED",
            createdAt: { gte: sevenDaysAgo },
          },
        },
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
      prisma.product.findMany({
        where: { outletId: outlet.id, isActive: true },
        select: {
          id: true,
          name: true,
          sku: true,
          stock: true,
          minStock: true,
          unit: true,
        },
        orderBy: { stock: "asc" },
      }),
      prisma.transaction.findMany({
        where: { outletId: outlet.id },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          code: true,
          createdAt: true,
          paymentMethod: true,
          total: true,
          cashier: { select: { name: true } },
        },
      }),
    ]);

  // Bucket the week into 7 local calendar days, oldest first.
  const days: { key: string; label: string; total: number; count: number }[] =
    [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() - i);
    days.push({
      key: dateKey(d),
      label: d.toLocaleDateString("id-ID", { weekday: "short" }),
      total: 0,
      count: 0,
    });
  }
  const bucketByKey = new Map(days.map((d) => [d.key, d]));
  const methodRevenue: Record<string, number> = { CASH: 0, QRIS: 0, DEBIT: 0 };
  const methodCount: Record<string, number> = { CASH: 0, QRIS: 0, DEBIT: 0 };
  for (const row of weekRows) {
    const bucket = bucketByKey.get(dateKey(row.createdAt));
    if (bucket) {
      bucket.total += dec(row.total);
      bucket.count += 1;
    }
    const method = String(row.paymentMethod);
    methodRevenue[method] = (methodRevenue[method] ?? 0) + dec(row.total);
    methodCount[method] = (methodCount[method] ?? 0) + 1;
  }

  const today = days[days.length - 1];
  const yesterday = days[days.length - 2];
  const weekTotal = days.reduce((sum, d) => sum + d.total, 0);
  const weekCount = weekRows.length;
  const maxDay = Math.max(...days.map((d) => d.total), 1);

  const omzetToday = today.total;
  const trxToday = today.count;
  const itemsToday = itemsTodayAgg._sum.quantity ?? 0;
  const avgToday = trxToday > 0 ? omzetToday / trxToday : 0;
  const deltaPct =
    yesterday.total > 0
      ? Math.round(((omzetToday - yesterday.total) / yesterday.total) * 100)
      : null;

  const topProducts = topItems.length
    ? await prisma.product.findMany({
        where: { id: { in: topItems.map((t) => t.productId) } },
        select: { id: true, name: true, unit: true },
      })
    : [];
  const productById = new Map(topProducts.map((p) => [p.id, p]));
  const topList = topItems.map((t) => ({
    name: productById.get(t.productId)?.name ?? "Produk",
    unit: productById.get(t.productId)?.unit ?? "pcs",
    qty: t._sum.quantity ?? 0,
    revenue: dec(t._sum.subtotal),
  }));

  const lowStock = allProducts
    .filter((p) => p.stock <= p.minStock)
    .map((p) => ({ ...p, restock: Math.max(p.minStock * 2 - p.stock, 1) }));

  const recent = recentRows.map((row) => {
    const meta = METHOD_META.find((m) => m.key === String(row.paymentMethod));
    return {
      code: row.code,
      cashier: row.cashier?.name ?? "-",
      time: row.createdAt.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      methodLabel: meta?.label ?? String(row.paymentMethod),
      methodBadge: meta?.badge ?? "bg-slate-100 text-slate-600",
      total: dec(row.total),
    };
  });

  const initials = outlet.name
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-dvh flex-col bg-slate-100">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <StorefrontIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight text-slate-900">
                Laporan — {outlet.name}
              </h1>
              <p className="truncate text-xs text-slate-500">
                {session.user.name ?? "Pemilik"} · Pemilik
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="shrink-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Beranda
          </Link>
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
            sub={<span>{yesterday.count} struk kemarin</span>}
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
                        {p.sku} · min {p.minStock} {p.unit}
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
