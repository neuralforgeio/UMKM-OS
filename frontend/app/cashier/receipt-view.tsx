"use client";

import Link from "next/link";
import { ArrowLeft, Check, Printer, RotateCcw } from "lucide-react";
import type { Receipt as ReceiptType } from "./types";
import { formatRupiah } from "@/lib/format";

const PAYMENT_LABELS: Record<ReceiptType["paymentMethod"], string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  DEBIT: "Debit",
};

// Module-level formatter, timezone locked to Jakarta, so the printed
// timestamp reads the same on every machine that opens the receipt.
const dateFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// Print rules for the receipt paper. Everything else on the page hides
// through Tailwind's print:hidden, so only #struk-paper prints. The
// 48mm width fits the print head of common 58mm thermal printers and
// centers neatly on A4. This stylesheet is unlayered, which means it
// wins over Tailwind utilities without needing !important.
const PRINT_CSS = `
@media print {
  @page { margin: 2mm; }
  #struk-paper {
    width: 100%;
    max-width: 48mm;
    margin-inline: auto;
    padding: 0;
    border: none;
    border-radius: 0;
    box-shadow: none;
    font-size: 10px;
  }
  #struk-paper * {
    color: #000;
  }
}
`;

export function ReceiptView({
  receipt,
  outletName,
  onNewTransaction,
}: {
  receipt: ReceiptType;
  outletName: string;
  onNewTransaction: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-10">
      <style>{PRINT_CSS}</style>

      <div className="flex flex-col items-center gap-2 text-center print:hidden">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <Check className="h-7 w-7 text-emerald-600" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">
          Transaksi Berhasil
        </h1>
        <p className="text-sm text-slate-500">
          Struk siap dicetak, atau langsung mulai transaksi baru.
        </p>
      </div>

      <div
        id="struk-paper"
        className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-5 font-mono text-[13px] leading-relaxed text-slate-700 shadow-sm"
      >
        <p className="text-center text-sm font-bold uppercase tracking-wide text-slate-900">
          {outletName}
        </p>
        <p className="mt-0.5 text-center text-xs">{receipt.code}</p>
        <p className="text-center text-xs">
          {dateFmt.format(new Date(receipt.createdAt))} WIB
        </p>

        <div className="my-3 border-t border-dashed" />

        <ul className="space-y-2">
          {receipt.items.map((item) => (
            <li key={item.name}>
              <p className="font-semibold text-slate-900">{item.name}</p>
              <p className="flex justify-between">
                <span>
                  {item.quantity} x {formatRupiah(item.priceAtSale)}
                </span>
                <span className="font-semibold text-slate-900">
                  {formatRupiah(item.subtotal)}
                </span>
              </p>
            </li>
          ))}
        </ul>

        <div className="my-3 border-t border-dashed" />

        <dl className="space-y-1">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{formatRupiah(receipt.subtotal)}</dd>
          </div>
          {receipt.discount > 0 && (
            <div className="flex justify-between">
              <dt>Diskon</dt>
              <dd className="tabular-nums">
                -{formatRupiah(receipt.discount)}
              </dd>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-900">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatRupiah(receipt.total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Dibayar ({PAYMENT_LABELS[receipt.paymentMethod]})</dt>
            <dd className="tabular-nums">{formatRupiah(receipt.paidAmount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Kembalian</dt>
            <dd className="tabular-nums">
              {formatRupiah(receipt.changeAmount)}
            </dd>
          </div>
        </dl>

        <div className="my-3 border-t border-dashed" />

        <p className="text-center text-xs">Terima kasih atas kunjungan Anda</p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2.5 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
        >
          <Printer className="h-4 w-4" />
          Cetak Struk
        </button>
        <button
          type="button"
          onClick={onNewTransaction}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <RotateCcw className="h-4 w-4" />
          Transaksi Baru
        </button>
        <Link
          href="/"
          className="flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}
