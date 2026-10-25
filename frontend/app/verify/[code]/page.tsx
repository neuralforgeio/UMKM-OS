// HALAMAN PUBLIK (tanpa login) — dibuka pembeli dari QR / link di struk.
// Sumber data: GET /api/v1/public/receipt/{code} (backend-go v1.3.0).
// Dua mode, diputuskan oleh backend:
// 1. MODE "readonly" (v3, dine-in): /verify/TRX-… — nomor struk hanyalah
//    ALAMAT. Halaman READ-ONLY: pembeli hanya melihat status
//    penyajian/verifikasi. Tidak ada tombol konfirmasi/bantahan —
//    pembeli tidak memegang kunci apa pun; sengketa diselesaikan
//    langsung di warung dengan jejak handover_events.
// 2. MODE "interactive" (v2 / struk takeaway): /verify/KODE8 — kode
//    klaim 8 karakter adalah kunci interaktif (tanda tangan / bantah),
//    dicetak di struk sebagai "Kode klaim".
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { goPublic } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { AuroraBackground } from "@/components/aurora-background";
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

// Bentuk respons GET /public/receipt/{code} (handover.go PublicReceipt).
type PublicReceipt = {
  mode: "readonly" | "interactive";
  receipt_no: string;
  claim_code: string | null;
  outlet_name: string;
  created_at: string;
  items: {
    product_name: string;
    qty: number;
    price: number;
    subtotal: number;
  }[];
  total: number;
  payment_method: string;
  status: string;
  handover_status: string | null;
  handover_confirmed_at: string | null;
  confirmed_by_name: string | null;
  confirm_method: string | null;
  buyer_name: string | null;
  signature_data: string | null;
};

