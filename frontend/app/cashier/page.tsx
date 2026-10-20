import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PosClient } from "./pos-client";
import type { PosProduct } from "./types";

export const instant = false;

export default async function CashierPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Kasir must be tied to an outlet; owner may use any (first) outlet.
  const outletId = session.user.outletId;
  if (!outletId && session.user.role !== "OWNER") redirect("/");

  const outlet = outletId
    ? await prisma.outlet.findUnique({ where: { id: outletId } })
    : await prisma.outlet.findFirst();
  if (!outlet) redirect("/");

  const rows = await prisma.product.findMany({
    where: { outletId: outlet.id, isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      stock: true,
      unit: true,
      minStock: true,
      category: { select: { name: true } },
    },
  });

  // Decimal values are serialized as strings before crossing the
  // server/client boundary.
  const products: PosProduct[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    sku: row.sku,
    price: row.price.toString(),
    stock: row.stock,
    unit: row.unit,
    minStock: row.minStock,
    categoryName: row.category?.name ?? null,
  }));

  return (
    <PosClient
      cashierName={session.user.name}
      outletName={outlet.name}
      products={products}
    />
  );
}
