"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatSku, skuPrefixOf } from "@/lib/sku";
import { audit } from "@/lib/audit";
import { formatThousands } from "@/lib/format";

// Whole-Rupiah money: the form sends plain integers, so validation only
// needs integer range checks. Decimal precision is preserved end-to-end
// because the values never pass through floating point arithmetic.
const MAX_PRICE_RUPIAH = 1_000_000_000;
const MAX_STOCK = 1_000_000;
const MAX_MIN_STOCK = 100_000;
const MAX_UNIT_LENGTH = 16;

export type SaveProductInput = {
  // Present = update an existing product, absent = create a new one.
  id?: string;
  name: string;
  // SKU is NEVER sent by the client: the server generates it on create
  // (category prefix + sequence) and never touches it on update, so a
  // tampered request cannot forge or steal another product's SKU.
  categoryId: string | null;
  // When set, a category with this name is created (or reused, ignoring
  // casing) and linked instead of categoryId.
  newCategoryName: string | null;
  // Selected EXISTING unit name from the dropdown.
  unitName: string | null;
  // When set, a unit with this name is created (or reused, ignoring
  // casing) and used instead — mirrors the category flow.
  newUnitName: string | null;
  priceRupiah: number;
  costRupiah: number;
  stock: number;
  minStock: number;
};

export type ProductActionResult =
  | { ok: true; productId?: string }
  | { ok: false; error: string };

// Thrown for user-facing validation failures, mirroring the cashier
// checkout error pattern: the outer catch turns it into a friendly
// message instead of a stack trace.
class ProductActionError extends Error {}

