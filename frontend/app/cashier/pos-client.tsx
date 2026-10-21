"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronUp, ShoppingCart, Store, User } from "lucide-react";
import { createTransaction } from "./actions";
import type {
  CartLineView,
  DiscountState,
  PaymentMethodValue,
  PosProduct,
  Receipt as ReceiptType,
} from "./types";
import { displayRp, priceSen } from "./ui";
import { CartPanel } from "./cart-panel";
import { ProductGrid } from "./product-grid";
import { ReceiptView } from "./receipt-view";

const INITIAL_DISCOUNT: DiscountState = {
  mode: "RP",
  rpValueSen: 0,
  percent: 0,
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
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodValue>("CASH");
  const [paidSen, setPaidSen] = useState(0);
  const [discount, setDiscount] = useState<DiscountState>(INITIAL_DISCOUNT);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptType | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const cartLines = useMemo(() => {
    const lines: CartLineView[] = [];
    for (const [id, qty] of Object.entries(cart)) {
      const product = byId.get(id);
      if (product && qty > 0) lines.push({ product, qty });
    }
    return lines;
  }, [cart, byId]);

  const subtotalSen = cartLines.reduce(
    (sum, line) => sum + priceSen(line.product) * line.qty,
    0,
  );

  // Mirrors the server formula in actions.ts exactly, so what the
  // kasir sees always matches what gets charged.
  const discountSen =
    discount.mode === "PERCENT"
      ? Math.round((subtotalSen * discount.percent) / 100)
      : discount.rpValueSen;
  const totalSen = Math.max(0, subtotalSen - discountSen);
  const itemCount = cartLines.reduce((n, line) => n + line.qty, 0);

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
        items: cartLines.map((line) => ({
          productId: line.product.id,
          quantity: line.qty,
        })),
        paymentMethod,
        paidAmount: paidSen / 100,
        // Only mode + value cross the wire; the server recomputes the
        // amount from its own subtotal before writing anything.
        discount: {
          mode: discount.mode,
          value:
            discount.mode === "RP"
              ? discount.rpValueSen / 100
              : discount.percent,
        },
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
    setPaymentMethod("CASH");
    setPaidSen(0);
    setDiscount(INITIAL_DISCOUNT);
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

  const panelProps = {
    lines: cartLines,
    subtotalSen,
    discountSen,
    discountState: discount,
    onDiscountChange: setDiscount,
    paymentMethod,
    onPaymentMethodChange: setPaymentMethod,
    paidSen,
    onPaidSenChange: setPaidSen,
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
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight text-slate-900">
                {outletName}
              </h1>
              <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                <User className="h-3 w-3 shrink-0 text-slate-400" />
                Kasir: {cashierName}
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Beranda
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl min-h-0 flex-1 flex-col gap-4 p-4 lg:grid lg:grid-cols-[minmax(0,1fr)_380px]">
        <ProductGrid
          products={products}
          cartQty={cart}
          onAdd={(id) => setQty(id, (cart[id] ?? 0) + 1)}
        />
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
            <span className="flex items-center gap-2 text-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white">
                <ShoppingCart className="h-4 w-4" />
              </span>
              <span>
                <span className="font-semibold text-slate-900">
                  {itemCount} item
                </span>
                <span className="text-slate-400"> · </span>
                <span className="font-bold tabular-nums text-slate-900">
                  {displayRp(totalSen)}
                </span>
              </span>
            </span>
            <span className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">
              Bayar
              <ChevronUp className="h-4 w-4" />
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
