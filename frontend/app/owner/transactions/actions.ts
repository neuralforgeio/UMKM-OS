"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { formatThousands } from "@/lib/format";
import type { DetailResult, TransactionDetail } from "./types";

export type HistoryActionResult = { ok: true } | { ok: false; error: string };

// Thrown for user-facing validation failures, mirroring the products
// action error pattern: the outer catch turns it into a friendly
// message instead of a stack trace.
class HistoryActionError extends Error {}

// Every action here is owner-only: the client hides the buttons for
// cashiers, but the server action is the real gate.
async function requireOwner(): Promise<{ outletId: string; userId: string }> {
  const session = await auth();
  if (!session?.user) {
    throw new HistoryActionError("Sesi sudah berakhir. Silakan login ulang.");
  }
  if (session.user.role !== "OWNER" && session.user.role !== "DEVELOPER") {
    throw new HistoryActionError(
      "Hanya pemilik yang boleh mengakses riwayat transaksi.",
    );
  }
  // Owners may not be tied to an outlet; fall back to the first one,
  // mirroring the cashier and dashboard resolution.
  let outletId = session.user.outletId;
  if (!outletId) {
    const firstOutlet = await prisma.outlet.findFirst({
      select: { id: true },
    });
    if (!firstOutlet) {
      throw new HistoryActionError("Belum ada outlet terdaftar.");
    }
    outletId = firstOutlet.id;
  }
  return { outletId, userId: session.user.id };
}

// Loads one receipt (with its line items) for the owner detail panel.
// Scoped to the owner's outlet so one outlet can never peek into
// another outlet's receipts.
export async function getTransactionDetail(
  transactionId: string,
): Promise<DetailResult> {
  try {
    const { outletId } = await requireOwner();
    if (typeof transactionId !== "string" || transactionId.length === 0) {
      return { ok: false, error: "ID transaksi tidak valid." };
    }
    const trx = await prisma.transaction.findFirst({
      where: { id: transactionId, outletId },
      select: {
        id: true,
        code: true,
        createdAt: true,
        paymentMethod: true,
        status: true,
        subtotal: true,
        discount: true,
        total: true,
        paidAmount: true,
        changeAmount: true,
        cashier: { select: { name: true } },
        claimCode: true,
        handoverStatus: true,
        items: {
          orderBy: { product: { name: "asc" } },
          select: {
            quantity: true,
            priceAtSale: true,
            subtotal: true,
            product: { select: { name: true, unit: true } },
          },
        },
      },
    });
    if (!trx) {
      return { ok: false, error: "Transaksi tidak ditemukan." };
    }
    const detail: TransactionDetail = {
      id: trx.id,
      code: trx.code,
      createdAtIso: trx.createdAt.toISOString(),
      paymentMethod: trx.paymentMethod,
      status: trx.status,
      subtotalRupiah: Math.round(Number(trx.subtotal)),
      discountRupiah: Math.round(Number(trx.discount)),
      totalRupiah: Math.round(Number(trx.total)),
      paidRupiah: Math.round(Number(trx.paidAmount)),
      changeRupiah: Math.round(Number(trx.changeAmount)),
      cashierName: trx.cashier?.name ?? "-",
      claimCode: trx.claimCode,
      handoverStatus: trx.handoverStatus,
      items: trx.items.map((item) => ({
        productName: item.product.name,
        unit: item.product.unit,
        quantity: item.quantity,
        priceAtSaleRupiah: Math.round(Number(item.priceAtSale)),
        subtotalRupiah: Math.round(Number(item.subtotal)),
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

// Refund: marks the receipt REFUNDED, restores product stock, and
// writes compensating IN movements — all inside one database
// transaction so the stock ledger stays explainable:
// opening + IN (restock) + IN (refund) - SALE = stock now.
// The status update is a conditional updateMany (status must still be
// COMPLETED), which doubles as the concurrency guard against double
// refunds from two open owner tabs.
// Refund paga (v3): a SERVED receipt CAN still be refunded, but never
// silently — a reason becomes mandatory so the owner can spot staff
// abusing refunds after the order was handed over.
export async function refundTransaction(input: {
  transactionId: string;
  reason?: string;
}): Promise<HistoryActionResult> {
  try {
    const { outletId, userId } = await requireOwner();
    const reason = (input.reason ?? "").trim().slice(0, 120);
    if (
      typeof input.transactionId !== "string" ||
      input.transactionId.length === 0
    ) {
      return { ok: false, error: "ID transaksi tidak valid." };
    }
    await prisma.$transaction(async (tx) => {
      const trx = await tx.transaction.findFirst({
        where: { id: input.transactionId, outletId },
        select: { id: true, code: true, total: true, handoverStatus: true },
      });
      if (!trx) {
        throw new HistoryActionError("Transaksi tidak ditemukan.");
      }
      if (trx.handoverStatus === "SERVED" && !reason) {
        throw new HistoryActionError(
          "Struk ini tercatat SUDAH DISAJIKAN — refund wajib menyertakan alasan (mis. pesanan salah, komplain pembeli).",
        );
      }
      const upd = await tx.transaction.updateMany({
        where: { id: trx.id, status: "COMPLETED" },
        data: { status: "REFUNDED" },
      });
      if (upd.count === 0) {
        throw new HistoryActionError(
          "Transaksi ini sudah direfund sebelumnya.",
        );
      }
      const items = await tx.transactionItem.findMany({
        where: { transactionId: trx.id },
        select: { productId: true, quantity: true },
      });
      for (const item of items) {
        const res = await tx.product.updateMany({
          where: { id: item.productId, outletId },
          data: { stock: { increment: item.quantity } },
        });
        if (res.count === 0) {
          throw new HistoryActionError(
            "Ada produk pada transaksi ini yang sudah tidak terdaftar — stok tidak bisa dikembalikan.",
          );
        }
      }
      if (items.length > 0) {
        await tx.stockMovement.createMany({
          data: items.map((item) => ({
            productId: item.productId,
            type: "IN" as const,
            quantity: item.quantity,
            note: `Refund ${trx.code}${reason ? ` — ${reason}` : ""}`,
            userId,
            transactionId: trx.id,
          })),
        });
      }
      // Refund = aksi paling sensitif (uang kembali + stok naik) — wajib
      // tercatat berjejak, apalagi untuk struk yang sudah disajikan.
      await audit({
        actorId: userId,
        outletId,
        action: "TRANSACTION_REFUND",
        entity: `transaction:${trx.id}`,
        summary: `Refund ${trx.code} — Rp ${formatThousands(Number(trx.total))}${reason ? ` — alasan: ${reason}` : ""}`,
        meta: {
          code: trx.code,
          totalRupiah: Number(trx.total),
          itemCount: items.length,
          reason: reason || null,
        },
        db: tx,
      });
  });

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
