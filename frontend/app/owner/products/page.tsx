import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProductsClient } from "./products-client";
import type { CategoryOption, ProductRow, UnitOption } from "./types";

export const instant = false;

export default async function OwnerProductsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "OWNER" && session.user.role !== "DEVELOPER") redirect("/cashier");

  // Owners may not be tied to an outlet; fall back to the first one,
  // mirroring the cashier and dashboard resolution.
  const outletId =
    session.user.outletId ??
    (await prisma.outlet.findFirst({ select: { id: true } }))?.id;
  if (!outletId) redirect("/owner");

  const since30Days = new Date();
  since30Days.setDate(since30Days.getDate() - 30);

  const [outlet, products, categories, units, soldRows] = await Promise.all([
    prisma.outlet.findUnique({
      where: { id: outletId },
      select: { name: true },
    }),
    prisma.product.findMany({
      where: { outletId },
      // Active products first, then alphabetical, matching the POS feel.
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        cost: true,
        stock: true,
        minStock: true,
        unit: true,
        isActive: true,
        categoryId: true,
        category: { select: { id: true, name: true } },
        // Photos in manager order (sortOrder, then upload time).
        images: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true, isThumb: true },
        },
      },
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.unit.findMany({
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    // Demand signal for the owner: how many units moved in the last 30
    // days. Only COMPLETED transactions count.
    prisma.transactionItem.groupBy({
      by: ["productId"],
      where: {
        transaction: {
          outletId,
          status: "COMPLETED",
          createdAt: { gte: since30Days },
        },
      },
      _sum: { quantity: true },
    }),
  ]);

  const soldByProduct = new Map(
    soldRows.map((row) => [row.productId, row._sum.quantity ?? 0]),
  );

  // Decimals become plain numbers at the boundary. Warung prices are
  // whole Rupiah, so rounding is a no-op safety net.
  const rows: ProductRow[] = products.map((product) => {
    const thumb = product.images.find((image) => image.isThumb);
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      categoryId: product.category?.id ?? null,
      categoryName: product.category?.name ?? null,
      priceRupiah: Math.round(Number(product.price)),
      costRupiah: Math.round(Number(product.cost)),
      stock: product.stock,
      minStock: product.minStock,
      unit: product.unit,
      isActive: product.isActive,
      soldLast30Days: soldByProduct.get(product.id) ?? 0,
      images: product.images.map((image) => ({
        id: image.id,
        isThumb: image.isThumb,
      })),
      // Chosen thumbnail, else the first photo by manager order.
      thumbImageId: (thumb ?? product.images[0])?.id ?? null,
    };
  });

  const categoryOptions: CategoryOption[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
  }));

  // Unit dropdown options: the master table PLUS distinct legacy unit
  // strings still used by existing products (case-insensitive dedupe),
  // so rows created before the Unit table existed still resolve.
  const unitByName = new Map<string, string>();
  for (const unit of units) {
    if (!unitByName.has(unit.name.toLowerCase())) {
      unitByName.set(unit.name.toLowerCase(), unit.name);
    }
  }
  for (const product of products) {
    const trimmed = (product.unit ?? "").trim();
    if (trimmed && !unitByName.has(trimmed.toLowerCase())) {
      unitByName.set(trimmed.toLowerCase(), trimmed);
    }
  }
  const unitOptions: UnitOption[] = [...unitByName.values()]
    .sort((a, b) => a.localeCompare(b, "id"))
    .map((name) => ({ name }));

  // Per-category product counts power the form's live "next SKU"
  // preview ("__none__" = products without a category -> BRG-xxxx).
  // The server still computes the authoritative SKU on save.
  const skuCounts: Record<string, number> = {};
  for (const product of products) {
    const key = product.categoryId ?? "__none__";
    skuCounts[key] = (skuCounts[key] ?? 0) + 1;
  }

  return (
    <ProductsClient
      outletName={outlet?.name ?? "Outlet"}
      products={rows}
      categories={categoryOptions}
      units={unitOptions}
      skuCounts={skuCounts}
    />
  );
}
