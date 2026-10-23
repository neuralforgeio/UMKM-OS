"use server";

import QRCode from "qrcode";
import { formatThousands } from "@/lib/format";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateHandoverCode } from "@/lib/handover";
import { audit } from "@/lib/audit";
import type {
  CheckoutResult,
  DiscountInput,
  PaymentMethodValue,
} from "./types";

// All money math runs in integer "sen" (1 Rp = 100 sen) to avoid floating
// point drift, then converts back to a Decimal string for Prisma.
const toSen = (rupiah: number) => Math.round(rupiah * 100);
const toDecimalString = (sen: number) => (sen / 100).toFixed(2);

const PAYMENT_METHODS: PaymentMethodValue[] = ["CASH", "QRIS", "DEBIT"];
const DISCOUNT_MODES: DiscountInput["mode"][] = ["RP", "PERCENT"];

// Thrown inside the transaction for user-facing validation failures.
class CheckoutError extends Error {}

// Turns the (mode, value) discount pair into a flat sen amount, derived
// ONLY from the server-side subtotal. Never trust a client-computed
// discount total: the browser sends mode + value, nothing else.
function resolveDiscountSen(
  discount: DiscountInput | undefined,
  subtotalSen: number,
): number {
  if (!discount) return 0;
  if (!DISCOUNT_MODES.includes(discount.mode)) {
    throw new CheckoutError("Mode diskon tidak valid.");
  }
  if (!Number.isFinite(discount.value) || discount.value < 0) {
    throw new CheckoutError("Nilai diskon tidak valid.");
  }
  if (discount.mode === "PERCENT") {
    if (discount.value > 100) {
      throw new CheckoutError("Diskon tidak boleh melebihi 100%.");
    }
    return Math.round((subtotalSen * discount.value) / 100);
  }
  return toSen(discount.value);
}

