import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  StockClient,
  type StockMovementRow,
  type StockProductOption,
} from "./stock-client";

export const instant = false;

// Build the formatter once at module level; timezone locked to Jakarta.
const timeFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export default async function OwnerStockPage() {
  // Same guard pattern as the products page: reading cookies also makes
  // the route request-dynamic, which is what cacheComponents expects
  // (route segment "dynamic" config is not allowed there).
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "OWNER") redirect("/cashier");

  // Owners may not be tied to an outlet; fall back to the first one,
  // mirroring the products page and dashboard resolution.
  const outletId =
    session.user.outletId ??
    (await prisma.outlet.findFirst({ select: { id: true } }))?.id;
  if (!outletId) redirect("/owner");

  const [products, movements, productAgg, movementCount] = await Promise.all([
    prisma.product.findMany({
      where: { outletId, isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        minStock: true,
        unit: true,
        cost: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.stockMovement.findMany({
      where: { product: { outletId } },
      take: 200,
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { name: true, sku: true, unit: true } },
        user: { select: { name: true } },
        transaction: { select: { code: true } },
      },
    }),
    prisma.product.aggregate({
      where: { outletId, isActive: true },
      _count: true,
      _sum: { stock: true },
    }),
    prisma.stockMovement.count({ where: { product: { outletId } } }),
  ]);

  // Decimals become whole-Rupiah numbers at the boundary, matching the
  // products page convention (warung prices never carry cents).
  const productOptions: StockProductOption[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    stock: product.stock,
    minStock: product.minStock,
    unit: product.unit,
    costRupiah: Math.round(Number(product.cost)),
  }));

  // Rows are plain serializable objects. Display strings are prepared on
  // the server so the client render stays hydration-safe.
  const movementRows: StockMovementRow[] = movements.map((movement) => ({
    id: movement.id,
    productName: movement.product.name,
    sku: movement.product.sku,
    unit: movement.product.unit,
    type: movement.type,
    quantity: movement.quantity,
    unitCostRupiah: movement.unitCost
      ? Math.round(Number(movement.unitCost))
      : null,
    note: movement.note,
    userName: movement.user?.name ?? null,
    transactionCode: movement.transaction?.code ?? null,
    timeLabel: timeFmt.format(movement.createdAt),
  }));

  const lowStockCount = productOptions.filter(
    (product) => product.stock <= product.minStock,
  ).length;

  const stats = [
    { label: "Jenis produk", value: productAgg._count.toLocaleString("id-ID") },
    {
      label: "Total unit stok",
      value: (productAgg._sum.stock ?? 0).toLocaleString("id-ID"),
    },
    { label: "Perlu restok", value: lowStockCount.toLocaleString("id-ID") },
    { label: "Gerakan tercatat", value: movementCount.toLocaleString("id-ID") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Kartu Stok
        </h1>
        <p className="text-sm text-slate-500">
          Catat restok dan hasil opname. Setiap perubahan stok terekam di
          riwayat, terbaru paling atas.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => {
          const warn = stat.label === "Perlu restok" && lowStockCount > 0;
          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {stat.label}
              </dt>
              <dd
                className={`mt-1 text-2xl font-bold tabular-nums ${
                  warn ? "text-amber-600" : "text-slate-900"
                }`}
              >
                {stat.value}
              </dd>
            </div>
          );
        })}
      </dl>

      <StockClient products={productOptions} rows={movementRows} />
    </div>
  );
}
