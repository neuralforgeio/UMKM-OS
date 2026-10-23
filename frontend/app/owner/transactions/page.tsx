import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TransactionsClient } from "./transactions-client";
import type { ProfitSummary, TransactionRow } from "./types";

export const instant = false;

// Latest N receipts loaded for the history list — 200 covers roughly a
// busy fortnight at warung scale; older history stays queryable the
// day the page grows real pagination.
const LIST_LIMIT = 200;

// Structural types matching the Prisma aggregate / groupBy results so
// buildSummary can stay decoupled from the generated client types.
type TrxAgg = {
  _count: number;
  _sum: { total: { toString(): string } | null };
};
type ItemAgg = {
  productId: string;
  _sum: { quantity: number | null; subtotal: { toString(): string } | null };
};

const dec = (value: { toString(): string } | null | undefined) =>
  value ? Math.round(parseFloat(value.toString())) : 0;

export default async function OwnerTransactionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "OWNER" && session.user.role !== "DEVELOPER") redirect("/cashier");

  // Owners may not be tied to an outlet; fall back to the first one,
  // mirroring the cashier and dashboard resolution.
  const outletId =
    session.user.outletId ??
    (await prisma.outlet.findFirst({ select: { id: true } }))?.id;
  if (!outletId) redirect("/owner");

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const since7 = new Date(startOfToday);
  since7.setDate(since7.getDate() - 6);
  const since30 = new Date(startOfToday);
  since30.setDate(since30.getDate() - 29);

  const [outlet, rows, weekAgg, weekItems, monthAgg, monthItems, products] =
    await Promise.all([
      prisma.outlet.findUnique({
        where: { id: outletId },
        select: { name: true },
      }),
      prisma.transaction.findMany({
        where: { outletId },
        orderBy: { createdAt: "desc" },
        take: LIST_LIMIT,
        select: {
          id: true,
          code: true,
          createdAt: true,
          paymentMethod: true,
          status: true,
          subtotal: true,
          discount: true,
          total: true,
          cashier: { select: { name: true } },
          claimCode: true,
          handoverStatus: true,
          _count: { select: { items: true } },
        },
      }),
      // Omzet per period: only COMPLETED money counts — refunds
      // returned the money, so they are excluded from every profit
      // figure on the page.
      prisma.transaction.aggregate({
        where: {
          outletId,
          status: "COMPLETED",
          createdAt: { gte: since7 },
        },
        _count: true,
        _sum: { total: true },
      }),
      prisma.transactionItem.groupBy({
        by: ["productId"],
        where: {
          transaction: {
            outletId,
            status: "COMPLETED",
            createdAt: { gte: since7 },
          },
        },
        _sum: { quantity: true, subtotal: true },
      }),
      prisma.transaction.aggregate({
        where: {
          outletId,
          status: "COMPLETED",
          createdAt: { gte: since30 },
        },
        _count: true,
        _sum: { total: true },
      }),
      prisma.transactionItem.groupBy({
        by: ["productId"],
        where: {
          transaction: {
            outletId,
            status: "COMPLETED",
            createdAt: { gte: since30 },
          },
        },
        _sum: { quantity: true, subtotal: true },
      }),
      // Current purchase cost per product, for the HPP approximation.
      prisma.product.findMany({
        where: { outletId },
        select: { id: true, name: true, unit: true, cost: true },
      }),
    ]);

  const productById = new Map(products.map((p) => [p.id, p]));

  const listRows: TransactionRow[] = rows.map((row) => ({
    id: row.id,
    code: row.code,
    createdAtIso: row.createdAt.toISOString(),
    paymentMethod: row.paymentMethod,
    status: row.status,
    subtotalRupiah: Math.round(Number(row.subtotal)),
    discountRupiah: Math.round(Number(row.discount)),
    totalRupiah: Math.round(Number(row.total)),
    itemCount: row._count.items,
    cashierName: row.cashier?.name ?? "-",
    claimCode: row.claimCode,
    handoverStatus: row.handoverStatus,
  }));

  // Profit = omzet (after discount) − HPP. HPP multiplies sold quantity
  // by the CURRENT purchase cost: cost is not snapshotted at sale time,
  // so the figure is an honest approximation, disclosed in the UI.
  function buildSummary(
    periodDays: number,
    agg: TrxAgg,
    itemRows: ItemAgg[],
  ): ProfitSummary {
    const omzet = dec(agg._sum.total);
    let cost = 0;
    const profitRows = itemRows.map((row) => {
      const product = productById.get(row.productId);
      const quantity = row._sum.quantity ?? 0;
      const revenue = dec(row._sum.subtotal);
      const rowCost = quantity * Math.round(Number(product?.cost ?? 0));
      cost += rowCost;
      return {
        productId: row.productId,
        name: product?.name ?? "Produk terhapus",
        unit: product?.unit ?? "pcs",
        soldQuantity: quantity,
        revenueRupiah: revenue,
        costRupiah: rowCost,
        profitRupiah: revenue - rowCost,
        marginPct: revenue > 0 ? ((revenue - rowCost) / revenue) * 100 : null,
      };
    });
    profitRows.sort((a, b) => b.revenueRupiah - a.revenueRupiah);
    const profit = omzet - cost;
    return {
      periodDays,
      transactionCount: agg._count,
      omzetRupiah: omzet,
      costRupiah: cost,
      profitRupiah: profit,
      marginPct: omzet > 0 ? (profit / omzet) * 100 : null,
      rows: profitRows,
    };
  }

  return (
    <TransactionsClient
      outletName={outlet?.name ?? "Outlet"}
      userName={session.user.name ?? "Pemilik"}
      rows={listRows}
      weekSummary={buildSummary(7, weekAgg, weekItems)}
      monthSummary={buildSummary(30, monthAgg, monthItems)}
    />
  );
}
