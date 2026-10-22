// Detail SATU transaksi — dibuka kurir dari perangkat LOGIN.
// Kode & QR selalu ada di sini: kurir gak perlu ingat apa pun.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/format";
import { buildVerifyUrl } from "@/lib/handover";
import { ClaimDeliveredButton, ConfirmInAppForm, CopyButton } from "./client";

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

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  CONFIRMED: { label: "Terverifikasi", cls: "bg-emerald-100 text-emerald-800" },
  COURIER_CLAIMED: { label: "Klaim Kurir", cls: "bg-amber-100 text-amber-800" },
  DISPUTED: { label: "Dibantah Pembeli!", cls: "bg-red-100 text-red-800" },
};

const KIND_LABEL: Record<string, string> = {
  BUYER_CONFIRM: "Konfirmasi pembeli",
  COURIER_CLAIM: "Klaim kurir",
  BUYER_DISPUTE: "Pembantahan pembeli",
};

export default async function VerifyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user || (user.role !== "OWNER" && user.role !== "KASIR")) redirect("/");

  const { id } = await params;
  const tx = await prisma.transaction.findUnique({
    where: { id },
    include: {
      outlet: { select: { name: true } },
      items: { include: { product: { select: { name: true } } } },
      handoverEvents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!tx || !tx.claimCode) notFound();
  // Kasir outlet lain tidak boleh melihat transaksi ini.
  if (user.outletId && tx.outletId !== user.outletId) notFound();

  const code = tx.claimCode;
  const verifyUrl = buildVerifyUrl(code);
  const qrSvg = await QRCode.toString(verifyUrl, {
    type: "svg",
    errorCorrectionLevel: "M",
    width: 180,
  });

  const status = tx.handoverStatus;
  const st = status ? STATUS_STYLE[status] : null;
  const confirmEvent = tx.handoverEvents.find(
    (e) => e.kind === "BUYER_CONFIRM",
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-slate-50 p-4 pb-16">
      <div className="mb-3 flex items-center justify-between">
        <Link href="/owner/verify" className="text-sm text-slate-500">
          ← Daftar
        </Link>
        <p className="text-sm font-semibold text-slate-700">
          Bukti Serah Terima
        </p>
        <span className="w-10" />
      </div>

      {/* Ringkasan transaksi */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-slate-500">
              {dtFmt.format(tx.createdAt)} WIB
            </p>
            <p className="text-lg font-bold text-slate-800">
              {formatRupiah(Number(tx.total))}
            </p>
            <p className="text-xs text-slate-500">
              {tx.items.length} item ·{" "}
              {PAYMENT_LABELS[tx.paymentMethod] ?? tx.paymentMethod}
            </p>
          </div>
          {st && (
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${st.cls}`}
            >
              {st.label}
            </span>
          )}
        </div>
        <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3">
          {tx.items.map((it, i) => (
            <li key={i} className="flex justify-between text-xs text-slate-600">
              <span>
                {it.product.name} × {it.quantity}
              </span>
              <span>{formatRupiah(Number(it.priceAtSale) * it.quantity)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Kode + QR — selalu tersedia, inilah obat lupa kode */}
      <section className="mt-3 rounded-2xl bg-white p-4 text-center shadow-sm">
        <p className="text-xs font-medium text-slate-500">Kode verifikasi</p>
        <p className="mt-1 font-mono text-3xl font-bold tracking-[0.25em] text-slate-900">
          {code}
        </p>
        <div className="mt-3 flex justify-center">
          <div
            className="w-44 [&_svg]:h-full [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Minta pembeli scan QR ini dengan HP-nya, atau bacakan kodenya.
        </p>
        <div className="mt-2 flex justify-center gap-2">
          <CopyButton text={code} label="Salin kode" />
          <CopyButton text={verifyUrl} label="Salin link" />
        </div>
      </section>

      {/* Aksi */}
      <section className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
        {status === "CONFIRMED" ? (
          <div className="space-y-3 text-center">
            <p className="text-sm font-semibold text-emerald-700">
              ✔ Terverifikasi{" "}
              {dtFmt.format(tx.handoverConfirmedAt ?? tx.createdAt)} WIB
            </p>
            {confirmEvent?.signatureData && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={confirmEvent.signatureData}
                alt="Tanda tangan pembeli"
                className="mx-auto rounded-lg border border-slate-200 bg-white"
              />
            )}
            <p className="text-[11px] text-slate-500">
              Metode:{" "}
              {confirmEvent?.method === "PUBLIC" ? "HP pembeli" : "layar kurir"}
              {confirmEvent?.buyerName
                ? ` · a.n. ${confirmEvent.buyerName}`
                : ""}
            </p>
          </div>
        ) : status === "DISPUTED" ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
              Pembeli membantah menerima pesanan ini. Kalau ternyata sudah
              diterima, minta pembeli tanda tangan di bawah (atau konfirmasi
              lewat QR/link di atas).
            </p>
            <ConfirmInAppForm transactionId={tx.id} />
          </div>
        ) : status === "COURIER_CLAIMED" ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Sudah diklaim kurir tanpa tanda tangan. Kalau pembeli sekarang ada
              di depan kamu, minta dia tanda tangan di bawah untuk bukti kuat.
            </p>
            <ConfirmInAppForm transactionId={tx.id} />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">
                Konfirmasi di layar ini (bukti terkuat)
              </p>
              <ConfirmInAppForm transactionId={tx.id} />
            </div>
            <div className="border-t border-slate-100 pt-3">
              <p className="mb-2 text-xs font-medium text-slate-500">
                Pembeli tidak bisa tanda tangan?
              </p>
              <ClaimDeliveredButton transactionId={tx.id} />
            </div>
          </div>
        )}
      </section>

      {/* Jejak audit — gak bisa dihapus, gak bisa dimanipulasi */}
      <section className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-semibold text-slate-800">
          Jejak kejadian
        </p>
        <ol className="space-y-2">
          {tx.handoverEvents.map((e) => (
            <li key={e.id} className="flex gap-2 text-xs">
              <span className="shrink-0 font-mono text-slate-400">
                {dtFmt.format(e.createdAt)}
              </span>
              <span className="text-slate-700">
                {KIND_LABEL[e.kind] ?? e.kind}
                {e.actorRole ? ` · ${e.actorRole}` : ""}
                {e.note ? ` — "${e.note}"` : ""}
              </span>
            </li>
          ))}
          {tx.handoverEvents.length === 0 && (
            <li className="text-xs text-slate-400">Belum ada aktivitas.</li>
          )}
        </ol>
      </section>
    </main>
  );
}
