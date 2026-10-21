import { prisma } from "@/lib/prisma";
import {
  StockClient,
  type StockMovementRow,
  type StockProductOption,
} from "./stock-client";

// Stock numbers must always be fresh, so never cache this page.
export const dynamic = "force-dynamic";

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
  const [products, movements, productAgg, movementCount] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, name: true, sku: true, stock: true },
      orderBy: { name: "asc" },
    }),
    prisma.stockMovement.findMany({
      take: 200,
      orderBy: { createdAt: "desc" },
      include: { product: { select: { name: true, sku: true } } },
    }),
    prisma.product.aggregate({ _count: true, _sum: { stock: true } }),
    prisma.stockMovement.count(),
  ]);

  const productOptions: StockProductOption[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku ?? "",
    stock: product.stock ?? 0,
  }));

  // Rows are plain serializable objects. Display strings are prepared on the
  // server so the client render stays hydration-safe.
  const movementRows: StockMovementRow[] = movements.map((movement) => ({
    id: movement.id,
    productName: movement.product.name,
    sku: movement.product.sku ?? "",
    type: movement.type,
    quantity: movement.quantity,
    unitCost: movement.unitCost,
    note: movement.note,
    createdAt: movement.createdAt.toISOString(),
    timeLabel: timeFmt.format(movement.createdAt),
  }));

  const stats = [
    { label: "Jenis produk", value: productAgg._count.toLocaleString("id-ID") },
    {
      label: "Total unit stok",
      value: (productAgg._sum.stock ?? 0).toLocaleString("id-ID"),
    },
    { label: "Gerakan tercatat", value: movementCount.toLocaleString("id-ID") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Kartu Stok
        </h1>
        <p className="text-sm text-slate-500">
          Catat stok masuk, keluar, dan hasil opname. Riwayat terbaru tampil
          paling atas.
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {stat.label}
            </dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      <StockClient products={productOptions} rows={movementRows} />
    </div>
  );
}
