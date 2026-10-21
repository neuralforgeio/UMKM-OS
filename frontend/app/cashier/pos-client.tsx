"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createTransaction } from "./actions";
import type { PaymentMethodValue, PosProduct, Receipt } from "./types";
import { formatRupiah, formatThousands } from "@/lib/format";

const PAGE_SIZE = 16;

const PAYMENT_LABELS: Record<PaymentMethodValue, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  DEBIT: "Debit",
};

type CartLineView = { product: PosProduct; qty: number };

// All money math runs in integer "sen" (1 Rp = 100 sen) to avoid float drift.
const priceSen = (product: PosProduct) =>
  Math.round(parseFloat(product.price) * 100);
const displayRp = (sen: number) => formatRupiah(sen / 100);

// Text input with live "Rp 300.000" formatting. Digits only: pasting
// "300.000" or "300,000" is cleaned to 300000 before parsing.
function MoneyInput({
  valueSen,
  onChangeSen,
  ariaLabel,
}: {
  valueSen: number;
  onChangeSen: (nextSen: number) => void;
  ariaLabel: string;
}) {
  const display = valueSen > 0 ? formatThousands(valueSen / 100) : "";

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-slate-400">
        Rp
      </span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        value={display}
        placeholder="0"
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 12);
          const rupiah = digits ? parseInt(digits, 10) : 0;
          onChangeSen(rupiah * 100);
        }}
        className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-right text-sm font-semibold tabular-nums text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function ProductCard({
  product,
  qty,
  onSetQty,
}: {
  product: PosProduct;
  qty: number;
  onSetQty: (nextQty: number) => void;
}) {
  const soldOut = product.stock <= 0;
  const lowStock = !soldOut && product.stock <= product.minStock;

  return (
    <button
      type="button"
      disabled={soldOut}
      onClick={() => onSetQty(qty + 1)}
      className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border p-2.5 text-left transition active:scale-[0.98] lg:p-3 ${
        soldOut
          ? "cursor-not-allowed border-slate-200 opacity-55"
          : "border-slate-200 bg-white hover:border-blue-400 hover:shadow-sm"
      }`}
    >
      {qty > 0 && (
        <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white shadow">
          {qty}
        </span>
      )}
      <span className="line-clamp-3 pr-6 text-[13px] font-semibold leading-snug text-slate-900 lg:text-sm">
        {product.name}
      </span>
      <span className="mt-0.5 truncate text-[10px] text-slate-400">
        {product.sku}
      </span>
      <span className="mt-1.5 text-[13px] font-bold text-blue-600 lg:text-sm">
        {displayRp(priceSen(product))}
      </span>
      <div className="mt-auto flex items-center justify-between gap-1 pt-2">
        {product.categoryName ? (
          <span className="truncate rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            {product.categoryName}
          </span>
        ) : (
          <span />
        )}
        <span
          className={`shrink-0 text-[10px] font-semibold ${
            soldOut
              ? "text-red-500"
              : lowStock
                ? "text-amber-600"
                : "text-slate-400"
          }`}
        >
          {soldOut ? "Habis" : `stok ${product.stock}`}
        </span>
      </div>
    </button>
  );
}

function CartPanel({
  lines,
  subtotalSen,
  discountSen,
  onDiscountSenChange,
  paymentMethod,
  onPaymentMethodChange,
  paidSen,
  onPaidSenChange,
  cashSuggestions,
  pending,
  error,
  onPay,
  onSetQty,
  onClear,
  onClose,
}: {
  lines: CartLineView[];
  subtotalSen: number;
  discountSen: number;
  onDiscountSenChange: (sen: number) => void;
  paymentMethod: PaymentMethodValue;
  onPaymentMethodChange: (method: PaymentMethodValue) => void;
  paidSen: number;
  onPaidSenChange: (sen: number) => void;
  cashSuggestions: number[];
  pending: boolean;
  error: string | null;
  onPay: () => void;
  onSetQty: (productId: string, nextQty: number) => void;
  onClear: () => void;
  onClose?: () => void;
}) {
  const totalSen = Math.max(0, subtotalSen - discountSen);
  const effectivePaidSen = paymentMethod === "CASH" ? paidSen : totalSen;
  const changeSen = effectivePaidSen - totalSen;
  const itemCount = lines.reduce((n, line) => n + line.qty, 0);
  const discountInvalid = discountSen > subtotalSen;
  const canPay =
    lines.length > 0 &&
    !pending &&
    !discountInvalid &&
    (paymentMethod !== "CASH" || paidSen >= totalSen);

  return (
    // Vertical layout, top to bottom, all FIXED except the item list:
    //   header  ->  scrollable item list  ->  totals  ->  payment
    //   ->  cash input  ->  pay button. Only the list ever scrolls.
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Keranjang <span className="text-slate-300">·</span> {itemCount} item
        </h2>
        <div className="flex items-center gap-1">
          {itemCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-red-500 transition hover:bg-red-50"
            >
              Kosongkan
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup keranjang"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
          <p className="text-sm text-slate-400">Keranjang masih kosong.</p>
          <p className="mt-1 text-xs text-slate-400">
            Klik produk untuk menambahkan.
          </p>
        </div>
      ) : (
        <>
          {/* The ONLY scrollable part of the panel: the item list. */}
          <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto px-4">
            {lines.map(({ product, qty }) => (
              <li key={product.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-slate-900">
                    {product.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {displayRp(priceSen(product))} / {product.unit}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Kurangi jumlah"
                    onClick={() => onSetQty(product.id, qty - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-lg leading-none text-slate-700 transition hover:bg-slate-50"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-semibold tabular-nums text-slate-900">
                    {qty}
                  </span>
                  <button
                    type="button"
                    aria-label="Tambah jumlah"
                    onClick={() => onSetQty(product.id, qty + 1)}
                    disabled={qty >= product.stock}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-lg leading-none text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                <span className="w-24 text-right text-sm font-semibold tabular-nums text-slate-900">
                  {displayRp(priceSen(product) * qty)}
                </span>
              </li>
            ))}
          </ul>

          {/* Everything from here down is pinned - never scrolls. */}
          <div className="shrink-0 space-y-3 border-t border-slate-100 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium tabular-nums text-slate-900">
                {displayRp(subtotalSen)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="shrink-0 text-slate-500">Diskon</span>
              <div className="w-40">
                <MoneyInput
                  valueSen={discountSen}
                  onChangeSen={onDiscountSenChange}
                  ariaLabel="Diskon"
                />
              </div>
            </div>
            {discountInvalid && (
              <p className="text-right text-xs text-red-600">
                Diskon melebihi subtotal.
              </p>
            )}
            <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-3">
              <span className="text-sm font-semibold text-slate-700">
                Total
              </span>
              <span className="text-lg font-bold tabular-nums text-slate-900">
                {displayRp(totalSen)}
              </span>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-100 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Metode Pembayaran
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(["CASH", "QRIS", "DEBIT"] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => onPaymentMethodChange(method)}
                  className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                    method === paymentMethod
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {PAYMENT_LABELS[method]}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === "CASH" && (
            <div className="shrink-0 space-y-2 border-t border-slate-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Uang Dibayar
              </p>
              <MoneyInput
                valueSen={paidSen}
                onChangeSen={onPaidSenChange}
                ariaLabel="Uang dibayar"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onPaidSenChange(totalSen)}
                  className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  Uang pas
                </button>
                {cashSuggestions.map((sen) => (
                  <button
                    key={sen}
                    type="button"
                    onClick={() => onPaidSenChange(sen)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold tabular-nums text-slate-600 transition hover:bg-slate-50"
                  >
                    Rp {formatThousands(sen / 100)}
                  </button>
                ))}
              </div>
              <p
                className={`text-right text-sm font-semibold tabular-nums ${
                  changeSen < 0 ? "text-red-600" : "text-emerald-600"
                }`}
              >
                {changeSen < 0
                  ? `Kurang ${displayRp(Math.abs(changeSen))}`
                  : `Kembalian ${displayRp(changeSen)}`}
              </p>
            </div>
          )}

          {error && (
            <div className="shrink-0 px-4 pb-2">
              <div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </div>
            </div>
          )}

          <div className="shrink-0 border-t border-slate-100 p-4">
            <button
              type="button"
              onClick={onPay}
              disabled={!canPay}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending
                ? "Menyimpan transaksi..."
                : `Bayar ${displayRp(totalSen)}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ReceiptView({
  receipt,
  outletName,
  onNewTransaction,
}: {
  receipt: Receipt;
  outletName: string;
  onNewTransaction: () => void;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="bg-emerald-50 px-6 py-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <svg
              className="h-6 w-6 text-emerald-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-emerald-700">
            Transaksi Berhasil
          </p>
          <h1 className="mt-1 text-xl font-bold tabular-nums text-slate-900">
            {receipt.code}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {outletName} · {new Date(receipt.createdAt).toLocaleString("id-ID")}
          </p>
        </div>

        <div className="px-6 py-4">
          <ul className="divide-y divide-slate-100">
            {receipt.items.map((item) => (
              <li
                key={item.name}
                className="flex items-start justify-between gap-3 py-2.5 text-sm"
              >
                <span className="text-slate-700">
                  {item.name}
                  <span className="ml-1 text-xs text-slate-400">
                    × {item.quantity}
                  </span>
                </span>
                <span className="font-medium tabular-nums text-slate-900">
                  {formatRupiah(item.subtotal)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-3 space-y-1.5 border-t border-dashed border-slate-200 pt-3 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span className="tabular-nums">
                {formatRupiah(receipt.subtotal)}
              </span>
            </div>
            {receipt.discount > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Diskon</span>
                <span className="tabular-nums">
                  -{formatRupiah(receipt.discount)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
              <span>Total</span>
              <span className="tabular-nums">
                {formatRupiah(receipt.total)}
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Dibayar ({PAYMENT_LABELS[receipt.paymentMethod]})</span>
              <span className="tabular-nums">
                {formatRupiah(receipt.paidAmount)}
              </span>
            </div>
            <div className="flex justify-between font-semibold text-emerald-700">
              <span>Kembalian</span>
              <span className="tabular-nums">
                {formatRupiah(receipt.changeAmount)}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 p-4">
          <button
            type="button"
            onClick={onNewTransaction}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            Transaksi Baru
          </button>
          <Link
            href="/"
            className="mt-2 block text-center text-sm font-medium text-slate-500 transition hover:text-slate-700"
          >
            Kembali ke beranda
          </Link>
        </div>
      </div>
    </main>
  );
}

export function PosClient({
  cashierName,
  outletName,
  products,
}: {
  cashierName: string;
  outletName: string;
  products: PosProduct[];
}) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodValue>("CASH");
  const [paidSen, setPaidSen] = useState(0);
  const [discountSen, setDiscountSen] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    );
  }, [products, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const placeholderCount = filtered.length > 0 ? PAGE_SIZE - paged.length : 0;

  const cartLines = useMemo(() => {
    const lines: CartLineView[] = [];
    for (const [id, qty] of Object.entries(cart)) {
      const product = byId.get(id);
      if (product && qty > 0) lines.push({ product, qty });
    }
    return lines;
  }, [cart, byId]);

  const subtotalSen = cartLines.reduce(
    (sum, l) => sum + priceSen(l.product) * l.qty,
    0,
  );
  const totalSen = Math.max(0, subtotalSen - discountSen);
  const itemCount = cartLines.reduce((n, l) => n + l.qty, 0);

  // Quick-pay suggestions: common banknotes above the total, plus the
  // total rounded up to the nearest 50k / 100k.
  const cashSuggestions = useMemo(() => {
    if (totalSen <= 0) return [] as number[];
    const options = new Set<number>();
    for (const denom of [50000, 100000, 200000, 500000]) {
      const sen = denom * 100;
      if (sen >= totalSen) options.add(sen);
    }
    for (const denom of [50000, 100000]) {
      const upSen = Math.ceil(totalSen / (denom * 100)) * denom * 100;
      if (upSen > totalSen) options.add(upSen);
    }
    return [...options].sort((a, b) => a - b).slice(0, 4);
  }, [totalSen]);

  const setQty = (productId: string, nextQty: number) => {
    const product = byId.get(productId);
    if (!product) return;
    const qty = Math.max(0, Math.min(nextQty, product.stock));
    setCart((prev) => ({ ...prev, [productId]: qty }));
  };

  const handlePay = () => {
    setError(null);
    startTransition(async () => {
      const result = await createTransaction({
        items: cartLines.map((l) => ({
          productId: l.product.id,
          quantity: l.qty,
        })),
        paymentMethod,
        paidAmount: paidSen / 100,
        discount: discountSen / 100,
      });
      if (result.ok) {
        setSheetOpen(false);
        setReceipt(result.receipt);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const resetAll = () => {
    setCart({});
    setQuery("");
    setPage(1);
    setPaymentMethod("CASH");
    setPaidSen(0);
    setDiscountSen(0);
    setError(null);
    setReceipt(null);
    setSheetOpen(false);
  };

  if (receipt) {
    return (
      <ReceiptView
        receipt={receipt}
        outletName={outletName}
        onNewTransaction={resetAll}
      />
    );
  }

  const initials = outletName
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const panelProps = {
    lines: cartLines,
    subtotalSen,
    discountSen,
    onDiscountSenChange: setDiscountSen,
    paymentMethod,
    onPaymentMethodChange: setPaymentMethod,
    paidSen,
    onPaidSenChange: setPaidSen,
    cashSuggestions,
    pending,
    error,
    onPay: handlePay,
    onSetQty: setQty,
    onClear: () => setCart({}),
  };

  return (
    // Application shell: the viewport is locked (h-dvh + overflow-hidden),
    // so panels never push the page into scrolling. Only inner lists scroll.
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-100">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
              {initials || "K"}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight text-slate-900">
                {outletName}
              </h1>
              <p className="truncate text-xs text-slate-500">
                Kasir: {cashierName}
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="shrink-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Beranda
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl min-h-0 flex-1 flex-col gap-4 p-4 lg:grid lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-100 p-3">
            <h2 className="shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Produk <span className="text-slate-300">·</span> {filtered.length}
            </h2>
            <div className="relative min-w-40 flex-1">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Cari nama produk atau SKU..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            {totalPages > 1 && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="Halaman sebelumnya"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ‹
                </button>
                {totalPages <= 5 ? (
                  Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPage(n)}
                        className={`h-8 w-8 rounded-lg text-xs font-bold tabular-nums transition ${
                          n === currentPage
                            ? "bg-blue-600 text-white shadow-sm"
                            : "border border-slate-300 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {n}
                      </button>
                    ),
                  )
                ) : (
                  <span className="px-2 text-xs font-bold tabular-nums text-slate-600">
                    {currentPage} / {totalPages}
                  </span>
                )}
                <button
                  type="button"
                  aria-label="Halaman berikutnya"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {filtered.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 p-10 text-center">
                <p className="text-sm text-slate-400">
                  Tidak ada produk yang cocok.
                </p>
              </div>
            ) : (
              // Desktop: 4x4 grid stretched to the panel, but every row
              // keeps its content as the minimum height (minmax(auto,1fr))
              // so a three-line product name is never clipped on short
              // viewports - the area simply scrolls instead. Mobile: 2-3
              // columns with internal scrolling as before.
              <div className="grid grid-cols-2 content-start gap-2.5 sm:grid-cols-3 lg:h-full lg:grid-cols-4 lg:[grid-template-rows:repeat(4,minmax(auto,1fr))] lg:gap-3">
                {paged.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    qty={cart[product.id] ?? 0}
                    onSetQty={(nextQty) => setQty(product.id, nextQty)}
                  />
                ))}
                {Array.from({ length: placeholderCount }).map((_, i) => (
                  <div
                    key={`slot-${i}`}
                    aria-hidden="true"
                    className="hidden rounded-xl border border-dashed border-slate-200 lg:block"
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="hidden min-h-0 lg:block">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
            <CartPanel {...panelProps} />
          </div>
        </aside>
      </div>

      {itemCount === 0 ? (
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-center lg:hidden">
          <p className="text-sm text-slate-400">
            Pilih produk untuk mulai transaksi
          </p>
        </div>
      ) : (
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex w-full items-center justify-between gap-3"
          >
            <span className="text-sm">
              <span className="font-semibold text-slate-900">
                {itemCount} item
              </span>
              <span className="text-slate-400"> · </span>
              <span className="font-bold tabular-nums text-slate-900">
                {displayRp(totalSen)}
              </span>
            </span>
            <span className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">
              Bayar
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m18 15-6-6-6 6" />
              </svg>
            </span>
          </button>
        </div>
      )}

      {sheetOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/60"
            onClick={() => setSheetOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 flex h-[88dvh] flex-col rounded-t-3xl bg-white shadow-2xl">
            <div className="flex shrink-0 justify-center pb-1 pt-2.5">
              <div className="h-1.5 w-10 rounded-full bg-slate-300" />
            </div>
            <CartPanel {...panelProps} onClose={() => setSheetOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
