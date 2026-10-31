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
//
// v3.3.0 — FOKUS-MOBILE mengikuti arahan desain: halaman ini hampir
// selalu dibuka dari HP pembeli, jadi kartu struk, panel status, dan
// tombol tanda tangan disusun satu kolom selebar jempol; bahasa visual
// mengikuti design system "Indigo & Quiet Surfaces" (overline outlet,
// kartu struk ber-garis tepi, panel status ber-tint semantik). Logika
// dua mode & semua cabang status TIDAK berubah sama sekali.
import type { ReactNode } from "react";
import { headers } from "next/headers";
import {
  CircleCheck,
  Clock,
  ReceiptText,
  ShieldCheck,
  Truck,
  TriangleAlert,
} from "lucide-react";
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

// Ubin merek "U" — sama dengan seluruh shell aplikasi (pembeli yang
// belum pernah melihat UMKM OS tetap mengenali satu merek yang sama).
function BrandTile({ className = "h-8 w-8 text-sm" }: { className?: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-lg bg-primary font-extrabold tracking-tight text-primary-foreground ${className}`}
    >
      U
    </div>
  );
}

// Kepala halaman: merek platform + identitas outlet + judul + kode.
function PageHead({
  outletName,
  title,
  code,
}: {
  outletName: string;
  title: string;
  code: string;
}) {
  return (
    <header>
      <div className="flex items-center gap-2.5">
        <BrandTile />
        <div className="min-w-0">
          <p className="text-sm leading-none font-bold tracking-tight text-slate-900 dark:text-slate-100">
            UMKM OS
          </p>
          <p className="text-overline mt-0.5 text-muted-foreground">
            Struk digital
          </p>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-overline text-muted-foreground">{outletName}</p>
        <h1 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        <p className="mt-1.5 inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs font-semibold tracking-[0.22em] text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {code}
        </p>
      </div>
    </header>
  );
}

// Kartu struk — dibagikan ke dua mode (isi & total selalu tampil agar
// pembeli bisa mencocokkan dengan struk kertas di tangannya).
function StrukCard({ tx }: { tx: PublicReceipt }) {
  return (
    <section className="glass-card mt-4 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-overline text-muted-foreground">Struk resmi</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {dtFmt.format(new Date(tx.created_at))} WIB
        </p>
      </div>

      <ul className="mt-3 space-y-2.5">
        {tx.items.map((it, i) => (
          <li
            key={i}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <span className="min-w-0 text-slate-700 dark:text-slate-300">
              <span className="font-medium">{it.product_name}</span>
              <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
                × {it.qty}
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-400">
              {formatRupiah(it.subtotal)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-baseline justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Total
        </span>
        <span className="text-lg font-bold tracking-tight tabular-nums text-slate-900 dark:text-slate-100">
          {formatRupiah(tx.total)}
        </span>
      </div>
      <p className="mt-1 text-right text-[11px] text-slate-400 dark:text-slate-500">
        Dibayar via {PAYMENT_LABELS[tx.payment_method] ?? tx.payment_method}
      </p>
    </section>
  );
}

// Panel status — permukaan ber-tint semantik (bukan sekadar teks berwarna)
// supaya status terbaca sekali lirik dari saku HP.
const PANEL_EMERALD =
  "rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/40";
const PANEL_RED = "rounded-2xl bg-red-50 p-4 dark:bg-red-950/40";
const PANEL_AMBER = "rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/40";
const PANEL_NETRAL =
  "glass-card rounded-2xl p-4";

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
        <PageHead
          outletName="UMKM OS"
          title="Verifikasi Struk"
          code={code || "—"}
        />
        <section className={`${PANEL_NETRAL} mt-4 text-center`}>
          <TriangleAlert className="mx-auto h-5 w-5 text-warning-strong" />
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {res.status === 0 ? (
              "Sistem verifikasi sedang tidak bisa dijangkau. Muat ulang halaman ini beberapa saat lagi."
            ) : (
              <>
                Kode{" "}
                <span className="font-mono font-bold">{code || "—"}</span>{" "}
                tidak dikenali. Pastikan sama persis dengan yang di struk /
                yang dibacakan kurir.
              </>
            )}
          </p>
        </section>
      </Shell>
    );
  }

  const tx = res.data;

  // ============ MODE "readonly": read-only status viewer ============
  if (tx.mode !== "interactive") {
    const status = tx.handover_status;
    return (
      <Shell>
        <PageHead
          outletName={tx.outlet_name}
          title="Status Pesanan"
          code={tx.receipt_no}
        />

        <StrukCard tx={tx} />

        {tx.status === "REFUNDED" ? (
          <section
            className={`${PANEL_NETRAL} mt-4 flex items-center justify-center gap-2 text-center text-sm font-medium text-slate-600 dark:text-slate-400`}
          >
            <ReceiptText className="h-4 w-4 shrink-0 text-slate-400" />
            Transaksi ini sudah direfund oleh warung.
          </section>
        ) : status === "SERVED" ? (
          <section className={`${PANEL_EMERALD} mt-4`}>
            <p className="flex items-center justify-center gap-2 text-center text-sm font-bold text-emerald-700 dark:text-emerald-300">
              <CircleCheck className="h-5 w-5 shrink-0" />
              Pesanan sudah disajikan
            </p>
            <p className="mt-1.5 text-center text-xs leading-relaxed text-emerald-700/80 dark:text-emerald-300/80">
              {dtFmt.format(
                new Date(tx.handover_confirmed_at ?? tx.created_at),
              )}{" "}
              WIB · dicatat oleh staf saat penyerahan
            </p>
          </section>
        ) : status === "CONFIRMED" ? (
          <section className={`${PANEL_EMERALD} mt-4`}>
            <p className="flex items-center justify-center gap-2 text-center text-sm font-bold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              Pesanan sudah diterima &amp; terverifikasi
            </p>
            <p className="mt-1.5 text-center text-xs text-emerald-700/80 dark:text-emerald-300/80">
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
                className="mx-auto mt-3 rounded-lg border border-emerald-200 bg-white p-1 dark:bg-slate-900"
              />
            )}
          </section>
        ) : status === "DISPUTED" ? (
          <section className={`${PANEL_RED} mt-4`}>
            <p className="flex items-center justify-center gap-2 text-center text-sm font-medium text-red-700 dark:text-red-300">
              <TriangleAlert className="h-5 w-5 shrink-0" />
              Sengketa sedang ditangani warung
            </p>
            <p className="mt-1.5 text-center text-xs leading-relaxed text-red-700/80 dark:text-red-300/80">
              Hubungi kasir dengan membawa struk ini.
            </p>
          </section>
        ) : status === "COURIER_CLAIMED" ? (
          <section className={`${PANEL_AMBER} mt-4`}>
            <p className="flex items-center justify-center gap-2 text-center text-sm font-medium text-amber-800 dark:text-amber-200">
              <Truck className="h-5 w-5 shrink-0" />
              Ditandai sudah diantar oleh kurir.
            </p>
          </section>
        ) : (
          <section className={`${PANEL_NETRAL} mt-4`}>
            <p className="flex items-center justify-center gap-2 text-center text-sm font-medium text-slate-600 dark:text-slate-400">
              <Clock className="h-5 w-5 shrink-0 text-slate-400" />
              Belum ditandai disajikan
            </p>
            <p className="mt-1.5 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Kalau pesananmu belum tiba, tunjukkan struk ini ke kasir.
            </p>
          </section>
        )}

        <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
          Halaman ini hanya menampilkan status pesanan — bukan alat
          konfirmasi. Ada pertanyaan? Hubungi warung langsung.
        </p>
      </Shell>
    );
  }

  // ============ MODE "interactive": kode klaim = kunci ============
  const status = tx.handover_status;
  return (
    <Shell>
      <PageHead
        outletName={tx.outlet_name}
        title="Bukti Serah Terima"
        code={code}
      />

      <StrukCard tx={tx} />

      {tx.status === "REFUNDED" ? (
        <section
          className={`${PANEL_NETRAL} mt-4 flex items-center justify-center gap-2 text-center text-sm font-medium text-slate-600 dark:text-slate-400`}
        >
          <ReceiptText className="h-4 w-4 shrink-0 text-slate-400" />
          Transaksi ini sudah direfund oleh warung.
        </section>
      ) : status === "CONFIRMED" ? (
        <section className={`${PANEL_EMERALD} mt-4`}>
          <p className="flex items-center justify-center gap-2 text-center text-sm font-bold text-emerald-700 dark:text-emerald-300">
            <CircleCheck className="h-5 w-5 shrink-0" />
            Pesanan sudah diterima
          </p>
          <p className="mt-1.5 text-center text-xs text-emerald-700/80 dark:text-emerald-300/80">
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
              className="mx-auto mt-3 rounded-lg border border-emerald-200 bg-white p-1 dark:bg-slate-900"
            />
          )}
          <p className="mt-3 text-center text-[11px] text-emerald-700/70 dark:text-emerald-300/70">
            Simpan link ini — dia bukti milik kamu juga.
          </p>
        </section>
      ) : status === "DISPUTED" ? (
        <section className="mt-4 space-y-3">
          <div className={`${PANEL_RED} flex items-start gap-2 text-sm font-medium text-red-700 dark:text-red-300`}>
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              Pembantahan kamu sudah tercatat permanen dan terlihat di
              daftar serah terima toko.
            </p>
          </div>
          <div className={`${PANEL_NETRAL}`}>
            <p className="mb-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
              Ternyata pesanan SUDAH kamu terima? Konfirmasi di sini:
            </p>
            <BuyerConfirmForm code={code} />
          </div>
        </section>
      ) : status === "SERVED" ? (
        <section className="mt-4 space-y-3">
          <div className={`${PANEL_EMERALD} flex items-start gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300`}>
            <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              Pesanan sudah disajikan{" "}
              {dtFmt.format(new Date(tx.handover_confirmed_at ?? tx.created_at))}{" "}
              WIB
            </p>
          </div>
          <div className={`${PANEL_NETRAL}`}>
            <p className="mb-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
              Ingin menambah tanda tanganmu sebagai bukti penerimaan?
            </p>
            <BuyerConfirmForm code={code} />
          </div>
        </section>
      ) : status === "COURIER_CLAIMED" ? (
        <section className="mt-4 space-y-3">
          <div className={`${PANEL_AMBER} flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200`}>
            <Truck className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              Kurir sudah menandai pesanan ini{" "}
              <b className="font-bold">selesai diantar</b>. Apakah sudah kamu
              terima dengan lengkap?
            </p>
          </div>
          <div className={`${PANEL_NETRAL}`}>
            <BuyerConfirmForm code={code} />
            <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
              <BuyerDisputeButton code={code} />
            </div>
          </div>
        </section>
      ) : (
        <section className={`${PANEL_NETRAL} mt-4`}>
          <p className="mb-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
            Sudah menerima pesanan ini? Tanda tangan di bawah sebagai bukti:
          </p>
          <BuyerConfirmForm code={code} />
        </section>
      )}

      <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
        Kode klaim ini milikmu — jangan bagikan ke orang lain. Halaman ini
        bukti serah terima resmi dari warung.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  // Latar bersama seluruh aplikasi (tenang, dua tema) — halaman pembeli
  // ikut tema terakhir mesin pembeli (cermin anonim).
  return (
    <main className="relative min-h-dvh bg-slate-100 font-sans text-slate-900 antialiased selection:bg-primary/20 dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />
      <div className="relative z-10 mx-auto w-full max-w-md px-4 py-6 pb-16 sm:px-5">
        {children}
      </div>
    </main>
  );
}
