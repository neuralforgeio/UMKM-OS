"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type StockActionState = {
  error?: string;
  success?: string;
};

// Only owner-driven movement types are writable here. SALE rows belong
// to the cashier checkout, which will write them atomically with the
// receipt, so the ledger stays consistent with actual sales.
const MOVEMENT_TYPES = ["IN", "ADJUST"] as const;
type MovementType = (typeof MOVEMENT_TYPES)[number];

// Refresh every view that reads stock data.
function revalidateStockViews() {
  revalidatePath("/owner/stock");
  revalidatePath("/owner");
  revalidatePath("/owner/products");
  revalidatePath("/cashier");
}

export async function createStockMovementAction(
  _prevState: StockActionState,
  formData: FormData,
): Promise<StockActionState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") {
    return { error: "Sesi tidak valid. Aksi ini hanya untuk pemilik." };
  }

  const productId = String(formData.get("productId") ?? "").trim();
  const rawType = String(formData.get("type") ?? "").trim().toUpperCase();
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
  if (!Number.isInteger(quantity) || quantity < 0) {
    return { error: "Jumlah harus berupa angka bulat 0 atau lebih." };
  }
  if (type === "IN" && quantity === 0) {
    return { error: "Jumlah masuk harus lebih besar dari nol." };
  }

  const unitCost = unitCostRaw ? Number(unitCostRaw) : 0;
  if (!Number.isFinite(unitCost) || unitCost < 0) {
    return { error: "Biaya satuan tidak valid." };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, stock: true },
      });
      if (!product) throw new Error("PRODUCT_NOT_FOUND");

      const currentStock = product.stock;
      let delta: number;
      let storedQuantity: number;
      let storedNote: string | null;
      let storedUnitCost: number | null;

      if (type === "IN") {
        // Restock: the input is what arrived, the cost is a per-unit
        // snapshot for later profit reports.
        delta = quantity;
        storedQuantity = quantity;
        storedNote = note || null;
        storedUnitCost = unitCost > 0 ? unitCost : null;
      } else {
        // Opname: the input is the physical count. The blueprint stores
        // magnitude-only quantities, so the signed delta goes into the
        // note to keep the ledger explainable.
        delta = quantity - currentStock;
        if (delta === 0) throw new Error("NO_DIFFERENCE");
        storedQuantity = Math.abs(delta);
        const userNote = note ? ` — ${note}` : "";
        storedNote = `opname: sistem ${currentStock} → fisik ${quantity}${userNote}`;
        storedUnitCost = null;
      }

      await tx.stockMovement.create({
        data: {
          productId,
          type,
          quantity: storedQuantity,
          unitCost: storedUnitCost,
          note: storedNote,
          userId: session.user.id,
        },
      });

      const updated = await tx.product.update({
        where: { id: productId },
        data: { stock: currentStock + delta },
        select: { stock: true },
      });

      return { name: product.name, stock: updated.stock, delta };
    });

    revalidateStockViews();

    if (type === "IN") {
      return {
        success: `Restok ${result.name} tercatat (+${quantity}). Stok sekarang: ${result.stock}.`,
      };
    }
    const sign = result.delta > 0 ? "+" : "";
    return {
      success: `Opname ${result.name}: selisih ${sign}${result.delta} dicatat. Stok sekarang: ${result.stock}.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "PRODUCT_NOT_FOUND") {
      return { error: "Produk tidak ditemukan." };
    }
    if (message === "NO_DIFFERENCE") {
      return {
        error: "Hasil opname sama dengan stok sistem, tidak ada selisih.",
      };
    }
    return { error: "Gagal menyimpan gerakan stok. Coba lagi." };
  }
}
