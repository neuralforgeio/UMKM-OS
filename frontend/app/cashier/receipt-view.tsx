"use client";

import Link from "next/link";
import { ArrowLeft, Banknote, Check, Receipt, RotateCcw } from "lucide-react";
import type { Receipt as ReceiptType } from "./types";
import { formatRupiah } from "@/lib/format";

const PAYMENT_LABELS: Record<ReceiptType["paymentMethod"], string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  DEBIT: "Debit",
};

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
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-sm">
        <div className="bg-emerald-50 px-6 py-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <Check className="h-6 w-6 text-emerald-600" strokeWidth={3} />
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-emerald-700">
            Transaksi Berhasil
          </p>
          <h1 className="mt-1 flex items-center justify-center gap-1.5 text-xl font-bold tabular-nums text-slate-900">
            <Receipt className="h-5 w-5 shrink-0 text-emerald-600" />
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
                    x {item.quantity}
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
              <div className="flex justify-between text-emerald-600">
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
              <span className="flex items-center gap-1.5">
                <Banknote className="h-3.5 w-3.5 text-slate-400" />
                Dibayar ({PAYMENT_LABELS[receipt.paymentMethod]})
              </span>
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
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            <RotateCcw className="h-4 w-4" />
            Transaksi Baru
          </button>
          <Link
            href="/"
            className="mt-2 flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke beranda
          </Link>
        </div>
      </div>
    </main>
  );
}
