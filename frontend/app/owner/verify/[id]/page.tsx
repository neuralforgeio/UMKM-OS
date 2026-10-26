// Detail SATU transaksi — dibuka staf dari perangkat LOGIN.
// v3: jalur utama dine-in = tombol "Sudah Disajikan" (satu arah,
// berjejak); tanda tangan pembeli tetap tersedia sebagai bukti kuat
// untuk takeaway/online. Kode & QR selalu ada di sini untuk itu.
// v2.1.0: data dari GET /transactions/{id} backend-go (ringkasan + item
// + jejak serah terima). Scope outlet ditegakkan Go di SQL — kasir
// outlet lain otomatis mendapat 404 -> halaman ini ikut notFound().
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { buildVerifyUrl } from "@/lib/handover";
import { AuroraBackground } from "@/components/aurora-background";
import { UserMenu } from "@/components/user-menu";
import { userMenuUser } from "@/lib/session-user";
import { ServeButton } from "@/components/serve-queue";
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
  SERVED: { label: "Disajikan", cls: "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300" },
  CONFIRMED: { label: "Terverifikasi", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
  COURIER_CLAIMED: { label: "Klaim Kurir", cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200" },
  DISPUTED: { label: "Dibantah Pembeli!", cls: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300" },
};

const KIND_LABEL: Record<string, string> = {
  STAFF_SERVE: "Disajikan staf",
  BUYER_CONFIRM: "Konfirmasi pembeli",
  COURIER_CLAIM: "Klaim kurir",
  BUYER_DISPUTE: "Pembantahan pembeli",
};

// Bentuk respons GET /transactions/{id} (backend-go).
type GoDetailResponse = {
  transaction: {
    id: number;
    receipt_no: string;
    created_at: string;
    total: number;
    payment_method: string;
    status: string;
    claim_code: string | null;
    handover_status: string | null;
    handover_confirmed_at: string | null;
    handover_confirmed_by_name: string | null;
  };
  items: {
    product_name: string;
    qty: number;
    price: number;
  }[];
  events: {
    id: number;
    kind: string;
    method: string;
    actor_role: string | null;
    buyer_name: string | null;
    signature_data: string | null;
    note: string | null;
    created_at: string;
  }[];
};

export default async function VerifyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user || (user.role !== "OWNER" && user.role !== "KASIR" && user.role !== "DEVELOPER")) redirect("/");
  if (!user.goToken) redirect("/login");

  const { id } = await params;
  // ID numerik Go; selain itu pasti tidak ada di backend.
  if (!/^\d+$/.test(id)) notFound();

  const res = await goFetch<GoDetailResponse>(
    user.goToken,
    `/transactions/${id}`,
  );
  if (!res.ok) notFound();
  const tx = res.data.transaction;
  if (!tx || !tx.claim_code) notFound();

  const code = tx.claim_code;
  const verifyUrl = buildVerifyUrl(code);
  const qrSvg = await QRCode.toString(verifyUrl, {
    type: "svg",
    errorCorrectionLevel: "M",
    width: 180,
  });

  const createdAt = new Date(tx.created_at);
  const confirmedAt = tx.handover_confirmed_at
    ? new Date(tx.handover_confirmed_at)
    : null;
  const status = tx.handover_status;
  const st = status ? STATUS_STYLE[status] : null;
  const confirmEvent = res.data.events.find((e) => e.kind === "BUYER_CONFIRM");
  // Siapa yang mencatat penyajian/konfirmasi di sisi staf (audit v3) —
  // dibawa Go sebagai handover_confirmed_by_name.
  const actorName = tx.handover_confirmed_by_name;

  return (
    // Shell aurora (v1.8.0): detail bukti serah terima ikut tema pengguna.
    <main className="relative mx-auto min-h-screen w-full max-w-md bg-slate-50 p-4 pb-16 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />
      <div className="relative z-10">
      <div className="mb-3 flex items-center justify-between">
        <Link href="/owner/verify" className="text-sm text-slate-500 dark:text-slate-400">
          ← Daftar
        </Link>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Bukti Serah Terima
        </p>
        <UserMenu user={userMenuUser(session)} className="scale-90 origin-top-right" />
      </div>

      {/* Ringkasan transaksi */}
      <section className="rounded-2xl glass-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {dtFmt.format(createdAt)} WIB
            </p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {formatRupiah(tx.total)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {res.data.items.length} item ·{" "}
              {PAYMENT_LABELS[tx.payment_method] ?? tx.payment_method}
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
        <ul className="mt-3 space-y-1 border-t border-slate-100 dark:border-slate-800/60 pt-3">
          {res.data.items.map((it, i) => (
            <li key={i} className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>
                {it.product_name} × {it.qty}
              </span>
              <span>{formatRupiah(it.price * it.qty)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Kode + QR — selalu tersedia (staf never forgets the code) */}
      <section className="mt-3 rounded-2xl glass-card p-4 text-center">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Kode verifikasi</p>
        <p className="mt-1 font-mono text-3xl font-bold tracking-[0.25em] text-slate-900 dark:text-slate-100">
          {code}
        </p>
        <div className="mt-3 flex justify-center">
          <div
            className="w-44 [&_svg]:h-full [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          Untuk bukti kuat: minta pembeli scan QR ini dengan HP-nya, atau
          bacakan kodenya.
        </p>
        <div className="mt-2 flex justify-center gap-2">
          <CopyButton text={code} label="Salin kode" />
          <CopyButton text={verifyUrl} label="Salin link" />
        </div>
      </section>

      {/* Aksi */}
      <section className="mt-3 rounded-2xl glass-card p-4">
        {status === "SERVED" ? (
          <div className="space-y-2 text-center">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              ✔ Tercatat disajikan{" "}
              {dtFmt.format(confirmedAt ?? createdAt)} WIB
              {actorName ? ` oleh ${actorName}` : ""}
            </p>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Penandaan penyajian SATU ARAH — tidak bisa dibatalkan. Klaim
              penggantian pesanan untuk struk ini ditolak; jejaknya permanen.
            </p>
          </div>
        ) : status === "CONFIRMED" ? (
          <div className="space-y-3 text-center">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              ✔ Terverifikasi{" "}
              {dtFmt.format(confirmedAt ?? createdAt)} WIB
            </p>
            {confirmEvent?.signature_data && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={confirmEvent.signature_data}
                alt="Tanda tangan pembeli"
                className="mx-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              />
            )}
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Metode:{" "}
              {confirmEvent?.method === "PUBLIC" ? "HP pembeli" : "layar kurir"}
              {confirmEvent?.buyer_name
                ? ` · a.n. ${confirmEvent.buyer_name}`
                : ""}
            </p>
          </div>
        ) : status === "DISPUTED" ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm font-medium text-red-700 dark:text-red-300">
              Pembeli membantah menerima pesanan ini. Kalau ternyata sudah
              diterima, minta pembeli tanda tangan di bawah (atau konfirmasi
              lewat QR/link di atas).
            </p>
            <ConfirmInAppForm transactionId={String(tx.id)} />
          </div>
        ) : status === "COURIER_CLAIMED" ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-200">
              Sudah diklaim kurir tanpa tanda tangan. Kalau pembeli sekarang ada
              di depan kamu, minta dia tanda tangan di bawah untuk bukti kuat.
            </p>
            <ConfirmInAppForm transactionId={String(tx.id)} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3">
              <p className="mb-2 text-xs font-bold text-blue-900">
                Dine-in / bungkus — pesanan diserahkan sekarang?
              </p>
              <ServeButton transactionId={String(tx.id)} />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                Konfirmasi di layar ini (bukti terkuat — tanda tangan pembeli)
              </p>
              <ConfirmInAppForm transactionId={String(tx.id)} />
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800/60 pt-3">
              <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                Pesanan diantar (online) tanpa tanda tangan?
              </p>
              <ClaimDeliveredButton transactionId={String(tx.id)} />
            </div>
          </div>
        )}
      </section>

      {/* Jejak audit — gak bisa dihapus, gak bisa dimanipulasi */}
      <section className="mt-3 rounded-2xl glass-card p-4">
        <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
          Jejak kejadian
        </p>
        <ol className="space-y-2">
          {res.data.events.map((e) => (
            <li key={e.id} className="flex gap-2 text-xs">
              <span className="shrink-0 font-mono text-slate-400 dark:text-slate-500">
                {dtFmt.format(new Date(e.created_at))}
              </span>
              <span className="text-slate-700 dark:text-slate-300">
                {KIND_LABEL[e.kind] ?? e.kind}
                {e.actor_role ? ` · ${e.actor_role}` : ""}
                {e.note ? ` — "${e.note}"` : ""}
              </span>
            </li>
          ))}
          {res.data.events.length === 0 && (
            <li className="text-xs text-slate-400 dark:text-slate-500">Belum ada aktivitas.</li>
          )}
        </ol>
      </section>
      </div>
    </main>
  );
}