export async function createTransaction(input: {
  items: { productId: string; quantity: number }[];
  paymentMethod: PaymentMethodValue;
  paidAmount: number;
  discount?: DiscountInput;
}): Promise<CheckoutResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Sesi sudah berakhir. Silakan login ulang." };
  }
  const sessionUser = session.user;
  const { items, paymentMethod } = input;
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    return { ok: false, error: "Metode pembayaran tidak valid." };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "Keranjang masih kosong." };
  }
  for (const line of items) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      return { ok: false, error: "Jumlah item tidak valid." };
    }
  }
  if (!Number.isFinite(input.paidAmount)) {
    return { ok: false, error: "Nilai pembayaran tidak valid." };
  }
  const paidSen = toSen(Math.max(0, input.paidAmount ?? 0));
  // Kasir is bound to one outlet; owner falls back to the first outlet.
  let outletId = sessionUser.outletId;
  if (!outletId) {
    if (sessionUser.role !== "OWNER" && sessionUser.role !== "DEVELOPER") {
      return {
        ok: false,
        error: "Akun kasir ini tidak terikat ke outlet mana pun.",
      };
    }
    const firstOutlet = await prisma.outlet.findFirst({ select: { id: true } });
    if (!firstOutlet) {
      return { ok: false, error: "Belum ada outlet terdaftar." };
    }
    outletId = firstOutlet.id;
  }
  const effectiveOutletId: string = outletId;
  // Outlet name goes into the scannable QR payload on the receipt.
  const outletName =
    (
      await prisma.outlet.findUnique({
        where: { id: effectiveOutletId },
        select: { name: true },
      })
    )?.name ?? "Warung";
  try {
    const receipt = await prisma.$transaction(async (tx) => {
      // Only products belonging to this outlet can be sold.
      const productIds = items.map((line) => line.productId);
      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
          outletId: effectiveOutletId,
          isActive: true,
        },
        select: { id: true, name: true, price: true, stock: true },
      });
      const byId = new Map(products.map((p) => [p.id, p]));
      const lines = items.map((line) => {
        const product = byId.get(line.productId);
        if (!product) {
          throw new CheckoutError(
            "Ada produk yang tidak ditemukan di outlet ini.",
          );
        }
        if (product.stock < line.quantity) {
          throw new CheckoutError(
            `Stok ${product.name} tersisa ${product.stock}.`,
          );
        }
        // Trust ONLY the server-side price, never what the browser sent.
        const priceSen = toSen(Number(product.price));
        return {
          product,
          quantity: line.quantity,
          priceSen,
          subtotalSen: priceSen * line.quantity,
        };
      });
      const subtotalSen = lines.reduce(
        (sum, line) => sum + line.subtotalSen,
        0,
      );
      // Discount is resolved here, from the server-side subtotal.
      const discountSen = resolveDiscountSen(input.discount, subtotalSen);
      if (discountSen > subtotalSen) {
        throw new CheckoutError("Diskon tidak boleh melebihi subtotal.");
      }
      const totalSen = subtotalSen - discountSen;
      // Non-cash methods are charged the exact amount.
      const effectivePaidSen = paymentMethod === "CASH" ? paidSen : totalSen;
      if (effectivePaidSen < totalSen) {
        throw new CheckoutError("Uang yang dibayar kurang dari total belanja.");
      }
      const changeSen = effectivePaidSen - totalSen;
      // Receipt code, e.g. TRX-20261021-0001. The unique constraint on
      // code guards against the rare same-second collision.
      const now = new Date();
      const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const todayCount = await tx.transaction.count({
        where: { outletId: effectiveOutletId, createdAt: { gte: startOfDay } },
      });
      const code = `TRX-${ymd}-${String(todayCount + 1).padStart(4, "0")}`;
      // Kode verifikasi 8 karakter tetap DIGENERATE dan disimpan (untuk
      // jalur online/WA di masa depan), tetapi sejak v3 dine-in kode ini
      // TIDAK dicetak di struk dan TIDAK masuk QR — pembeli tidak boleh
      // memegang kunci verifikasi apa pun. Penyerahan dine-in dicatat
      // staf lewat Antrean Penyajian (/owner/verify → "Sudah Disajikan").
      // Retried a few times in the rare case the draw collides.
      let claimCode = generateHandoverCode();
      for (let i = 0; i < 6; i++) {
        const taken = await tx.transaction.findUnique({
          where: { claimCode },
          select: { id: true },
        });
        if (!taken) break;
        claimCode = generateHandoverCode();
      }
      const created = await tx.transaction.create({
        data: {
          code,
          claimCode,
          outletId: effectiveOutletId,
          cashierId: sessionUser.id,
          paymentMethod,
          status: "COMPLETED",
          subtotal: toDecimalString(subtotalSen),
          discount: toDecimalString(discountSen),
          total: toDecimalString(totalSen),
          paidAmount: toDecimalString(effectivePaidSen),
          changeAmount: toDecimalString(changeSen),
          items: {
            create: lines.map((line) => ({
              productId: line.product.id,
              quantity: line.quantity,
              priceAtSale: toDecimalString(line.priceSen),
              subtotal: toDecimalString(line.subtotalSen),
            })),
          },
        },
      });
      // Conditional decrement: the WHERE clause re-checks stock so a
      // concurrent sale can never oversell. count === 0 means the guard
      // failed and the whole transaction rolls back.
      for (const line of lines) {
        const res = await tx.product.updateMany({
          where: {
            id: line.product.id,
            outletId: effectiveOutletId,
            isActive: true,
            stock: { gte: line.quantity },
          },
          data: { stock: { decrement: line.quantity } },
        });
        if (res.count === 0) {
          throw new CheckoutError(
            `Stok ${line.product.name} baru saja berubah. Silakan coba lagi.`,
          );
        }
      }
      // Blueprint: the receipt writes its SALE movements inside the same
      // database transaction, so the stock ledger and the receipts can
      // never disagree. Quantities are stored positive; the SALE type
      // carries the direction, and unitCost stays null on sales.
      await tx.stockMovement.createMany({
        data: lines.map((line) => ({
          productId: line.product.id,
          type: "SALE" as const,
          quantity: line.quantity,
          userId: sessionUser.id,
          transactionId: created.id,
        })),
      });
      // Jejak audit menumpang transaksi yang sama: kalau baris audit gagal
      // tertulis, Postgres menolak commit dan seluruh checkout batal —
      // syarat "semuanya tercatat" ditegakkan database, bukan niat baik.
      await audit({
        actorId: sessionUser.id,
        outletId: effectiveOutletId,
        action: "TRANSACTION_CREATE",
        entity: `transaction:${created.id}`,
        summary: `Transaksi ${code} — Rp ${formatThousands(totalSen / 100)} (${paymentMethod})`,
        meta: {
          code,
          totalRupiah: totalSen / 100,
          paymentMethod,
          itemCount: lines.length,
        },
        db: tx,
      });
      return {
        code: created.code,
        transactionId: created.id,
        createdAt: created.createdAt.toISOString(),
        paymentMethod,
        subtotal: subtotalSen / 100,
        discount: discountSen / 100,
        total: totalSen / 100,
        paidAmount: effectivePaidSen / 100,
        changeAmount: changeSen / 100,
        items: lines.map((line) => ({
          name: line.product.name,
          quantity: line.quantity,
          priceAtSale: line.priceSen / 100,
          subtotal: line.subtotalSen / 100,
        })),
      };
    });

    // Scannable receipt QR, generated best-effort AFTER the commit: the
    // transaction is already saved at this point, so a QR failure must
    // never be reported as a failed checkout — the receipt still renders,
    // just without the QR block (qrSvg stays ""). With NEXT_PUBLIC_APP_URL
    // set the QR encodes the PUBLIC status page keyed by the RECEIPT CODE
    // (v3: the number printed on the struk is an address, not a secret —
    // the buyer can LOOK but never confirm/dispute from it). Without it
    // the payload is a plain-text summary, readable by any scanner app.
    let qrSvg = "";
    try {
      const itemCount = receipt.items.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      const timeWib = new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(new Date(receipt.createdAt));
      const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
      const payload = appUrl
        ? `${appUrl}/verify/${receipt.code}`
        : [
            `STRUK ${outletName}`,
            receipt.code,
            `${timeWib} WIB`,
            `${itemCount} item - Total Rp ${formatThousands(receipt.total)}`,
          ].join("\n");
      qrSvg = await QRCode.toString(payload, {
        type: "svg",
        errorCorrectionLevel: "M",
        width: 128,
      });
    } catch (error) {
      console.error("Receipt QR generation failed:", error);
    }

    revalidatePath("/cashier");
    revalidatePath("/owner");
    revalidatePath("/owner/products");
    revalidatePath("/owner/stock");
    revalidatePath("/owner/verify"); // antrean penyajian + konsol verifikasi
    revalidatePath("/owner/transactions"); // riwayat transaksi owner
    return { ok: true, receipt: { ...receipt, qrSvg } };
  } catch (error) {
    if (error instanceof CheckoutError) {
      return { ok: false, error: error.message };
    }
    console.error("createTransaction failed:", error);
    return {
      ok: false,
      error: "Gagal menyimpan transaksi. Silakan coba lagi.",
    };
  }
}
