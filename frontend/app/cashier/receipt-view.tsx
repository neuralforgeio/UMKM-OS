"use client";

import Link from "next/link";
import { ArrowLeft, Check, Printer, RotateCcw } from "lucide-react";
import type { OutletInfo, Receipt as ReceiptType } from "./types";
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

// Screen + print rules for the receipt paper. Everything else on the
// page hides through Tailwind's print:hidden, so ONLY #struk-paper
// prints (the old version leaked the "Kembali ke beranda" link onto
// the paper — fixed here). The 48mm width fits the print head of
// common 58mm thermal printers and centers neatly on A4. This
// stylesheet is unlayered, which means it wins over Tailwind
// utilities without needing !important.
const RECEIPT_CSS = `
/* Screen only: perforated bottom edge of the paper. */
.receipt-tear {
  height: 10px;
  background-image: radial-gradient(circle at 5px 10px, transparent 4px, #fff 4.5px);
  background-size: 10px 10px;
  background-position: bottom;
  background-repeat: repeat-x;
}
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
  /* The UMKM logo keeps its original colors on paper (choose "Color"
     in the print dialog); monochrome thermal printers dither it. */
  #struk-paper img {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;

function Divider() {
  return (
    <div
      role="presentation"
      className="my-2.5 border-t border-dashed border-neutral-400"
    />
  );
}

export function ReceiptView({
  receipt,
  outlet,
  onNewTransaction,
}: {
  receipt: ReceiptType;
  outlet: OutletInfo;
  onNewTransaction: () => void;
}) {
  const createdAt = dateFmt.format(new Date(receipt.createdAt));

  return (
    <div className="min-h-dvh bg-slate-100 print:bg-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:py-12">
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_340px] print:block">
          {/* Summary + actions — never printed. */}
          <section className="space-y-6 print:hidden">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100">
                <Check className="h-7 w-7 text-emerald-600" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Transaksi Berhasil
                </h1>
                <p className="mt-0.5 text-sm text-slate-500">
                  Struk siap dicetak — periksa sekali lagi sebelum menutup
                  halaman ini.
                </p>
              </div>
            </div>

            <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <dt className="text-sm text-slate-500">Kode struk</dt>
                <dd className="font-mono text-sm font-semibold text-slate-900">
                  {receipt.code}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <dt className="text-sm text-slate-500">Waktu</dt>
                <dd className="text-sm font-medium text-slate-900">
                  {createdAt} WIB
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <dt className="text-sm text-slate-500">Metode pembayaran</dt>
                <dd className="text-sm font-medium text-slate-900">
                  {PAYMENT_LABELS[receipt.paymentMethod]}
                </dd>
              </div>
            </dl>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium tabular-nums text-slate-900">
                  {formatRupiah(receipt.subtotal)}
                </span>
              </div>
              {receipt.discount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Diskon</span>
                  <span className="font-medium tabular-nums text-rose-600">
                    -{formatRupiah(receipt.discount)}
                  </span>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
                <span className="text-base font-bold text-slate-900">
                  Total
                </span>
                <span className="text-2xl font-extrabold tracking-tight tabular-nums text-slate-900">
                  {formatRupiah(receipt.total)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  Dibayar ({PAYMENT_LABELS[receipt.paymentMethod]})
                </span>
                <span className="font-medium tabular-nums text-slate-900">
                  {formatRupiah(receipt.paidAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Kembalian</span>
                <span className="font-semibold tabular-nums text-emerald-600">
                  {formatRupiah(receipt.changeAmount)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
              >
                <Printer className="h-4 w-4" />
                Cetak Struk
              </button>
              <button
                type="button"
                onClick={onNewTransaction}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" />
                Transaksi Baru
              </button>
            </div>

            <Link
              href="/"
              className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke beranda
            </Link>
          </section>

          {/* The receipt paper — the ONLY thing that prints. */}
          <div className="lg:sticky lg:top-8 print:static">
            <div
              id="struk-paper"
              className="relative mx-auto w-full max-w-[340px] bg-white font-mono text-[11px] leading-relaxed text-slate-900 shadow-xl"
            >
              <div className="px-5 py-6 print:px-0 print:py-0">
                {outlet.logoUrl ? (
                  <div className="flex items-start gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={outlet.logoUrl}
                      alt={`Logo ${outlet.name}`}
                      className="h-10 w-10 shrink-0 rounded-md object-contain print:h-[9mm] print:w-[9mm] print:rounded-none"
                    />
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold uppercase leading-tight tracking-wide break-words">
                        {outlet.name}
                      </p>
                      {outlet.address && (
                        <p className="mt-0.5 text-[9px] leading-snug">
                          {outlet.address}
                        </p>
                      )}
                      {outlet.phone && (
                        <p className="text-[9px] leading-snug">
                          Telp {outlet.phone}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-[12px] font-bold uppercase leading-tight tracking-wide break-words">
                      {outlet.name}
                    </p>
                    {outlet.address && (
                      <p className="mt-0.5 text-[9px] leading-snug">
                        {outlet.address}
                      </p>
                    )}
                    {outlet.phone && (
                      <p className="text-[9px] leading-snug">
                        Telp {outlet.phone}
                      </p>
                    )}
                  </div>
                )}

                <Divider />
                <div className="flex justify-between text-[10px]">
                  <span>No</span>
                  <span className="break-all">{receipt.code}</span>
                </div>
                <div className="mt-0.5 flex justify-between text-[10px]">
                  <span>Tgl</span>
                  <span>{createdAt} WIB</span>
                </div>

                <Divider />
                <div className="space-y-2">
                  {receipt.items.map((item) => (
                    <div key={item.name}>
                      <p className="font-bold leading-snug break-words">
                        {item.name}
                      </p>
                      <div className="flex justify-between gap-2 text-[10px]">
                        <span>
                          {item.quantity} x {formatRupiah(item.priceAtSale)}
                        </span>
                        <span className="tabular-nums">
                          {formatRupiah(item.subtotal)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <Divider />
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="tabular-nums">
                      {formatRupiah(receipt.subtotal)}
                    </span>
                  </div>
                  {receipt.discount > 0 && (
                    <div className="flex justify-between">
                      <span>Diskon</span>
                      <span className="tabular-nums">
                        -{formatRupiah(receipt.discount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-0.5 text-[12px] font-bold">
                    <span>Total</span>
                    <span className="tabular-nums">
                      {formatRupiah(receipt.total)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>
                      Dibayar ({PAYMENT_LABELS[receipt.paymentMethod]})
                    </span>
                    <span className="tabular-nums">
                      {formatRupiah(receipt.paidAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kembalian</span>
                    <span className="tabular-nums">
                      {formatRupiah(receipt.changeAmount)}
                    </span>
                  </div>
                </div>

                <Divider />
                <p className="text-center text-[10px]">
                  Terima kasih atas kunjungan Anda
                </p>
                <p className="mt-0.5 text-center text-[9px]">
                  -- {outlet.name} --
                </p>
              </div>
              {/* Perforated edge — screen decoration only. */}
              <div className="receipt-tear print:hidden" aria-hidden="true" />
            </div>
            <p className="mx-auto mt-3 max-w-[340px] text-center text-xs text-slate-400 print:hidden">
              Pratinjau struk 58mm — yang tercetak hanya kertas struk ini.
            </p>
          </div>
        </div>
      </div>
      <style>{RECEIPT_CSS}</style>
    </div>
  );
}
