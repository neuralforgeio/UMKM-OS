"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { formatSku, skuPrefixOf } from "@/lib/sku";

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

// Bentuk data dari backend-go.
type GoProduct = {
  id: number;
  name: string;
  sku: string | null;
  category: string;
  unit: string;
};

// Every mutation here is owner-only: the client hides the buttons for
// cashiers, but backend-go re-validates the role (OWNER/DEVELOPER) on
// every endpoint — the server is the real gate.
async function requireStaffToken(): Promise<string> {
  const session = await auth();
  if (!session?.user) {
    throw new ProductActionError("Sesi sudah berakhir. Silakan login ulang.");
  }
  if (session.user.role !== "OWNER" && session.user.role !== "DEVELOPER") {
    throw new ProductActionError("Hanya pemilik yang boleh mengubah produk.");
  }
  if (!session.user.goToken) {
    throw new ProductActionError(
      "Sesi tidak memiliki token backend — silakan login ulang.",
    );
  }
  return session.user.goToken;
}

async function fetchAllProducts(token: string): Promise<GoProduct[]> {
  const result = await goFetch<GoProduct[]>(token, "/products?all=true");
  if (!result.ok) throw new ProductActionError(result.message);
  return result.data;
}

const isIntInRange = (value: unknown, min: number, max: number) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max;

const isNumericId = (value: string) => /^\d+$/.test(value);

export async function saveProduct(
  input: SaveProductInput,
): Promise<ProductActionResult> {
  try {
    const token = await requireStaffToken();

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

    // Data segar dari backend-go: verifikasi produk (mode update),
    // resolusi kategori case-insensitive, dan dasar generasi SKU.
    const all = await fetchAllProducts(token);

    // Resolve the category: reuse a matching name (any casing) so the
    // owner never ends up with twin categories like "Snack"/"snack".
    let resolvedCategory: string;
    if (newCategoryName) {
      const found = all.find(
        (product) =>
          (product.category ?? "").toLowerCase() ===
          newCategoryName.toLowerCase(),
      );
      resolvedCategory = found?.category ?? newCategoryName;
    } else if (categoryId) {
      const known = all.some((product) => product.category === categoryId);
      if (!known) {
        throw new ProductActionError("Kategori tidak ditemukan.");
      }
      resolvedCategory = categoryId;
    } else {
      resolvedCategory = "Umum";
    }

    // Era backend-go: satuan adalah teks pada produk — nama baru langsung
    // dipakai (Go memvalidasi panjangnya), tidak ada tabel master.
    const resolvedUnit = newUnitName || unitName;

    // The saved product id goes back to the form modal: create mode
    // queues photos locally, then uploads them one by one right after
    // saveProduct resolves with this id.
    if (input.id) {
      if (!isNumericId(input.id)) {
        throw new ProductActionError("Produk tidak ditemukan.");
      }
      const existing = all.find((product) => String(product.id) === input.id);
      if (!existing) {
        throw new ProductActionError("Produk tidak ditemukan.");
      }

      const result = await goFetch<GoProduct>(token, `/products/${input.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name,
          category: resolvedCategory,
          price: input.priceRupiah,
          cost: input.costRupiah,
          stock: input.stock,
          min_stock: input.minStock,
          unit: resolvedUnit,
        }),
      });
      if (!result.ok) return { ok: false, error: result.message };

      revalidatePath("/owner/products");
      revalidatePath("/owner");
      revalidatePath("/cashier");
      return { ok: true, productId: String(result.data.id) };
    }

    // Auto SKU: prefix from the category, sequence from the highest
    // existing number with that prefix. sku is globally unique, so the
    // scan is global too; a 409 retry loop absorbs the tiny race window
    // between two simultaneous creates (backend-go detects the clash).
    const prefix = skuPrefixOf(resolvedCategory);
    let maxSeq = 0;
    for (const product of all) {
      if ((product.sku ?? "").startsWith(`${prefix}-`)) {
        const seq = parseInt((product.sku ?? "").slice(prefix.length + 1), 10);
        if (Number.isInteger(seq) && seq > maxSeq) maxSeq = seq;
      }
    }

    let created: GoProduct | null = null;
    for (let attempt = 0; attempt < 6 && !created; attempt++) {
      const sku = formatSku(prefix, maxSeq + 1 + attempt);
      const result = await goFetch<GoProduct>(token, "/products", {
        method: "POST",
        body: JSON.stringify({
          name,
          sku,
          category: resolvedCategory,
          price: input.priceRupiah,
          cost: input.costRupiah,
          stock: input.stock,
          min_stock: input.minStock,
          unit: resolvedUnit,
        }),
      });
      if (result.ok) {
        created = result.data;
        break;
      }
      if (result.status === 409) continue; // SKU bentrok — nomor berikutnya
      return { ok: false, error: result.message };
    }
    if (!created) {
      throw new ProductActionError(
        "Gagal membuat SKU unik — coba simpan ulang.",
      );
    }

    revalidatePath("/owner/products");
    revalidatePath("/owner");
    revalidatePath("/cashier");
    return { ok: true, productId: String(created.id) };
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
    const token = await requireStaffToken();
    if (!isNumericId(productId)) {
      throw new ProductActionError("Produk tidak ditemukan.");
    }

    const result = nextActive
      ? await goFetch(token, `/products/${productId}/active`, {
          method: "PUT",
          body: JSON.stringify({ active: true }),
        })
      : await goFetch(token, `/products/${productId}`, { method: "DELETE" });
    if (!result.ok) return { ok: false, error: result.message };

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
// guards stop anything oversized from ever reaching the database
// (backend-go memvalidasi ulang semuanya di sisi sana).
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
    const token = await requireStaffToken();
    if (!isNumericId(productId)) {
      throw new ProductActionError("Produk tidak ditemukan.");
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

    // FormData diteruskan apa adanya ke backend-go (multipart).
    const fd = new FormData();
    fd.append("file", file);
    const result = await goFetch<{ image_count?: number }>(
      token,
      `/products/${productId}/images`,
      { method: "POST", body: fd },
    );
    if (!result.ok) return { ok: false, error: result.message };

    revalidatePath("/owner/products");
    revalidatePath("/cashier");
    return { ok: true, imageCount: result.data.image_count };
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
    const token = await requireStaffToken();
    if (!isNumericId(imageId)) {
      throw new ProductActionError("Foto tidak ditemukan.");
    }

    const result = await goFetch(token, `/images/${imageId}`, {
      method: "DELETE",
    });
    if (!result.ok) return { ok: false, error: result.message };

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
    const token = await requireStaffToken();
    if (!isNumericId(imageId)) {
      throw new ProductActionError("Foto tidak ditemukan.");
    }

    const result = await goFetch(token, `/images/${imageId}/thumb`, {
      method: "PUT",
    });
    if (!result.ok) return { ok: false, error: result.message };

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
    const token = await requireStaffToken();
    if (!isNumericId(imageId)) {
      throw new ProductActionError("Foto tidak ditemukan.");
    }

    const result = await goFetch(token, `/images/${imageId}/move`, {
      method: "PUT",
      body: JSON.stringify({ direction }),
    });
    if (!result.ok) return { ok: false, error: result.message };

    revalidatePath("/owner/products");
    return { ok: true };
  } catch (error) {
    if (error instanceof ProductActionError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Gagal mengubah urutan foto." };
  }
}