// Every mutation here is owner-only: the client hides the buttons for
// cashiers, but the server action is the real gate.
async function requireOwnerOutletId(): Promise<{
  outletId: string;
  userId: string;
}> {
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
  return { outletId, userId: session.user.id };
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
    const { outletId, userId } = await requireOwnerOutletId();

    const name = (input.name ?? "").trim();
    const newCategoryName = (input.newCategoryName ?? "").trim();
    const categoryId = input.categoryId || null;
    const unitName = (input.unitName ?? "").trim();
    const newUnitName = (input.newUnitName ?? "").trim();

    if (name.length < 1 || name.length > 100) {
      throw new ProductActionError(
        "Nama produk wajib diisi (maks. 100 karakter).",
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
    if (!newUnitName && !unitName) {
      throw new ProductActionError("Satuan wajib dipilih.");
    }
    if (newUnitName && unitName) {
      throw new ProductActionError(
        "Pilih satuan yang sudah ada ATAU tulis satuan baru, tidak keduanya.",
      );
    }
    if (newUnitName.length > MAX_UNIT_LENGTH) {
      throw new ProductActionError("Nama satuan maksimal 16 karakter.");
    }
    if (unitName.length > MAX_UNIT_LENGTH) {
      throw new ProductActionError("Satuan tidak valid.");
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

    // The unit must be a KNOWN name — from the Unit master table, or a
    // legacy string still used by existing products. Free text coming
    // from a tampered request is rejected before it reaches the DB.
    if (!newUnitName && unitName) {
      const allUnits = await prisma.unit.findMany({
        select: { name: true },
      });
      const unitKnown = allUnits.some(
        (unit) => unit.name.toLowerCase() === unitName.toLowerCase(),
      );
      if (!unitKnown) {
        const legacy = await prisma.product.findFirst({
          where: { unit: unitName },
          select: { id: true },
        });
        if (!legacy) {
          throw new ProductActionError(
            "Satuan tidak dikenal — pilih dari daftar atau buat satuan baru.",
          );
        }
      }
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

    // The transaction hands the saved product id back: create mode in
    // the form modal queues photos locally, then uploads them one by
    // one right after saveProduct resolves with this id.
    const savedProductId = await prisma.$transaction(async (tx) => {
      // Resolve the category first: reuse a matching name (any casing) so
      // the owner never ends up with twin categories like "Snack"/"snack".
      let resolvedCategoryId = categoryId;
      let resolvedCategoryName: string | null = null;
      if (newCategoryName) {
        const allCategories = await tx.category.findMany({
          select: { id: true, name: true },
        });
        const found = allCategories.find(
          (category) =>
            category.name.toLowerCase() === newCategoryName.toLowerCase(),
        );
        if (found) {
          resolvedCategoryId = found.id;
          resolvedCategoryName = found.name;
        } else {
          const createdCategory = await tx.category.create({
            data: { name: newCategoryName },
            select: { id: true, name: true },
          });
          resolvedCategoryId = createdCategory.id;
          resolvedCategoryName = createdCategory.name;
        }
      } else if (categoryId) {
        const category = await tx.category.findUnique({
          where: { id: categoryId },
          select: { name: true },
        });
        resolvedCategoryName = category?.name ?? null;
      }

      // Resolve the unit the same way: reuse a matching name (any
      // casing) so "Pcs" and "pcs" stay one satuan, or create it.
      let resolvedUnit: string;
      if (newUnitName) {
        const allUnits = await tx.unit.findMany({
          select: { id: true, name: true },
        });
        const found = allUnits.find(
          (unit) => unit.name.toLowerCase() === newUnitName.toLowerCase(),
        );
        resolvedUnit =
          found?.name ??
          (
            await tx.unit.create({
              data: { name: newUnitName },
              select: { name: true },
            })
          ).name;
      } else {
        resolvedUnit = unitName;
      }

      // Fields written on BOTH create and update. sku is deliberately
      // absent: on update it is immutable, on create it is generated
      // below — the client never supplies it.
      const data = {
        name,
        categoryId: resolvedCategoryId,
        price: input.priceRupiah,
        cost: input.costRupiah,
        stock: input.stock,
        minStock: input.minStock,
        unit: resolvedUnit,
        outletId,
      };

      if (input.id) {
        await tx.product.update({ where: { id: input.id }, data });
        return input.id;
      }

      // Auto SKU: prefix from the category, sequence from the highest
      // existing number with that prefix. sku is globally unique, so
      // the scan is global too; a P2002 retry loop absorbs the tiny
      // race window between two simultaneous creates.
      const prefix = skuPrefixOf(resolvedCategoryName);
      const siblings = await tx.product.findMany({
        where: { sku: { startsWith: `${prefix}-` } },
        select: { sku: true },
      });
      let maxSeq = 0;
      for (const row of siblings) {
        const seq = parseInt(row.sku.slice(prefix.length + 1), 10);
        if (Number.isInteger(seq) && seq > maxSeq) maxSeq = seq;
      }

      let sku = formatSku(prefix, maxSeq + 1);
      let created: { id: string } | null = null;
      for (let attempt = 0; attempt < 6 && !created; attempt++) {
        try {
          created = await tx.product.create({
            data: { ...data, sku },
            select: { id: true },
          });
        } catch (error) {
          if ((error as { code?: string }).code === "P2002") {
            const seq = parseInt(sku.slice(prefix.length + 1), 10) + 1;
            sku = formatSku(prefix, seq);
            continue;
          }
          throw error;
        }
      }
      if (!created) {
        throw new ProductActionError(
          "Gagal membuat SKU unik — coba simpan ulang.",
        );
      }
      return created.id;
    });

    await audit({
      actorId: userId,
      outletId,
      action: input.id ? "PRODUCT_UPDATE" : "PRODUCT_CREATE",
      entity: `product:${savedProductId}`,
      summary: input.id
        ? `Produk "${name}" diperbarui — Rp ${formatThousands(input.priceRupiah)}`
        : `Produk baru "${name}" — Rp ${formatThousands(input.priceRupiah)}`,
      meta: {
        name,
        priceRupiah: input.priceRupiah,
        costRupiah: input.costRupiah,
        stock: input.stock,
      },
    });

    // The POS grid, the restock list and this page all read products.
    revalidatePath("/owner/products");
    revalidatePath("/owner");
    revalidatePath("/cashier");
    return { ok: true, productId: savedProductId };
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
    const { outletId, userId } = await requireOwnerOutletId();

    const existing = await prisma.product.findUnique({
      where: { id: productId },
      select: { outletId: true, name: true },
    });
    if (!existing || existing.outletId !== outletId) {
      throw new ProductActionError("Produk tidak ditemukan di outlet ini.");
    }

    await prisma.product.update({
      where: { id: productId },
      data: { isActive: nextActive },
    });
    await audit({
      actorId: userId,
      outletId,
      action: nextActive ? "PRODUCT_ACTIVATE" : "PRODUCT_ARCHIVE",
      entity: `product:${productId}`,
      summary: nextActive
        ? `Produk "${existing.name}" diaktifkan kembali`
        : `Produk "${existing.name}" diarsipkan (hilang dari kasir)`,
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

// Photo limits: the editor already caps dimensions and quality, these
// guards stop anything oversized from ever reaching the database.
const MAX_IMAGES_PER_PRODUCT = 6;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ImageActionResult =
  | { ok: true; imageCount?: number }
  | { ok: false; error: string };

// Adds one edited photo. The FIRST photo of a product automatically
// becomes the thumbnail (isThumb invariant).
export async function addProductImage(
  productId: string,
  file: File,
): Promise<ImageActionResult> {
  try {
    const { outletId } = await requireOwnerOutletId();

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { outletId: true },
    });
    if (!product || product.outletId !== outletId) {
      throw new ProductActionError("Produk tidak ditemukan di outlet ini.");
    }
    if (!file || typeof file.arrayBuffer !== "function") {
      throw new ProductActionError("Berkas foto tidak valid.");
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new ProductActionError("Foto terlalu besar (maks. 3 MB).");
    }
    if (file.type && !ALLOWED_IMAGE_TYPES.has(file.type)) {
      throw new ProductActionError("Format foto harus JPG, PNG, atau WebP.");
    }

    const existingImages = await prisma.productImage.findMany({
      where: { productId },
      select: { sortOrder: true },
      orderBy: { sortOrder: "asc" },
    });
    if (existingImages.length >= MAX_IMAGES_PER_PRODUCT) {
      throw new ProductActionError(
        `Maksimal ${MAX_IMAGES_PER_PRODUCT} foto per produk.`,
      );
    }

    // Buffer (Node Uint8Array) is what Prisma's Bytes column expects.
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.byteLength === 0) {
      throw new ProductActionError("Berkas foto kosong.");
    }

    // The mimeType is normalized to the detected type; the editor always
    // exports JPEG, uploads straight from the gallery keep their type.
    const mimeType =
      file.type && ALLOWED_IMAGE_TYPES.has(file.type)
        ? file.type
        : "image/jpeg";

    await prisma.productImage.create({
      data: {
        productId,
        data: bytes,
        mimeType,
        sortOrder: existingImages.length,
        isThumb: existingImages.length === 0,
      },
    });

    revalidatePath("/owner/products");
    revalidatePath("/cashier");
    return { ok: true, imageCount: existingImages.length + 1 };
  } catch (error) {
    if (error instanceof ProductActionError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Gagal menambah foto. Coba lagi." };
  }
}

// Deletes one photo. If it was the thumbnail, the first remaining photo
// is promoted so the invariant (one thumbnail when any photo exists)
// always holds.
export async function deleteProductImage(
  imageId: string,
): Promise<ImageActionResult> {
  try {
    const { outletId } = await requireOwnerOutletId();

    const image = await prisma.productImage.findUnique({
      where: { id: imageId },
      select: { productId: true, isThumb: true },
    });
    if (!image) {
      throw new ProductActionError("Foto tidak ditemukan.");
    }
    const product = await prisma.product.findUnique({
      where: { id: image.productId },
      select: { outletId: true },
    });
    if (!product || product.outletId !== outletId) {
      throw new ProductActionError("Produk tidak ditemukan di outlet ini.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.productImage.delete({ where: { id: imageId } });
      if (image.isThumb) {
        const next = await tx.productImage.findFirst({
          where: { productId: image.productId },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true },
        });
        if (next) {
          await tx.productImage.update({
            where: { id: next.id },
            data: { isThumb: true },
          });
        }
      }
    });

    revalidatePath("/owner/products");
    revalidatePath("/cashier");
    return { ok: true };
  } catch (error) {
    if (error instanceof ProductActionError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Gagal menghapus foto." };
  }
}

// Promotes one photo to be the product thumbnail.
export async function setProductThumbnail(
  imageId: string,
): Promise<ImageActionResult> {
  try {
    const { outletId } = await requireOwnerOutletId();

    const image = await prisma.productImage.findUnique({
      where: { id: imageId },
      select: { productId: true },
    });
    if (!image) {
      throw new ProductActionError("Foto tidak ditemukan.");
    }
    const product = await prisma.product.findUnique({
      where: { id: image.productId },
      select: { outletId: true },
    });
    if (!product || product.outletId !== outletId) {
      throw new ProductActionError("Produk tidak ditemukan di outlet ini.");
    }

    await prisma.$transaction([
      prisma.productImage.updateMany({
        where: { productId: image.productId },
        data: { isThumb: false },
      }),
      prisma.productImage.update({
        where: { id: imageId },
        data: { isThumb: true },
      }),
    ]);

    revalidatePath("/owner/products");
    revalidatePath("/cashier");
    return { ok: true };
  } catch (error) {
    if (error instanceof ProductActionError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Gagal mengubah thumbnail." };
  }
}

// Moves one photo one slot left/right, then renumbers the whole list so
// sortOrder stays gapless (0..n-1) regardless of deletion history.
export async function moveProductImage(
  imageId: string,
  direction: "left" | "right",
): Promise<ImageActionResult> {
  try {
    const { outletId } = await requireOwnerOutletId();

    const image = await prisma.productImage.findUnique({
      where: { id: imageId },
      select: { productId: true },
    });
    if (!image) {
      throw new ProductActionError("Foto tidak ditemukan.");
    }
    const product = await prisma.product.findUnique({
      where: { id: image.productId },
      select: { outletId: true },
    });
    if (!product || product.outletId !== outletId) {
      throw new ProductActionError("Produk tidak ditemukan di outlet ini.");
    }

    const list = await prisma.productImage.findMany({
      where: { productId: image.productId },
      select: { id: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const index = list.findIndex((item) => item.id === imageId);
    const target = direction === "left" ? index - 1 : index + 1;
    if (index === -1 || target < 0 || target >= list.length) {
      return { ok: true }; // Already at the edge — nothing to do.
    }
    [list[index], list[target]] = [list[target], list[index]];

    await prisma.$transaction(
      list.map((item, i) =>
        prisma.productImage.update({
          where: { id: item.id },
          data: { sortOrder: i },
        }),
      ),
    );

    revalidatePath("/owner/products");
    return { ok: true };
  } catch (error) {
    if (error instanceof ProductActionError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Gagal mengubah urutan foto." };
  }
}