export default async function PublicVerifyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw).trim().toUpperCase();

  // cacheComponents: menyentuh headers() menandai halaman ini dinamis
  // (render per-request) — status harus selalu segar di HP pembeli,
  // bukan hasil cache basi.
  await headers();

  const res = await goPublic<PublicReceipt>(
    `/public/receipt/${encodeURIComponent(code)}`,
  );

  if (!res.ok) {
    // status 0 = backend-go tidak terjangkau — berbeda dari kode salah.
    return (
      <Shell>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          {res.status === 0 ? (
            "Sistem verifikasi sedang tidak bisa dijangkau. Muat ulang halaman ini beberapa saat lagi."
          ) : (
            <>
              Kode <span className="font-mono font-bold">{code || "—"}</span>{" "}
              tidak dikenali. Pastikan sama persis dengan yang di struk / yang
              dibacakan kurir.
            </>
          )}
        </p>
      </Shell>
    );
  }

  const tx = res.data;

  // ============ MODE "readonly": read-only status viewer ============
  if (tx.mode !== "interactive") {
    const status = tx.handover_status;
    return (
      <Shell>
        <header className="text-center">
          <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {tx.outlet_name}
          </p>
          <h1 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
            Status Pesanan
          </h1>
          <p className="font-mono text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
            {tx.receipt_no}
          </p>
        </header>

        <section className="mt-4 rounded-2xl glass-card p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {dtFmt.format(new Date(tx.created_at))} WIB
          </p>
          <ul className="mt-2 space-y-1">
            {tx.items.map((it, i) => (
              <li
                key={i}
                className="flex justify-between text-sm text-slate-700 dark:text-slate-300"
              >
                <span>
                  {it.product_name} × {it.qty}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {formatRupiah(it.subtotal)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-3">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total</span>
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {formatRupiah(tx.total)}
            </span>
          </div>
          <p className="mt-1 text-right text-[11px] text-slate-400 dark:text-slate-500">
            Dibayar via {PAYMENT_LABELS[tx.payment_method] ?? tx.payment_method}
          </p>
        </section>

        {tx.status === "REFUNDED" ? (
          <section className="mt-4 rounded-2xl bg-slate-100 dark:bg-slate-900 p-4 text-center text-sm font-medium text-slate-600 dark:text-slate-400 shadow-sm">
            Transaksi ini sudah direfund oleh warung.
          </section>
        ) : status === "SERVED" ? (
          <section className="mt-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-4 text-center shadow-sm">
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              ✔ Pesanan sudah disajikan
            </p>
            <p className="mt-1 text-xs text-emerald-700/80">
              {dtFmt.format(
                new Date(tx.handover_confirmed_at ?? tx.created_at),
              )}{" "}
              WIB · dicatat oleh staf saat penyerahan
            </p>
          </section>
        ) : status === "CONFIRMED" ? (
          <section className="mt-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-4 text-center shadow-sm">
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              ✔ Pesanan sudah diterima &amp; terverifikasi
            </p>
            <p className="mt-1 text-xs text-emerald-700/80">
              {dtFmt.format(
                new Date(tx.handover_confirmed_at ?? tx.created_at),
              )}{" "}
              WIB
            </p>
            {tx.signature_data && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={tx.signature_data}
                alt="Tanda tangan penerima"
                className="mx-auto mt-3 rounded-lg border border-emerald-200 bg-white dark:bg-slate-900"
              />
            )}
          </section>
        ) : status === "DISPUTED" ? (
          <section className="mt-4 rounded-2xl bg-red-50 dark:bg-red-950/40 p-4 text-center text-sm font-medium text-red-700 dark:text-red-300 shadow-sm">
            Sengketa sedang ditangani warung. Hubungi kasir dengan membawa struk
            ini.
          </section>
        ) : status === "COURIER_CLAIMED" ? (
          <section className="mt-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-4 text-center text-sm font-medium text-amber-800 dark:text-amber-200 shadow-sm">
            Ditandai sudah diantar oleh kurir.
          </section>
        ) : (
          <section className="mt-4 rounded-2xl glass-card p-4 text-center text-sm text-slate-600 dark:text-slate-400">
            Belum ditandai disajikan. Kalau pesananmu belum tiba, tunjukkan
            struk ini ke kasir.
          </section>
        )}

        <p className="mt-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
          Halaman ini hanya menampilkan status pesanan — bukan alat konfirmasi.
          Ada pertanyaan? Hubungi warung langsung.
        </p>
      </Shell>
    );
  }

  // ============ MODE "interactive": kode klaim = kunci ============
  const status = tx.handover_status;
  return (
    <Shell>
      <header className="text-center">
        <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {tx.outlet_name}
        </p>
        <h1 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
          Bukti Serah Terima
        </h1>
        <p className="font-mono text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
          {code}
        </p>
      </header>

      <section className="mt-4 rounded-2xl glass-card p-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {dtFmt.format(new Date(tx.created_at))} WIB
        </p>
        <ul className="mt-2 space-y-1">
          {tx.items.map((it, i) => (
            <li key={i} className="flex justify-between text-sm text-slate-700 dark:text-slate-300">
              <span>
                {it.product_name} × {it.qty}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {formatRupiah(it.subtotal)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-3">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total</span>
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {formatRupiah(tx.total)}
          </span>
        </div>
        <p className="mt-1 text-right text-[11px] text-slate-400 dark:text-slate-500">
          Dibayar via {PAYMENT_LABELS[tx.payment_method] ?? tx.payment_method}
        </p>
      </section>

      {tx.status === "REFUNDED" ? (
        <section className="mt-4 rounded-2xl bg-slate-100 dark:bg-slate-900 p-4 text-center text-sm font-medium text-slate-600 dark:text-slate-400 shadow-sm">
          Transaksi ini sudah direfund oleh warung.
        </section>
      ) : status === "CONFIRMED" ? (
        <section className="mt-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-4 text-center shadow-sm">
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
            ✔ Pesanan sudah diterima
          </p>
          <p className="mt-1 text-xs text-emerald-700/80">
            Terverifikasi{" "}
            {dtFmt.format(new Date(tx.handover_confirmed_at ?? tx.created_at))}{" "}
            WIB ·{" "}
            {tx.confirm_method === "PUBLIC"
              ? "dari HP pembeli"
              : "di layar kurir"}
          </p>
          {tx.signature_data && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={tx.signature_data}
              alt="Tanda tangan"
              className="mx-auto mt-3 rounded-lg border border-emerald-200 bg-white dark:bg-slate-900"
            />
          )}
          <p className="mt-3 text-[11px] text-emerald-700/70">
            Simpan link ini — dia bukti milik kamu juga.
          </p>
        </section>
      ) : status === "DISPUTED" ? (
        <section className="mt-4 space-y-3">
          <div className="rounded-2xl bg-red-50 dark:bg-red-950/40 p-4 text-sm font-medium text-red-700 dark:text-red-300">
            Pembantahan kamu sudah tercatat permanen dan terlihat di daftar
            serah terima toko.
          </div>
          <div className="rounded-2xl glass-card p-4">
            <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              Ternyata pesanan SUDAH kamu terima? Konfirmasi di sini:
            </p>
            <BuyerConfirmForm code={code} />
          </div>
        </section>
      ) : status === "SERVED" ? (
        <section className="mt-4 space-y-3">
          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-4 text-sm font-bold text-emerald-700 dark:text-emerald-300">
            ✔ Pesanan sudah disajikan{" "}
            {dtFmt.format(new Date(tx.handover_confirmed_at ?? tx.created_at))}{" "}
            WIB
          </div>
          <div className="rounded-2xl glass-card p-4">
            <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              Ingin menambah tanda tanganmu sebagai bukti penerimaan?
            </p>
            <BuyerConfirmForm code={code} />
          </div>
        </section>
      ) : status === "COURIER_CLAIMED" ? (
        <section className="mt-4 space-y-3">
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-800 dark:text-amber-200">
            Kurir sudah menandai pesanan ini <b>selesai diantar</b>. Apakah
            sudah kamu terima dengan lengkap?
          </div>
          <div className="rounded-2xl glass-card p-4">
            <BuyerConfirmForm code={code} />
            <div className="mt-3 border-t border-slate-100 dark:border-slate-800/60 pt-3">
              <BuyerDisputeButton code={code} />
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-4 rounded-2xl glass-card p-4">
          <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            Sudah menerima pesanan ini? Tanda tangan di bawah sebagai bukti:
          </p>
          <BuyerConfirmForm code={code} />
        </section>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  // Shell aurora (v1.8.0): halaman publik pembeli ikut tema terakhir
  // mesin pembeli (cermin anonim) — kartu memakai kaca.
  return (
    <main className="relative mx-auto min-h-screen w-full max-w-md bg-slate-50 p-4 pb-16 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />
      <div className="relative z-10">{children}</div>
    </main>
  );
}