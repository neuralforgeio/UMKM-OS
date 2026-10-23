import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PosClient } from "./pos-client";
import type { PosProduct } from "./types";
import { getServeQueue } from "@/app/owner/verify/actions";
import { ServeQueueBar } from "@/components/serve-queue";

export const instant = false;

export default async function CashierPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Kasir must be tied to an outlet; owner may use any (first) outlet.
  const outletId = session.user.outletId;
  if (!outletId && session.user.role !== "OWNER") redirect("/");

  // Select only the identity fields the client needs — the logo BYTES
  // stay on the server; the client gets a cache-busted URL instead.
  const outletSelect = {
    id: true,
    name: true,
    address: true,
    phone: true,
    logoMimeType: true,
    logoVersion: true,
  } as const;
  const outlet = outletId
    ? await prisma.outlet.findUnique({
        where: { id: outletId },
        select: outletSelect,
      })
    : await prisma.outlet.findFirst({ select: outletSelect });
  if (!outlet) redirect("/");
  const outletInfo = {
    name: outlet.name,
    address: outlet.address,
    phone: outlet.phone,
    logoUrl: outlet.logoMimeType
      ? `/api/outlet/logo?v=${outlet.logoVersion}`
      : null,
  };

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
      // One image is enough for the card: the thumbnail wins, else the
      // first photo by manager order.
      images: {
        orderBy: [
          { isThumb: "desc" },
          { sortOrder: "asc" },
          { createdAt: "asc" },
        ],
        take: 1,
        select: { id: true },
      },
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
    thumbImageId: row.images[0]?.id ?? null,
  }));

  // Antrean Penyajian (v3): today's receipts still waiting to be
  // handed over. Rendered as a floating bar; it refreshes on every
  // checkout and polls live on its own.
  const serveRows = await getServeQueue();

  return (
    <>
      <PosClient
        cashierName={session.user.name ?? "Kasir"}
        outlet={outletInfo}
        products={products}
      />
      <ServeQueueBar rows={serveRows} />
    </>
  );
}
