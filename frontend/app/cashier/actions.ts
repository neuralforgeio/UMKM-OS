"use server";

import QRCode from "qrcode";
import { formatThousands } from "@/lib/format";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { getOutletContext } from "@/lib/outlet-context";
import type {
  CheckoutResult,
  DiscountInput,
  PaymentMethodValue,
} from "./types";

// Checkout kini memanggil backend-go POST /api/v1/transactions: harga,
// stok (dikunci FOR UPDATE), validasi diskon vs subtotal, dan kembalian
// semuanya dihitung ulang di server Go dari data segar — browser tetap
// hanya mengirim mode + nilai diskon, tidak pernah total.
const PAYMENT_METHODS: PaymentMethodValue[] = ["CASH", "QRIS", "DEBIT"];
const DISCOUNT_MODES: DiscountInput["mode"][] = ["RP", "PERCENT"];

// Bentuk respons yang dipakai dari Go.
type GoTransaction = {
  id: number;
  receipt_no: string;
  // Kunci interaktif pembeli (v1.3.0) diteruskan ke struk supaya pembeli takeaway bisa konfirmasi / bantah di verify/{kode}
  claim_code: string | null;
  created_at: string;
  payment_method: PaymentMethodValue;
  subtotal: number;
  discount: number;
  total: number;
  paid_amount: number;
  change_amount: number;
};
type GoItem = {
  product_name: string;
  qty: number;
  price: number;
  subtotal: number;
};
type GoPrice = { id: number; price: number };

// Diskon (mode, value) diubah menjadi nominal Rupiah datar untuk Go.
// Mode RP tinggal pembulatan. Mode PERCENT butuh subtotal dari harga
// yang dipercaya — diambil segar dari backend-go sesaat sebelum
// checkout, bukan dari harga yang dibawa browser (bisa basi). Hasilnya
// tetap divalidasi Go: diskon tidak boleh melebihi subtotal versinya.
async function resolveDiscountRp(
  discount: DiscountInput | undefined,
  goToken: string,
  items: { productId: string; quantity: number }[],
): Promise<number | { error: string }> {
  if (!discount) return 0;
  if (!DISCOUNT_MODES.includes(discount.mode)) {
    return { error: "Mode diskon tidak valid." };
  }
  if (!Number.isFinite(discount.value) || discount.value < 0) {
    return { error: "Nilai diskon tidak valid." };
  }
  if (discount.mode === "RP") return Math.round(discount.value);
  if (discount.value > 100) {
    return { error: "Diskon tidak boleh melebihi 100%." };
  }
  const products = await goFetch<GoPrice[]>(goToken, "/products");
  if (!products.ok) return { error: products.message };
  const priceById = new Map(products.data.map((p) => [String(p.id), p.price]));
  let subtotalRp = 0;
  for (const line of items) {
    const price = priceById.get(line.productId);
    if (price === undefined) {
      return { error: "Ada produk yang tidak ditemukan di outlet ini." };
    }
    subtotalRp += price * line.quantity;
  }
  return Math.round((subtotalRp * discount.value) / 100);
}

export async function createTransaction(input: {
  items: { productId: string; quantity: number }[];
  paymentMethod: PaymentMethodValue;
  paidAmount: number;
  discount?: DiscountInput;
}): Promise<CheckoutResult> {
  const session = await auth();
  if (!session?.user || !session.user.goToken) {
    return { ok: false, error: "Sesi sudah berakhir. Silakan login ulang." };
  }
  const goToken = session.user.goToken;
  const { items, paymentMethod } = input;
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    return { ok: false, error: "Metode pembayaran tidak valid." };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "Keranjang masih kosong." };
  }
  for (const line of items) {
    if (typeof line.productId !== "string" || !/^\d+$/.test(line.productId)) {
      return { ok: false, error: "Ada produk yang tidak valid." };
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      return { ok: false, error: "Jumlah item tidak valid." };
    }
  }
  if (!Number.isFinite(input.paidAmount)) {
    return { ok: false, error: "Nilai pembayaran tidak valid." };
  }
  const paidRp = Math.max(0, Math.round(input.paidAmount ?? 0));

  const discountRp = await resolveDiscountRp(input.discount, goToken, items);
  if (typeof discountRp !== "number") {
    return { ok: false, error: discountRp.error };
  }

  // Nama outlet masuk payload QR struk — v2.0.0 dari backend-go
  // (GET /my/outlet, ter-scope ke outlet kasir yang sedang jualan).
  const outletCtx = await getOutletContext();
  const outletName = outletCtx?.name ?? "Warung";

  const result = await goFetch<{ transaction: GoTransaction; items: GoItem[] }>(
    goToken,
    "/transactions",
    {
      method: "POST",
      body: JSON.stringify({
        items: items.map((line) => ({
          product_id: Number(line.productId),
          qty: line.quantity,
        })),
        discount: discountRp,
        payment_method: paymentMethod,
        paid_amount: paidRp,
      }),
    },
  );
  if (!result.ok) {
    // Pesan Go sudah ramah-kasir dan spesifik (mis. "Stok Aqua 600ml
    // tinggal 2 (diminta 5)") — teruskan apa adanya ke layar kasir.
    return { ok: false, error: result.message };
  }

  const t = result.data.transaction;
  const receipt = {
    code: t.receipt_no,
    transactionId: String(t.id),
    claimCode: t.claim_code ?? null,
    createdAt: t.created_at,
    paymentMethod: t.payment_method,
    subtotal: t.subtotal,
    discount: t.discount,
    total: t.total,
    paidAmount: t.paid_amount,
    changeAmount: t.change_amount,
    items: result.data.items.map((item) => ({
      name: item.product_name,
      quantity: item.qty,
      priceAtSale: item.price,
      subtotal: item.subtotal,
    })),
  };

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
      ? `${appUrl}/verify/${receipt.claimCode ?? receipt.code}`
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
}
