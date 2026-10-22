/* eslint-disable @next/next/no-img-element */
"use client";

import {
  Banknote,
  CreditCard,
  Minus,
  Plus,
  QrCode,
  ShoppingBasket,
  ShoppingCart,
  Tag,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import type { CartLineView, DiscountState, PaymentMethodValue } from "./types";
import {
  categoryAvatarClass,
  displayRp,
  initialsOf,
  MoneyInput,
  PercentInput,
  priceSen,
} from "./ui";

const PAYMENT_OPTIONS: {
  method: PaymentMethodValue;
  label: string;
  Icon: typeof Banknote;
}[] = [
  { method: "CASH", label: "Tunai", Icon: Banknote },
  { method: "QRIS", label: "QRIS", Icon: QrCode },
  { method: "DEBIT", label: "Debit", Icon: CreditCard },
];

type CartPanelProps = {
  lines: CartLineView[];
  subtotalSen: number;
  discountSen: number;
  discountState: DiscountState;
  onDiscountChange: (next: DiscountState) => void;
  paymentMethod: PaymentMethodValue;
  onPaymentMethodChange: (method: PaymentMethodValue) => void;
  paidSen: number;
  onPaidSenChange: (sen: number) => void;
  pending: boolean;
  error: string | null;
  onPay: () => void;
  onSetQty: (productId: string, nextQty: number) => void;
  onClear: () => void;
  onClose?: () => void;
};

export function CartPanel({
  lines,
  subtotalSen,
  discountSen,
  discountState,
  onDiscountChange,
  paymentMethod,
  onPaymentMethodChange,
  paidSen,
  onPaidSenChange,
  pending,
  error,
  onPay,
  onSetQty,
  onClear,
  onClose,
}: CartPanelProps) {
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

  const switchDiscountMode = (mode: DiscountState["mode"]) => {
    onDiscountChange({ ...discountState, mode });
  };

  return (
    // Vertical layout, top to bottom: header -> scrollable items ->
    // totals + discount -> payment -> cash input -> pay button.
    // Everything below the list is deliberately compact (tight paddings,
    // 13px rows, inline "uang pas") so the item list keeps as much of
    // the panel height as possible and several rows show without scroll.
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <ShoppingCart className="h-3.5 w-3.5 text-slate-400" />
          Keranjang <span className="text-slate-300">·</span> {itemCount} item
        </h2>
        <div className="flex items-center gap-1">
          {itemCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-500 transition hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
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
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <ShoppingBasket className="h-7 w-7 text-slate-400" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-500">
            Keranjang masih kosong
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Klik produk di kiri untuk menambahkan.
          </p>
        </div>
      ) : (
        <>
          {/* The ONLY scrollable part of the panel: the item list.
              Thin scrollbar + overscroll-contain keep the dense list
              tidy without leaking scroll to the page. */}
          <ul className="min-h-0 flex-1 divide-y divide-slate-100 overscroll-contain overflow-y-auto px-4 [scrollbar-width:thin] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar]:w-1.5">
            {lines.map(({ product, qty }) => (
              <li key={product.id} className="flex items-center gap-2.5 py-1.5">
                {product.thumbImageId ? (
                  <img
                    src={`/api/images/${product.thumbImageId}`}
                    alt={product.name}
                    loading="lazy"
                    className="h-10 w-10 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white ${categoryAvatarClass(product.categoryName)}`}
                  >
                    {initialsOf(product.name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[13px] font-medium leading-tight text-slate-900">
                    {product.name}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-tight text-slate-400">
                    {displayRp(priceSen(product))} / {product.unit}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="Kurangi jumlah"
                    onClick={() => onSetQty(product.id, qty - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:bg-slate-50 lg:h-7 lg:w-7"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-7 text-center text-[13px] font-semibold tabular-nums text-slate-900">
                    {qty}
                  </span>
                  <button
                    type="button"
                    aria-label="Tambah jumlah"
                    onClick={() => onSetQty(product.id, qty + 1)}
                    disabled={qty >= product.stock}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 lg:h-7 lg:w-7"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="w-24 shrink-0 text-right text-[13px] font-semibold tabular-nums text-slate-900">
                  {displayRp(priceSen(product) * qty)}
                </span>
              </li>
            ))}
          </ul>

          {/* Everything from here down is pinned - never scrolls. */}
          <div className="shrink-0 space-y-2 border-t border-slate-100 px-4 py-2.5">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium tabular-nums text-slate-900">
                {displayRp(subtotalSen)}
              </span>
            </div>

            {/* Discount: dual mode (Rp / %) with a segmented toggle.
                Both values survive mode switches; the amount shown is
                always recomputed from the subtotal. */}
            <div className="flex items-center justify-between gap-2 text-[13px]">
              <span className="flex shrink-0 items-center gap-1.5 text-slate-500">
                <Tag className="h-3.5 w-3.5 text-slate-400" />
                Diskon
              </span>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                  <button
                    type="button"
                    onClick={() => switchDiscountMode("RP")}
                    className={`rounded-md px-2 py-0.5 text-xs font-bold transition ${
                      discountState.mode === "RP"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Rp
                  </button>
                  <button
                    type="button"
                    onClick={() => switchDiscountMode("PERCENT")}
                    className={`rounded-md px-2 py-0.5 text-xs font-bold transition ${
                      discountState.mode === "PERCENT"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    %
                  </button>
                </div>
                <div className="w-28">
                  {discountState.mode === "RP" ? (
                    <MoneyInput
                      valueSen={discountState.rpValueSen}
                      onChangeSen={(sen) =>
                        onDiscountChange({ ...discountState, rpValueSen: sen })
                      }
                      ariaLabel="Diskon Rupiah"
                    />
                  ) : (
                    <PercentInput
                      value={discountState.percent}
                      onChange={(pct) =>
                        onDiscountChange({ ...discountState, percent: pct })
                      }
                      ariaLabel="Diskon persen"
                    />
                  )}
                </div>
              </div>
            </div>
            {discountSen > 0 && !discountInvalid && (
              <p className="text-right text-xs font-medium tabular-nums text-emerald-600">
                Potongan -{displayRp(discountSen)}
              </p>
            )}
            {discountInvalid && (
              <p className="text-right text-xs text-red-600">
                Diskon melebihi subtotal.
              </p>
            )}
            <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-2">
              <span className="text-[13px] font-semibold text-slate-700">
                Total
              </span>
              <span className="text-base font-bold tabular-nums text-slate-900">
                {displayRp(totalSen)}
              </span>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-100 px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Metode Pembayaran
            </p>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {PAYMENT_OPTIONS.map(({ method, label, Icon }) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => onPaymentMethodChange(method)}
                  className={`flex items-center justify-center gap-1 rounded-lg border py-2 text-[13px] font-semibold transition ${
                    method === paymentMethod
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === "CASH" && (
            <div className="shrink-0 space-y-1.5 border-t border-slate-100 px-4 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Uang Dibayar
              </p>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <MoneyInput
                    valueSen={paidSen}
                    onChangeSen={onPaidSenChange}
                    ariaLabel="Uang dibayar"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onPaidSenChange(totalSen)}
                  className="shrink-0 whitespace-nowrap rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  Uang pas
                </button>
              </div>
              <p
                className={`text-right text-[13px] font-semibold tabular-nums ${
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
              <div className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">
                {error}
              </div>
            </div>
          )}

          <div className="shrink-0 border-t border-slate-100 px-4 py-3">
            <button
              type="button"
              onClick={onPay}
              disabled={!canPay}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Wallet className="h-4 w-4" />
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
