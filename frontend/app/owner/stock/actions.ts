"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";

export type StockActionState = {
  error?: string;
  success?: string;
};

// Only owner-driven movement types are writable here. SALE rows belong
// to the cashier checkout, which writes them atomically with the
// receipt (backend-go mengikat transaction_id), so the ledger stays
// consistent with actual sales.
const MOVEMENT_TYPES = ["IN", "ADJUST"] as const;
type MovementType = (typeof MOVEMENT_TYPES)[number];

type GoProduct = {
  id: number;
  name: string;
  stock: number;
};

type GoStockResult = {
  stock_before: number;
  stock_after: number;
};

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
  if (
    !session?.user ||
    (session.user.role !== "OWNER" && session.user.role !== "DEVELOPER")
  ) {
    return { error: "Sesi tidak valid. Aksi ini hanya untuk pemilik." };
  }
  if (!session.user.goToken) {
    return {
      error: "Sesi tidak memiliki token backend — silakan login ulang.",
    };
  }
  const token = session.user.goToken;

  const productId = String(formData.get("productId") ?? "").trim();
  const rawType = String(formData.get("type") ?? "")
    .trim()
    .toUpperCase();
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const unitCostRaw = String(formData.get("unitCost") ?? "").replace(/\D/g, "");
  const note = String(formData.get("note") ?? "").trim();

  if (!productId) return { error: "Produk wajib dipilih." };
  if (!/^\d+$/.test(productId)) return { error: "Produk tidak ditemukan." };
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

  // Data produk segar dari backend-go: validasi keberadaan produk, stok
  // sekarang (cek selisih opname + susun catatan opname).
  const productsRes = await goFetch<GoProduct[]>(token, "/products");
  if (!productsRes.ok) return { error: productsRes.message };
  const product = productsRes.data.find((p) => String(p.id) === productId);
  if (!product) return { error: "Produk tidak ditemukan." };

  if (type === "ADJUST" && quantity === product.stock) {
    return {
      error: "Hasil opname sama dengan stok sistem, tidak ada selisih.",
    };
  }

  // IN = restok (jumlah yang datang, biaya satuan sebagai snapshot);
  // ADJUST = opname (jumlah = hasil hitungan fisik; selisihnya
  // dituangkan ke catatan supaya buku kas tetap bisa dibaca manusia).
  const payload =
    type === "IN"
      ? {
          type: "IN",
          qty: quantity,
          note,
          ...(unitCost > 0 ? { unit_cost: unitCost } : {}),
        }
      : {
          type: "ADJUST",
          qty: quantity,
          note: `opname: sistem ${product.stock} → fisik ${quantity}${note ? ` — ${note}` : ""}`,
        };

  const res = await goFetch<GoStockResult>(
    token,
    `/products/${productId}/stock`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  if (!res.ok) return { error: res.message };

  revalidateStockViews();

  if (type === "IN") {
    return {
      success: `Restok ${product.name} tercatat (+${quantity}). Stok sekarang: ${res.data.stock_after}.`,
    };
  }
  const delta = res.data.stock_after - res.data.stock_before;
  const sign = delta > 0 ? "+" : "";
  return {
    success: `Opname ${product.name}: selisih ${sign}${delta} dicatat. Stok sekarang: ${res.data.stock_after}.`,
  };
}
