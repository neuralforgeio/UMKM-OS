// HALAMAN PUBLIK (tanpa login) — dibuka pembeli dari QR / link /
// kode yang dibacakan kurir. Kode = kuncinya. Link ini juga BUKTI milik
// pembeli: bisa dibuka lagi kapan pun dari riwayat browser/HP.
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/format";
import { BuyerConfirmForm, BuyerDisputeButton } from "./client";

export const instant = false;

const dtFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  dateStyle: "medium",
  timeStyle: "short",
});

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  DEBIT: "Debit",
};

export default async function PublicVerifyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw).trim().toUpperCase();

  // cacheComponents: menyentuh headers() menandai halaman ini dinamis
  // (render per-request) — status verifikasi harus selalu segar di HP
  // pembeli, bukan hasil cache basi.
  await headers();

  const tx = await prisma.transaction.findUnique({
    where: { claimCode: code },
    include: {
      outlet: { select: { name: true } },
      items: { include: { product: { select: { name: true } } } },
      handoverEvents: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!tx) {
    return (
      <Shell>
        <p className="text-center text-sm text-slate-500">
          Kode <span className="font-mono font-bold">{code || "—"}</span> tidak
          dikenali. Pastikan sama persis dengan yang di struk / yang dibacakan
          kurir.
        </p>
      </Shell>
    );
  }

  const status = tx.handoverStatus;
  const confirmEvent = tx.handoverEvents.find(
    (e) => e.kind === "BUYER_CONFIRM",
  );

  return (
    <Shell>
      <header className="text-center">
        <p className="text-xs uppercase tracking-widest text-slate-400">
          {tx.outlet.name}
        </p>
        <h1 className="mt-1 text-lg font-bold text-slate-900">
          Bukti Serah Terima
        </h1>
        <p className="font-mono text-xs tracking-[0.3em] text-slate-400">
          {code}
        </p>
      </header>

      {/* Apa yang sedang dikonfirmasi — transparan buat pembeli */}
      <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-xs text-slate-500">
          {dtFmt.format(tx.createdAt)} WIB
        </p>
        <ul className="mt-2 space-y-1">
          {tx.items.map((it, i) => (
            <li key={i} className="flex justify-between text-sm text-slate-700">
              <span>
                {it.product.name} × {it.quantity}
              </span>
              <span className="text-slate-500">
                {formatRupiah(Number(it.priceAtSale) * it.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-sm font-semibold text-slate-700">Total</span>
          <span className="text-lg font-bold text-slate-900">
            {formatRupiah(Number(tx.total))}
          </span>
        </div>
        <p className="mt-1 text-right text-[11px] text-slate-400">
          Dibayar via {PAYMENT_LABELS[tx.paymentMethod] ?? tx.paymentMethod}
        </p>
      </section>

      {status === "CONFIRMED" ? (
        <section className="mt-4 rounded-2xl bg-emerald-50 p-4 text-center shadow-sm">
          <p className="text-sm font-bold text-emerald-700">
            ✔ Pesanan sudah diterima
          </p>
          <p className="mt-1 text-xs text-emerald-700/80">
            Terverifikasi {dtFmt.format(tx.handoverConfirmedAt ?? tx.createdAt)}{" "}
            WIB ·{" "}
            {confirmEvent?.method === "PUBLIC"
              ? "dari HP pembeli"
              : "di layar kurir"}
          </p>
          {confirmEvent?.signatureData && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={confirmEvent.signatureData}
              alt="Tanda tangan"
              className="mx-auto mt-3 rounded-lg border border-emerald-200 bg-white"
            />
          )}
          <p className="mt-3 text-[11px] text-emerald-700/70">
            Simpan link ini — dia bukti milik kamu juga.
          </p>
        </section>
      ) : status === "DISPUTED" ? (
        <section className="mt-4 space-y-3">
          <div className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">
            Pembantahan kamu sudah tercatat permanen dan terlihat di daftar
            serah terima toko.
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="mb-2 text-sm font-semibold text-slate-800">
              Ternyata pesanan SUDAH kamu terima? Konfirmasi di sini:
            </p>
            <BuyerConfirmForm code={code} />
          </div>
        </section>
      ) : status === "COURIER_CLAIMED" ? (
        <section className="mt-4 space-y-3">
          <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
            Kurir sudah menandai pesanan ini <b>selesai diantar</b>. Apakah
            sudah kamu terima dengan lengkap?
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <BuyerConfirmForm code={code} />
            <div className="mt-3 border-t border-slate-100 pt-3">
              <BuyerDisputeButton code={code} />
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-slate-800">
            Sudah menerima pesanan ini? Tanda tangan di bawah sebagai bukti:
          </p>
          <BuyerConfirmForm code={code} />
        </section>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-slate-50 p-4 pb-16">
      {children}
    </main>
  );
}
