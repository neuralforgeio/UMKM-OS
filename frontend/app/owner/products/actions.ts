"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Whole-Rupiah money: the form sends plain integers, so validation only
// needs integer range checks. Decimal precision is preserved end-to-end
// because the values never pass through floating point arithmetic.
const MAX_PRICE_RUPIAH = 1_000_000_000;
const MAX_STOCK = 1_000_000;
const MAX_MIN_STOCK = 100_000;
const SKU_PATTERN = /^[A-Z0-9-]{2,32}$/;

export type SaveProductInput = {
  // Present = update an existing product, absent = create a new one.
  id?: string;
  name: string;
  sku: string;
  categoryId: string | null;
  // When set, a category with this name is created (or reused, ignoring
  // casing) and linked instead of categoryId.
  newCategoryName: string | null;
  priceRupiah: number;
  costRupiah: number;
  unit: string;
  stock: number;
  minStock: number;
};

export type ProductActionResult = { ok: true } | { ok: false; error: string };

// Thrown for user-facing validation failures, mirroring the cashier
// checkout error pattern: the outer catch turns it into a friendly
// message instead of a stack trace.
class ProductActionError extends Error {}

// Every mutation here is owner-only: the client hides the buttons for
// cashiers, but the server action is the real gate.
async function requireOwnerOutletId(): Promise<string> {
  const session = await auth();
  if (!session?.user) {
    throw new ProductActionError("Sesi sudah berakhir. Silakan login ulang.");
  }
  if (session.user.role !== "OWNER") {
    throw new ProductActionError("Hanya pemilik yang boleh mengubah produk.");
  }
  // Owners may not be tied to an outlet; fall back to the first one,
  // mirroring the cashier and dashboard resolution.
  let outletId = session.user.outletId;
  if (!outletId) {
    const firstOutlet = await prisma.outlet.findFirst({
      select: { id: true },
    });
    if (!firstOutlet) {
      throw new ProductActionError("Belum ada outlet terdaftar.");
    }
    outletId = firstOutlet.id;
  }
  return outletId;
}

const isIntInRange = (value: unknown, min: number, max: number) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max;

export async function saveProduct(
  input: SaveProductInput,
): Promise<ProductActionResult> {
  try {
    const outletId = await requireOwnerOutletId();

    const name = (input.name ?? "").trim();
    const sku = (input.sku ?? "").trim().toUpperCase();
    const unit = (input.unit ?? "").trim() || "pcs";
    const newCategoryName = (input.newCategoryName ?? "").trim();
    const categoryId = input.categoryId || null;

    if (name.length < 1 || name.length > 100) {
      throw new ProductActionError(
        "Nama produk wajib diisi (maks. 100 karakter).",
      );
    }
    if (!SKU_PATTERN.test(sku)) {
      throw new ProductActionError(
        "SKU wajib 2-32 karakter: huruf besar, angka, atau tanda hubung.",
      );
    }
    if (!isIntInRange(input.priceRupiah, 1, MAX_PRICE_RUPIAH)) {
      throw new ProductActionError(
        "Harga jual harus angka bulat lebih dari 0.",
      );
    }
    if (!isIntInRange(input.costRupiah, 0, MAX_PRICE_RUPIAH)) {
      throw new ProductActionError("Harga beli tidak valid.");
    }
    if (!isIntInRange(input.stock, 0, MAX_STOCK)) {
      throw new ProductActionError("Stok tidak valid.");
    }
    if (!isIntInRange(input.minStock, 0, MAX_MIN_STOCK)) {
      throw new ProductActionError("Batas stok minimum tidak valid.");
    }
    if (newCategoryName.length > 50) {
      throw new ProductActionError("Nama kategori maksimal 50 karakter.");
    }
    if (newCategoryName && categoryId) {
      throw new ProductActionError(
        "Pilih kategori yang sudah ada ATAU tulis nama kategori baru, tidak keduanya.",
      );
    }
    if (!newCategoryName && categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
        select: { id: true },
      });
      if (!category) {
        throw new ProductActionError("Kategori tidak ditemukan.");
      }
    }

    // SKU is globally unique: on update, exclude the product itself.
    const skuClash = await prisma.product.findFirst({
      where: { sku, ...(input.id ? { NOT: { id: input.id } } : {}) },
      select: { id: true },
    });
    if (skuClash) {
      throw new ProductActionError(`SKU ${sku} sudah dipakai produk lain.`);
    }

    if (input.id) {
      const existing = await prisma.product.findUnique({
        where: { id: input.id },
        select: { outletId: true },
      });
      if (!existing || existing.outletId !== outletId) {
        throw new ProductActionError("Produk tidak ditemukan di outlet ini.");
      }
    }

    await prisma.$transaction(async (tx) => {
      // Resolve the category first: reuse a matching name (any casing) so
      // the owner never ends up with twin categories like "Snack"/"snack".
      let resolvedCategoryId = categoryId;
      if (newCategoryName) {
        const allCategories = await tx.category.findMany({
          select: { id: true, name: true },
        });
        const found = allCategories.find(
          (category) =>
            category.name.toLowerCase() === newCategoryName.toLowerCase(),
        );
        resolvedCategoryId =
          found?.id ??
          (
            await tx.category.create({
              data: { name: newCategoryName },
              select: { id: true },
            })
          ).id;
      }

      const data = {
        name,
        sku,
        categoryId: resolvedCategoryId,
        price: input.priceRupiah,
        cost: input.costRupiah,
        stock: input.stock,
        minStock: input.minStock,
        unit,
        outletId,
      };

      if (input.id) {
        await tx.product.update({ where: { id: input.id }, data });
      } else {
        await tx.product.create({ data });
      }
    });

    // The POS grid, the restock list and this page all read products.
    revalidatePath("/owner/products");
    revalidatePath("/owner");
    revalidatePath("/cashier");
    return { ok: true };
  } catch (error) {
    if (error instanceof ProductActionError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Gagal menyimpan produk. Coba lagi." };
  }
}

// Soft archive: historical TransactionItems keep pointing at the product,
// and the cashier checkout already ignores inactive products, so nothing
// is ever hard-deleted.
export async function toggleProductActive(
  productId: string,
  nextActive: boolean,
): Promise<ProductActionResult> {
  try {
    const outletId = await requireOwnerOutletId();

    const existing = await prisma.product.findUnique({
      where: { id: productId },
      select: { outletId: true },
    });
    if (!existing || existing.outletId !== outletId) {
      throw new ProductActionError("Produk tidak ditemukan di outlet ini.");
    }

    await prisma.product.update({
      where: { id: productId },
      data: { isActive: nextActive },
    });

    revalidatePath("/owner/products");
    revalidatePath("/owner");
    revalidatePath("/cashier");
    return { ok: true };
  } catch (error) {
    if (error instanceof ProductActionError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Gagal mengubah status produk." };
  }
}
