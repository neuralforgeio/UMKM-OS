"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type StockActionState = {
  error?: string;
  success?: string;
};

const MOVEMENT_TYPES = ["IN", "OUT", "ADJUST"] as const;
type MovementType = (typeof MOVEMENT_TYPES)[number];

// Refresh every view that reads stock data.
function revalidateStockViews() {
  revalidatePath("/owner/stock");
  revalidatePath("/owner/products");
  revalidatePath("/cashier");
}

export async function createStockMovementAction(
  _prevState: StockActionState,
  formData: FormData,
): Promise<StockActionState> {
  const productId = String(formData.get("productId") ?? "").trim();
  const rawType = String(formData.get("type") ?? "")
    .trim()
    .toUpperCase();
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const unitCostRaw = String(formData.get("unitCost") ?? "").replace(/\D/g, "");
  const note = String(formData.get("note") ?? "").trim();

  if (!productId) return { error: "Produk wajib dipilih." };
  if (!MOVEMENT_TYPES.includes(rawType as MovementType)) {
    return { error: "Tipe gerakan tidak valid." };
  }
  const type = rawType as MovementType;

  if (quantityRaw === "") return { error: "Jumlah wajib diisi." };
  const quantity = Number(quantityRaw);
  if (!Number.isInteger(quantity)) {
    return { error: "Jumlah harus berupa angka bulat." };
  }

  const unitCost = unitCostRaw ? Number(unitCostRaw) : 0;
  if (!Number.isFinite(unitCost) || unitCost < 0) {
    return { error: "Biaya satuan tidak valid." };
  }

  if (type !== "ADJUST" && quantity <= 0) {
    return { error: "Jumlah harus lebih besar dari nol." };
  }
  if (type === "ADJUST" && quantity < 0) {
    return { error: "Stok hasil hitung tidak boleh negatif." };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, stock: true },
      });
      if (!product) throw new Error("PRODUCT_NOT_FOUND");

      const currentStock = product.stock ?? 0;

      // Movement stores the signed delta so the ledger reads naturally.
      let delta: number;
      if (type === "IN") {
        delta = quantity;
      } else if (type === "OUT") {
        if (quantity > currentStock) throw new Error("STOCK_INSUFFICIENT");
        delta = -quantity;
      } else {
        delta = quantity - currentStock;
        if (delta === 0) throw new Error("NO_DIFFERENCE");
      }

      await tx.stockMovement.create({
        data: {
          productId,
          type,
          quantity: delta,
          unitCost,
          note: note || null,
        },
      });

      const updated = await tx.product.update({
        where: { id: productId },
        data: { stock: currentStock + delta },
        select: { stock: true },
      });

      return { name: product.name, stock: updated.stock ?? 0, delta };
    });

    revalidateStockViews();

    const label =
      type === "IN"
        ? "Stok masuk"
        : type === "OUT"
          ? "Stok keluar"
          : "Penyesuaian";
    const sign = result.delta > 0 ? "+" : "";
    return {
      success: `${label} ${result.name} tercatat (${sign}${result.delta}). Stok sekarang: ${result.stock}.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "PRODUCT_NOT_FOUND") {
      return { error: "Produk tidak ditemukan." };
    }
    if (message === "STOCK_INSUFFICIENT") {
      return { error: "Jumlah keluar melebihi stok yang ada." };
    }
    if (message === "NO_DIFFERENCE") {
      return {
        error: "Hasil opname sama dengan stok sistem, tidak ada selisih.",
      };
    }
    return { error: "Gagal menyimpan gerakan stok. Coba lagi." };
  }
}
