"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createTransaction } from "./actions";
import type { PaymentMethodValue, PosProduct, Receipt } from "./types";

const rupiah = new Intl.NumberFormat("id-ID");

const priceSen = (product: PosProduct) =>
  Math.round(parseFloat(product.price) * 100);
const displayRp = (sen: number) => `Rp ${rupiah.format(Math.round(sen) / 100)}`;

const PAYMENT_LABELS: Record<PaymentMethodValue, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  DEBIT: "Debit",
};

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
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodValue>("CASH");
  const [paidInput, setPaidInput] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
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

  const cartLines = useMemo(() => {
    const lines: { product: PosProduct; qty: number }[] = [];
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
  const discountSen = Math.max(
    0,
    Math.round((parseFloat(discountInput) || 0) * 100),
  );
  const totalSen = Math.max(0, subtotalSen - discountSen);
  const paidSen =
    paymentMethod === "CASH"
      ? Math.max(0, Math.round((parseFloat(paidInput) || 0) * 100))
      : totalSen;
  const changeSen = paidSen - totalSen;

  const canPay =
    cartLines.length > 0 &&
    !pending &&
    discountSen <= subtotalSen &&
    (paymentMethod !== "CASH" || paidSen >= totalSen);

  const setQty = (productId: string, nextQty: number) => {
    const product = byId.get(productId);
    if (!product) return;
    const qty = Math.max(0, Math.min(nextQty, product.stock));
    setCart((prev) => ({ ...prev, [productId]: qty }));
  };

  const handlePay = () => {
    if (!canPay) return;
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
        setReceipt(result.receipt);
        // Refresh server data so stock levels are up to date.
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const resetAll = () => {
    setCart({});
    setQuery("");
    setPaymentMethod("CASH");
    setPaidInput("");
    setDiscountInput("");
    setError(null);
    setReceipt(null);
  };

  if (receipt) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-emerald-600">
            Transaksi berhasil
          </p>
          <h1 className="mt-1 text-center text-2xl font-bold text-slate-900">
            {receipt.code}
          </h1>
          <p className="mt-1 text-center text-xs text-slate-500">
            {new Date(receipt.createdAt).toLocaleString("id-ID")}
          </p>

          <ul className="mt-6 divide-y divide-slate-100">
            {receipt.items.map((item) => (
              <li
                key={item.name}
                className="flex items-center justify-between gap-2 py-2 text-sm"
              >
                <span className="text-slate-700">
                  {item.name}{" "}
                  <span className="text-slate-400">× {item.quantity}</span>
                </span>
                <span className="tabular-nums text-slate-900">
                  {displayRp(item.subtotal * 100)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-4 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="tabular-nums">
                {displayRp(receipt.subtotal * 100)}
              </span>
            </div>
            {receipt.discount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Diskon</span>
                <span className="tabular-nums">
                  -{displayRp(receipt.discount * 100)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
              <span>Total</span>
              <span className="tabular-nums">
                {displayRp(receipt.total * 100)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Dibayar ({PAYMENT_LABELS[receipt.paymentMethod]})</span>
              <span className="tabular-nums">
                {displayRp(receipt.paidAmount * 100)}
              </span>
            </div>
            <div className="flex justify-between font-medium text-emerald-700">
              <span>Kembalian</span>
              <span className="tabular-nums">
                {displayRp(receipt.changeAmount * 100)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={resetAll}
            className="mt-6 w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Transaksi Baru
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              Kasir — {outletName}
            </h1>
            <p className="text-xs text-slate-500">Kasir: {cashierName}</p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Beranda
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-6 px-4 py-6 lg:grid-cols-[1fr_360px]">
        <section>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama produk atau SKU..."
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          {filtered.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              Tidak ada produk yang cocok dengan pencarian.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((product) => {
                const qty = cart[product.id] ?? 0;
                const soldOut = product.stock <= 0;
                const lowStock = !soldOut && product.stock <= product.minStock;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setQty(product.id, qty + 1)}
                    disabled={soldOut}
                    className={`relative rounded-2xl bg-white p-4 text-left shadow-sm transition hover:shadow-md ${
                      soldOut ? "cursor-not-allowed opacity-50" : ""
                    }`}
                  >
                    {qty > 0 && (
                      <span className="absolute right-3 top-3 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                        {qty}x
                      </span>
                    )}
                    <p className="pr-14 font-semibold text-slate-900">
                      {product.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {product.sku}
                    </p>
                    <div className="mt-3 flex items-end justify-between">
                      <span className="font-bold text-blue-600">
                        {displayRp(priceSen(product))}
                      </span>
                      <span
                        className={`text-xs ${
                          soldOut
                            ? "font-semibold text-red-600"
                            : lowStock
                              ? "text-amber-600"
                              : "text-slate-500"
                        }`}
                      >
                        {soldOut
                          ? "Habis"
                          : `stok ${product.stock} ${product.unit}`}
                      </span>
                    </div>
                    {product.categoryName && (
                      <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                        {product.categoryName}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="h-fit rounded-2xl bg-white p-4 shadow-sm lg:sticky lg:top-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Keranjang ({cartLines.reduce((n, l) => n + l.qty, 0)} item)
          </h2>

          {cartLines.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              Keranjang kosong. Klik produk di kiri untuk menambah.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {cartLines.map(({ product, qty }) => (
                <li key={product.id} className="flex items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {product.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {displayRp(priceSen(product))} / {product.unit}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setQty(product.id, qty - 1)}
                      className="h-7 w-7 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm tabular-nums text-slate-900">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(product.id, qty + 1)}
                      disabled={qty >= product.stock}
                      className="h-7 w-7 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  <span className="w-24 text-right text-sm tabular-nums text-slate-900">
                    {displayRp(priceSen(product) * qty)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="tabular-nums">{displayRp(subtotalSen)}</span>
            </div>
            <label className="flex items-center justify-between gap-2 text-slate-600">
              <span>Diskon (Rp)</span>
              <input
                type="number"
                min={0}
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                placeholder="0"
                className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-blue-500"
              />
            </label>
            {discountSen > subtotalSen && (
              <p className="text-right text-xs text-red-600">
                Diskon melebihi subtotal.
              </p>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
              <span>Total</span>
              <span className="tabular-nums">{displayRp(totalSen)}</span>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-medium text-slate-500">
              Metode pembayaran
            </p>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {(["CASH", "QRIS", "DEBIT"] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`rounded-lg border py-2 text-sm font-medium transition ${
                    method === paymentMethod
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {PAYMENT_LABELS[method]}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === "CASH" && (
            <div className="mt-3">
              <label className="flex items-center justify-between gap-2 text-sm text-slate-600">
                <span>Uang dibayar (Rp)</span>
                <button
                  type="button"
                  onClick={() => setPaidInput(String(totalSen / 100))}
                  className="rounded-md border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Uang pas
                </button>
              </label>
              <input
                type="number"
                min={0}
                value={paidInput}
                onChange={(e) => setPaidInput(e.target.value)}
                placeholder="0"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-right text-sm tabular-nums outline-none focus:border-blue-500"
              />
              <p
                className={`mt-1.5 text-right text-sm ${
                  changeSen < 0 ? "text-red-600" : "text-emerald-700"
                }`}
              >
                {changeSen < 0
                  ? `Kurang ${displayRp(-changeSen)}`
                  : `Kembalian ${displayRp(changeSen)}`}
              </p>
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handlePay}
            disabled={!canPay}
            className="mt-4 w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending
              ? "Menyimpan transaksi..."
              : `Bayar ${displayRp(totalSen)}`}
          </button>
        </aside>
      </div>
    </main>
  );
}
