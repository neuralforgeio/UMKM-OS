// KONSOL VERIFIKASI STRUK v3 (dine-in) — dibuka KASIR/OWNER yang login.
// Nomor struk adalah ALAMAT, bukan kunci: pencarian hanya menampilkan
// status + ATURAN KEPUTUSAN deterministik. Status penyajian dicatat
// staf lewat Antrean Penyajian (satu arah, berjejak di HandoverEvent).
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/format";
import { startOfTodayWIB } from "@/lib/handover";
import { ServeButton, ServeQueuePanel } from "@/components/serve-queue";

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

export default async function VerifyConsolePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user || (user.role !== "OWNER" && user.role !== "KASIR")) redirect("/");

  const sp = await searchParams;
  const rawQ = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const q = (rawQ ?? "").trim();

  // Kasir only sees their outlet; an owner without one sees all.
  const outletScope = user.outletId ? { outletId: user.outletId } : {};

  const todayRows = await prisma.transaction.findMany({
    where: { createdAt: { gte: startOfTodayWIB() }, ...outletScope },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      code: true,
      createdAt: true,
      total: true,
      paymentMethod: true,
      status: true,
      handoverStatus: true,
      items: { select: { quantity: true } },
    },
  });

  // The queue = today's completed receipts with zero handover activity.
  const queueRows = todayRows
    .filter((t) => t.status === "COMPLETED" && t.handoverStatus === null)
    .map((t) => ({
      id: t.id,
      code: t.code,
      createdAtIso: t.createdAt.toISOString(),
      itemCount: t.items.reduce((sum, i) => sum + i.quantity, 0),
      totalRupiah: Math.round(Number(t.total)),
      paymentMethod: t.paymentMethod,
    }));

  const chips: { label: string; value: number; cls: string }[] = [
    {
      label: "Menunggu",
      value: queueRows.length,
      cls: "bg-amber-100 text-amber-700",
    },
    {
      label: "Disajikan",
      value: todayRows.filter((t) => t.handoverStatus === "SERVED").length,
      cls: "bg-teal-100 text-teal-700",
    },
    {
      label: "Terverifikasi",
      value: todayRows.filter((t) => t.handoverStatus === "CONFIRMED").length,
      cls: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Sengketa",
      value: todayRows.filter((t) => t.handoverStatus === "DISPUTED").length,
      cls: "bg-red-100 text-red-700",
    },
  ];

  // Lookup by receipt code (TRX-...) or the legacy 8-char verification
  // code — both resolve to the same single receipt, scoped to outlet.
  const found = q
    ? await prisma.transaction.findFirst({
        where: {
          OR: [{ code: q.toUpperCase() }, { claimCode: q.toUpperCase() }],
          ...outletScope,
        },
        select: {
          id: true,
          code: true,
          createdAt: true,
          total: true,
          paymentMethod: true,
          status: true,
          handoverStatus: true,
          handoverConfirmedAt: true,
          handoverConfirmedBy: true,
          items: { select: { quantity: true } },
        },
      })
    : null;
  const foundItemCount = found
    ? found.items.reduce((sum, i) => sum + i.quantity, 0)
    : 0;
  const foundAgeMin = found
    ? Math.max(0, Math.floor((Date.now() - found.createdAt.getTime()) / 60000))
    : 0;
  const foundByName = found?.handoverConfirmedBy
    ? ((
        await prisma.user.findUnique({
          where: { id: found.handoverConfirmedBy },
          select: { name: true },
        })
      )?.name ?? null)
    : null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-slate-50 p-4 pb-20">
      <div className="mb-3 flex items-center justify-between">
        <Link
          href={user.role === "KASIR" ? "/cashier" : "/owner"}
          className="text-sm text-slate-500"
        >
          ← Kembali
        </Link>
        <p className="text-sm font-semibold text-slate-700">
          Konsol Verifikasi
        </p>
        <span className="w-10" />
      </div>

      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Cari nomor struk (TRX-…)"
          autoComplete="off"
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 outline-none transition placeholder:font-sans placeholder:text-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Cari
        </button>
      </form>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {chips.map((c) => (
          <div key={c.label} className={`rounded-xl p-2 text-center ${c.cls}`}>
            <p className="text-lg font-bold leading-tight">{c.value}</p>
            <p className="text-[10px] leading-tight">{c.label}</p>
          </div>
        ))}
      </div>

      {q && found && (
        <section className="mt-4 space-y-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="font-mono text-xs font-bold text-slate-900">
              {found.code}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {dtFmt.format(found.createdAt)} WIB · {foundItemCount} item ·{" "}
              {formatRupiah(Math.round(Number(found.total)))}
            </p>
            <p className="text-[11px] text-slate-400">
              Dibayar via{" "}
              {PAYMENT_LABELS[found.paymentMethod] ?? found.paymentMethod}
            </p>
          </div>

          {found.status === "REFUNDED" ? (
            <div className="rounded-2xl bg-slate-100 p-4 text-sm font-medium text-slate-600 shadow-sm">
              Struk ini sudah DIREFUND. Uang dianggap kembali ke pembeli dan
              stok telah dikembalikan.
            </div>
          ) : found.handoverStatus === "SERVED" ? (
            <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 shadow-sm">
              <p className="font-bold">
                ✔ Tercatat disajikan{" "}
                {dtFmt.format(found.handoverConfirmedAt ?? found.createdAt)} WIB
                {foundByName ? ` oleh ${foundByName}` : ""}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-700/80">
                Aturan: klaim penggantian pesanan untuk struk ini DITOLAK —
                penyerahan tercatat permanen (siapa + kapan) dan tidak bisa
                dibatalkan.
              </p>
              <Link
                href={`/owner/verify/${found.id}`}
                className="mt-2 inline-block text-xs font-bold text-emerald-700 underline"
              >
                Lihat jejak lengkap
              </Link>
            </div>
          ) : found.handoverStatus === "CONFIRMED" ? (
            <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 shadow-sm">
              <p className="font-bold">
                ✔ Terverifikasi diterima pembeli{" "}
                {dtFmt.format(found.handoverConfirmedAt ?? found.createdAt)} WIB
              </p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-700/80">
                Bukti terkuat: tanda tangan pembeli tersimpan permanen.
              </p>
              <Link
                href={`/owner/verify/${found.id}`}
                className="mt-2 inline-block text-xs font-bold text-emerald-700 underline"
              >
                Lihat tanda tangan &amp; jejak
              </Link>
            </div>
          ) : found.handoverStatus === "DISPUTED" ? (
            <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 shadow-sm">
              <p className="font-bold">
                Sengketa terbuka — pembeli membantah pernah menerima.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-red-700/80">
                Selesaikan langsung dengan pembeli; seluruh jejak kejadian
                tersedia di halaman detail.
              </p>
              <Link
                href={`/owner/verify/${found.id}`}
                className="mt-2 inline-block text-xs font-bold text-red-700 underline"
              >
                Buka detail penyelesaian
              </Link>
            </div>
          ) : found.handoverStatus === "COURIER_CLAIMED" ? (
            <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
              <p className="font-bold">
                Ditandai sudah diantar (klaim staf, tanpa tanda tangan).
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-700/80">
                Bukti lemah — bila pembeli ada di tempat, minta ia tanda tangan
                di halaman detail untuk bukti kuat.
              </p>
              <Link
                href={`/owner/verify/${found.id}`}
                className="mt-2 inline-block text-xs font-bold text-amber-700 underline"
              >
                Buka detail
              </Link>
            </div>
          ) : foundAgeMin >= 30 ? (
            <div className="space-y-3 rounded-2xl bg-amber-50 p-4 shadow-sm">
              <p className="text-sm font-bold text-amber-900">
                Sudah {foundAgeMin} menit dan belum disajikan!
              </p>
              <p className="text-xs leading-relaxed text-amber-800/80">
                Sajikan pesanan sekarang, atau tutup dengan alasan (mis. diambil
                sendiri oleh pembeli) — alasan tercatat permanen untuk evaluasi
                pola staf.
              </p>
              <ServeButton transactionId={found.id} withNote />
              <Link
                href={`/owner/verify/${found.id}`}
                className="block text-center text-xs font-bold text-amber-700 underline"
              >
                Buka detail
              </Link>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl bg-blue-50 p-4 shadow-sm">
              <p className="text-sm font-bold text-blue-900">
                Belum disajikan ({foundAgeMin} mnt lalu) — sajikan sekarang.
              </p>
              <ServeButton transactionId={found.id} />
              <Link
                href={`/owner/verify/${found.id}`}
                className="block text-center text-xs font-bold text-blue-700 underline"
              >
                Buka detail
              </Link>
            </div>
          )}
        </section>
      )}

      {q && !found && (
        <div className="mt-3 rounded-2xl bg-white p-5 text-center text-sm text-slate-400 shadow-sm">
          Struk <span className="font-mono font-bold">{q}</span> tidak
          ditemukan. Periksa lagi nomornya — formatnya TRX-tanggal-nomor,
          tercetak di bagian atas struk.
        </div>
      )}

      <ServeQueuePanel rows={queueRows} />
    </main>
  );
}
