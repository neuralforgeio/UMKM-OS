"use server";

// Aksi riwayat transaksi owner — sepenuhnya ke backend-go (v2.1.0):
//   GET  /api/v1/transactions/{id}        -> detail struk + item + jejak
//   POST /api/v1/transactions/{id}/refund -> refund atomik
//
// Outlet scope ditegakkan Go di SQL (t.outlet_id = outlet konteks) —
// satu outlet tidak pernah bisa mengintip struk outlet lain. Refund
// (status -> REFUNDED + kembalikan stok + kartu stok + audit) dikerjakan
// Go dalam SATU transaksi database; tulisan auditnya pun ditulis Go —
// helper audit() frontend era Prisma sudah pensiun total.
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import type { DetailResult, TransactionDetail } from "./types";

export type HistoryActionResult = { ok: true } | { ok: false; error: string };

// Thrown for user-facing validation failures, mirroring the products
// action error pattern: the outer catch turns it into a friendly
// message instead of a stack trace.
class HistoryActionError extends Error {}

// Every action here is owner-only: the client hides the buttons for
// cashiers, but the server action is the real gate.
async function requireManager(): Promise<{ token: string }> {
  const session = await auth();
  if (!session?.user) {
    throw new HistoryActionError("Sesi sudah berakhir. Silakan login ulang.");
  }
  if (session.user.role !== "OWNER" && session.user.role !== "DEVELOPER") {
    throw new HistoryActionError(
      "Hanya pemilik yang boleh mengakses riwayat transaksi.",
    );
  }
  if (!session.user.goToken) {
    throw new HistoryActionError("Sesi tanpa token backend — login ulang.");
  }
  return { token: session.user.goToken };
}

// Bentuk respons GET /transactions/{id} (backend-go): ringkasan + item.
type GoTransactionDetail = {
  id: number;
  receipt_no: string;
  created_at: string;
  payment_method: string;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  paid_amount: number;
  change_amount: number;
  cashier_name: string;
  claim_code: string | null;
  handover_status: string | null;
};

type GoTransactionItem = {
  product_name: string;
  unit: string;
  qty: number;
  price: number;
  subtotal: number;
};

function requireTxId(
  transactionId: string,
): { error: string } | { id: string } {
  if (typeof transactionId !== "string" || !/^\d+$/.test(transactionId)) {
    return { error: "ID transaksi tidak valid." };
  }
  return { id: transactionId };
}

// Loads one receipt (with its line items) for the owner detail panel.
// Scoped by Go to the caller's outlet so one outlet can never peek into
// another outlet's receipts.
export async function getTransactionDetail(
  transactionId: string,
): Promise<DetailResult> {
  try {
    const { token } = await requireManager();
    const tx = requireTxId(transactionId);
    if ("error" in tx) return { ok: false, error: tx.error };

    const res = await goFetch<{
      transaction: GoTransactionDetail;
      items: GoTransactionItem[];
      events: unknown[];
    }>(token, `/transactions/${tx.id}`);
    if (!res.ok) {
      // Pesan Go sudah ramah-pemilik ("Transaksi tidak ditemukan" dsb).
      return { ok: false, error: res.message };
    }
    const t = res.data?.transaction;
    if (!t || !Array.isArray(res.data.items)) {
      return { ok: false, error: "Transaksi tidak ditemukan." };
    }

    const detail: TransactionDetail = {
      id: String(t.id),
      code: t.receipt_no,
      createdAtIso: t.created_at,
      paymentMethod: t.payment_method,
      status: t.status,
      subtotalRupiah: Math.round(t.subtotal),
      discountRupiah: Math.round(t.discount),
      totalRupiah: Math.round(t.total),
      paidRupiah: Math.round(t.paid_amount),
      changeRupiah: Math.round(t.change_amount),
      cashierName: t.cashier_name ?? "-",
      claimCode: t.claim_code,
      handoverStatus: t.handover_status,
      items: res.data.items.map((item) => ({
        productName: item.product_name,
        unit: item.unit,
        quantity: item.qty,
        priceAtSaleRupiah: Math.round(item.price),
        subtotalRupiah: Math.round(item.subtotal),
      })),
    };
    return { ok: true, detail };
  } catch (error) {
    if (error instanceof HistoryActionError) {
      return { ok: false, error: error.message };
    }
    console.error("getTransactionDetail failed:", error);
    return { ok: false, error: "Gagal memuat detail transaksi." };
  }
}

// Refund: Go menandai struk REFUNDED, mengembalikan stok produk, dan
// menulis kartu stok IN kompensasi — semua dalam SATU transaksi database
// sehingga buku stok tetap bisa dijelaskan:
// opening + IN (restok) + IN (refund) - PENJUALAN = stok sekarang.
// Guard anti-refund-ganda dari dua tab owner yang terbuka bersamaan
// ditegakkan Go lewat UPDATE bersyarat (status harus masih COMPLETED).
// Struk yang SUDAH DISAJIKAN tetap bisa di-refund, tapi WAJIB dengan
// alasan — pemilik bisa melihat pola staf yang menyalahgunakan refund
// setelah pesanan diserahkan.
export async function refundTransaction(input: {
  transactionId: string;
  reason?: string;
}): Promise<HistoryActionResult> {
  try {
    const { token } = await requireManager();
    const tx = requireTxId(input.transactionId);
    if ("error" in tx) return { ok: false, error: tx.error };

    const reason = (input.reason ?? "").trim().slice(0, 120);
    const res = await goFetch<{ message: string }>(
      token,
      `/transactions/${tx.id}/refund`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
      },
    );
    if (!res.ok) {
      // Pesan Go spesifik per kegagalan: sudah direfund, produk
      // terhapus, alasan wajib untuk struk yang sudah disajikan, dsb.
      return { ok: false, error: res.message };
    }

    revalidatePath("/owner");
    revalidatePath("/owner/transactions");
    revalidatePath("/owner/products");
    revalidatePath("/owner/stock");
    revalidatePath("/cashier");
    return { ok: true };
  } catch (error) {
    if (error instanceof HistoryActionError) {
      return { ok: false, error: error.message };
    }
    console.error("refundTransaction failed:", error);
    return { ok: false, error: "Gagal memproses refund. Silakan coba lagi." };
  }
}
