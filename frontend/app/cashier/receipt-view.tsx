// frontend/app/cashier/receipt-view.tsx
"use client";

// Layar sukses struk kasir (v1.3.0 → v3.3.0 FOKUS-MOBILE).
//
// v3.3.0 — mengikuti arahan desain "prioritize task flows on mobile":
//   - HP: kertas struk tampil PALING ATAS (bukti yang pegang kasir lihat
//     dulu), lalu ringkasan angka; bilah aksi MELEKAT di dasar layar
//     (Cetak / WhatsApp / Transaksi Baru) supaya selalu terjangkau jempol
//     tanpa gulir.
//   - Desktop: kembali dua kolom (ringkasan+aksi kiri, kertas kanan yang
//     melekat saat menggulir).
//   - Kertas struk fisik TIDAK berubah satu bit: tetap putih di kedua
//     tema, 58mm saat dicetak, hanya #struk-paper yang keluar di kertas
//     (aturan cetak v1.9.0 dijaga tests/theme-consistency.test.ts).
//
// LOGIKA TIDAK BERUBAH: cetak via window.print(), struk digital via
// wa.me (tanpa nomor tersimpan), kode klaim, dan penandaan "sudah
// diserahkan" tetap satu ketukan ke POST /transactions/{id}/serve.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  Check,
  Loader2,
  MessageCircle,
  Printer,
  RotateCcw,
} from "lucide-react";
import { AuroraBackground } from "@/components/aurora-background";
import type { OutletInfo, Receipt as ReceiptType } from "./types";
import { formatRupiah } from "@/lib/format";
import { markServed } from "@/app/owner/verify/actions";
import { buildReceiptMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

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
// prints. The 48mm width fits the print head of common 58mm thermal
// printers and centers neatly on A4. This stylesheet is unlayered,
// which means it wins over Tailwind utilities without !important.
const RECEIPT_CSS = `
/* Solid cash-register rules — long clean black lines, no dashes. */
.receipt-rule {
  border-top: 1px solid #000;
  margin: 7px 0;
}
.receipt-rule-strong {
  border-top: 2px solid #000;
  margin: 7px 0 4px;
}
/* Screen only: perforated bottom edge of the paper. */
.receipt-tear {
  height: 10px;
  background-image: radial-gradient(circle at 5px 10px, transparent 4px, #fff 4.5px);
  background-size: 10px 10px;
  background-position: bottom;
  background-repeat: repeat-x;
}
/* The QR svg always fills its wrapper (84px on screen, 19mm on paper). */
#struk-paper svg {
  width: 100%;
  height: auto;
  display: block;
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
  /* The UMKM logo keeps its original colors on paper; thermal mono
     printers dither it automatically. */
  #struk-paper img {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;

function Rule({ strong = false }: { strong?: boolean }) {
  return (
    <div
      role="presentation"
      className={strong ? "receipt-rule-strong" : "receipt-rule"}
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
  const router = useRouter();
  const createdAt = dateFmt.format(new Date(receipt.createdAt));

  // Eceran serah-langsung (v1.3.0): one tap POSTs /transactions/{id}/serve
  // on backend-go so this receipt never lingers in the serve queue. The
  // handover_events + audit writes are Go's job — this UI is strictly
  // best-effort.
  const [served, setServed] = useState(false);
  const [serveError, setServeError] = useState<string | null>(null);
  const [servePending, startServeTransition] = useTransition();

  function submitServed() {
    setServeError(null);
    startServeTransition(async () => {
      const res = await markServed({ transactionId: receipt.transactionId });
      if (res.ok) {
        setServed(true);
        router.refresh();
      } else {
        setServeError(res.error);
      }
    });
  }

  // v2.4.0 — struk digital via wa.me: pesan terformat penuh (outlet,
  // item, total, tautan verifikasi) dibangun di sisi klien TANPA nomor
  // tujuan — pembeli dipilih DI WHATSAPP, aplikasi tidak pernah
  // menyimpan nomor pembeli.
  function kirimWhatsapp() {
    const pesan = buildReceiptMessage(
      receipt,
      outlet,
      receipt.claimCode
        ? `${window.location.origin}/verify/${receipt.claimCode}`
        : undefined,
    );
    window.open(buildWhatsAppUrl(pesan), "_blank", "noopener");
  }

  return (
    // Latar tenang dua tema (v3.1.0). Saat mencetak, seluruh chrome
    // disembunyikan (print:hidden) dan hanya #struk-paper yang keluar
    // di atas kertas putih polos.
    <div className="relative min-h-dvh bg-slate-100 dark:bg-slate-950 print:bg-white">
      <AuroraBackground />
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8 lg:px-8 print:block print:p-0">
        {/* Kepala sukses — overline + SATU judul + deskripsi (pola PDF). */}
        <div className="flex items-center gap-4 print:hidden">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 sm:h-14 sm:w-14 dark:bg-emerald-500/15">
            <Check
              className="h-6 w-6 text-emerald-600 sm:h-7 sm:w-7 dark:text-emerald-400"
              strokeWidth={2.5}
            />
          </div>
          <div className="min-w-0">
            <p className="text-overline text-muted-foreground">
              Kasir · transaksi selesai
            </p>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">
              Transaksi Berhasil
            </h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Struk siap dicetak — periksa sekali lagi sebelum menutup
              halaman ini.
            </p>
          </div>
        </div>

        {/* HP: kertas struk dulu (bukti di tangan), baru ringkasan.
            Desktop: ringkasan kiri, kertas kanan yang melekat. */}
        <div className="mt-6 flex flex-col gap-6 lg:mt-8 lg:grid lg:grid-cols-[1fr_340px] lg:items-start lg:gap-8 print:mt-0 print:block">
          {/* Kertas struk — satu-satunya yang tercetak. */}
          <div className="order-1 lg:order-2 lg:sticky lg:top-8 print:static">
            <div
              id="struk-paper"
              // Kertas struk = thermal fisik: TETAP PUTIH meski aplikasi
              // sedang tema gelap (v1.8.0) — persis kertas di tangan pembeli.
              className="relative mx-auto w-full max-w-[340px] bg-white font-mono text-[11px] leading-relaxed text-slate-900 shadow-xl print:bg-white print:shadow-none dark:shadow-black/40"
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

                <Rule />
                <div className="flex justify-between text-[10px]">
                  <span>No.</span>
                  <span className="break-all">{receipt.code}</span>
                </div>
                <div className="mt-0.5 flex justify-between text-[10px]">
                  <span>Tgl.</span>
                  <span>{createdAt} WIB</span>
                </div>

                <Rule />
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

                <Rule />
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
                </div>

                <Rule strong />
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide">
                    Total
                  </span>
                  <span className="text-[13px] font-extrabold tabular-nums">
                    {formatRupiah(receipt.total)}
                  </span>
                </div>
                <div className="mt-1 space-y-0.5 text-[10px]">
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

                <Rule />
                {receipt.qrSvg && (
                  <div className="flex flex-col items-center">
                    {/* Server-rendered QR (v1.3.0): when a claim code exists
                        it encodes the INTERACTIVE buyer page — one scan and
                        the takeaway buyer can confirm/dispute from their
                        phone. QR dan kode klaim tercetak di kertas yang
                        sama, jadi tingkat rahasianya identik. Legacy receipts
                        without a claim code fall back to the read-only
                        status page keyed by the receipt number (an address,
                        not a secret). */}
                    <div
                      className="w-[84px] print:w-[19mm]"
                      dangerouslySetInnerHTML={{ __html: receipt.qrSvg }}
                    />
                    <p className="mt-1 text-[9px]">
                      {receipt.claimCode
                        ? "Scan utk cek/konfirmasi pesanan"
                        : "Scan utk cek status pesanan"}
                    </p>
                  </div>
                )}
                {receipt.claimCode && (
                  <div className="mt-2 text-center">
                    {/* Fallback when the QR will not scan: the code is safe
                        to read aloud over the phone — its alphabet has no
                        ambiguous characters (no 0/O/1/I). Bigger than body
                        text so it survives small thermal prints. */}
                    <p className="text-[9px] font-bold uppercase tracking-[0.25em]">
                      Kode klaim
                    </p>
                    <p className="mt-1 text-[14px] font-extrabold leading-none tracking-[0.3em]">
                      {receipt.claimCode}
                    </p>
                    <p className="mt-1 text-[9px] leading-snug">
                      Simpan sebagai bukti penerimaan pesanan
                    </p>
                  </div>
                )}
                <Rule />
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
            <p className="mx-auto mt-3 max-w-[340px] text-center text-xs text-slate-400 dark:text-slate-500 print:hidden">
              Pratinjau struk 58mm — yang tercetak hanya kertas struk ini.
            </p>
          </div>

          {/* Ringkasan + aksi — tidak pernah ikut tercetak. */}
          <section className="order-2 space-y-6 lg:order-1 print:hidden">
            <dl className="glass-card divide-y divide-slate-100 rounded-2xl dark:divide-white/10">
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <dt className="text-sm text-slate-500 dark:text-slate-400">
                  Kode struk
                </dt>
                <dd className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {receipt.code}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <dt className="text-sm text-slate-500 dark:text-slate-400">
                  Waktu
                </dt>
                <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {createdAt} WIB
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <dt className="text-sm text-slate-500 dark:text-slate-400">
                  Metode pembayaran
                </dt>
                <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {PAYMENT_LABELS[receipt.paymentMethod]}
                </dd>
              </div>
              {/* v1.3.0: kode klaim = kunci interaktif pembeli. Ditampilkan
                  di layar sukses supaya kasir bisa membacakannya saat pembeli
                  takeaway menelepon tanpa membawa struk. */}
              {receipt.claimCode && (
                <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <dt className="text-sm text-slate-500 dark:text-slate-400">
                    Kode klaim
                  </dt>
                  <dd className="font-mono text-sm font-bold tracking-widest text-slate-900 dark:text-slate-100">
                    {receipt.claimCode}
                  </dd>
                </div>
              )}
            </dl>

            <div className="glass-card space-y-3 rounded-2xl p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  Subtotal
                </span>
                <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
                  {formatRupiah(receipt.subtotal)}
                </span>
              </div>
              {receipt.discount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">
                    Diskon
                  </span>
                  <span className="font-medium tabular-nums text-rose-600">
                    -{formatRupiah(receipt.discount)}
                  </span>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-slate-100 pt-3 dark:border-slate-800/60">
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Total
                </span>
                <span className="text-2xl font-extrabold tracking-tight tabular-nums text-slate-900 dark:text-slate-100">
                  {formatRupiah(receipt.total)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  Dibayar ({PAYMENT_LABELS[receipt.paymentMethod]})
                </span>
                <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
                  {formatRupiah(receipt.paidAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  Kembalian
                </span>
                <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatRupiah(receipt.changeAmount)}
                </span>
              </div>
            </div>

            <div className="glass-card rounded-xl px-3 py-2.5 text-xs text-slate-600 dark:text-slate-400">
              <p className="font-bold text-slate-800 dark:text-slate-200">
                Serah terima pesanan
              </p>
              <p className="mt-0.5 leading-relaxed">
                Makan di tempat / eceran: tandai sekarang supaya tidak
                menggantung di Antrean Penyajian kasir.
                {receipt.claimCode
                  ? " Takeaway / diantar: serahkan saja struknya — pembeli mengonfirmasi sendiri dari HP lewat QR dan kode klaim yang tercetak."
                  : ""}
              </p>
              {served ? (
                <p className="mt-2 rounded-lg bg-emerald-100 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                  Tercatat disajikan — terima kasih!
                </p>
              ) : (
                <button
                  type="button"
                  onClick={submitServed}
                  disabled={servePending}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-950/40 dark:text-blue-300"
                >
                  {servePending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  {servePending ? "Menyimpan…" : "Sudah Diserahkan ke Pembeli"}
                </button>
              )}
              {serveError && (
                <p className="mt-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                  {serveError}
                </p>
              )}
            </div>

            {/* Aksi penuh (desktop) — di HP memakai bilah melekat di dasar
                layar supaya terjangkau jempol tanpa gulir. */}
            <div className="hidden flex-col gap-3 sm:flex-row lg:flex">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
              >
                <Printer className="h-4 w-4" />
                Cetak Struk
              </button>
              <button
                type="button"
                onClick={kirimWhatsapp}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 dark:border-emerald-500/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
              >
                <MessageCircle className="h-4 w-4" />
                Kirim via WhatsApp
              </button>
              <button
                type="button"
                onClick={onNewTransaction}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60"
              >
                <RotateCcw className="h-4 w-4" />
                Transaksi Baru
              </button>
            </div>

            <Link
              href="/"
              className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke beranda
            </Link>
          </section>
        </div>
      </div>

      {/* Bilah aksi melekat (HP) — Cetak selalu terjangkau jempol.
          Desktop memakai deretan tombol penuh di kolom kiri. */}
      <div className="sticky bottom-0 z-30 mt-6 border-t border-slate-200 bg-white px-4 py-3 lg:hidden print:hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
          >
            <Printer className="h-4 w-4" />
            Cetak Struk
          </button>
          <button
            type="button"
            onClick={kirimWhatsapp}
            aria-label="Kirim via WhatsApp"
            title="Kirim via WhatsApp"
            className="flex items-center justify-center rounded-xl border border-emerald-500 bg-emerald-50 px-4 py-3 text-emerald-700 shadow-sm transition hover:bg-emerald-100 dark:border-emerald-500/60 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onNewTransaction}
            aria-label="Transaksi Baru"
            title="Transaksi Baru"
            className="flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <style>{RECEIPT_CSS}</style>
    </div>
  );
}
