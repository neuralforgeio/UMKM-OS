// KONSOL VERIFIKASI STRUK v3 (dine-in) — dibuka KASIR/OWNER yang login
// (dan DEVELOPER saat mode maintenance, Task 35).
// Nomor struk adalah ALAMAT, bukan kunci: pencarian hanya menampilkan
// status + ATURAN KEPUTUSAN deterministik. Status penyajian dicatat
// staf lewat Antrean Penyajian (satu arah, berjejak di HandoverEvent).
//
// Redesign Task 35: kartu statistik berikon + ring warna, pencarian
// dengan ikon, kartu hasil dengan aksen warna kiri — logika query dan
// aksi TIDAK berubah sama sekali.
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  Clock3,
  ScanSearch,
  UtensilsCrossed,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/format";
import { startOfTodayWIB } from "@/lib/handover";
import { AuroraBackground } from "@/components/aurora-background";
import { ThemeHeaderActions } from "@/components/theme-header-actions";
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
  if (
    !user ||
    (user.role !== "OWNER" &&
      user.role !== "KASIR" &&
      user.role !== "DEVELOPER")
  ) {
    redirect("/");
  }

  const sp = await searchParams;
  const rawQ = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const q = (rawQ ?? "").trim();

  // Kasir/developer-maintenance only sees their outlet; an owner without
  // one sees all.
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

  const chips: {
    label: string;
    value: number;
    icon: typeof Clock3;
    chip: string;
    valueCls: string;
  }[] = [
    {
      label: "Menunggu",
      value: queueRows.length,
      icon: Clock3,
      chip: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-500/30",
      valueCls: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Disajikan",
      value: todayRows.filter((t) => t.handoverStatus === "SERVED").length,
      icon: UtensilsCrossed,
      chip: "bg-teal-50 text-teal-600 ring-1 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:ring-teal-500/30",
      valueCls: "text-teal-600",
    },
    {
      label: "Terverifikasi",
      value: todayRows.filter((t) => t.handoverStatus === "CONFIRMED").length,
      icon: BadgeCheck,
      chip: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-500/30",
      valueCls: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Sengketa",
      value: todayRows.filter((t) => t.handoverStatus === "DISPUTED").length,
      icon: AlertTriangle,
      chip: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-500/30",
      valueCls: "text-red-600 dark:text-red-400",
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
    // Shell aurora (v1.8.0): konsol verifikasi ikut tema terang/gelap
    // pengguna; kartu statistik & hasil memakai kaca aurora.
    <main className="relative mx-auto min-h-screen w-full max-w-md bg-slate-100 p-4 pb-24 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />
      <div className="relative z-10">
      {/* Header: identitas + konteks hari ini. */}
      <header className="mb-3 flex items-center justify-between gap-2">
        <Link
          href={
            user.role === "KASIR"
              ? "/cashier"
              : user.role === "DEVELOPER"
                ? "/dev"
                : "/owner"
          }
          className="rounded-lg bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 shadow-sm ring-1 ring-slate-200 transition hover:text-slate-900 dark:hover:text-slate-100"
        >
          ← Kembali
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <ThemeHeaderActions />
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <ScanSearch className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight text-slate-900 dark:text-slate-100">
              Konsol Verifikasi
            </p>
            <p className="text-[10px] leading-tight text-slate-500 dark:text-slate-400">
              Status struk &amp; antrean penyajian hari ini
            </p>
          </div>
        </div>
      </header>

      {/* Pencarian nomor struk. */}
      <form method="get" className="relative flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Cari nomor struk (TRX-…)"
          autoComplete="off"
          className="w-full rounded-2xl glass-card py-3 pl-10 pr-3 font-mono text-sm text-slate-900 dark:text-slate-100 outline-none transition placeholder:font-sans placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700"
        />
        <ScanSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <button
          type="submit"
          className="shrink-0 rounded-2xl bg-slate-900 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Cari
        </button>
      </form>

      {/* Statistik hari ini: ikon + angka besar, ring warna sesuai status. */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        {chips.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl glass-card p-2.5 text-center"
          >
            <div
              className={`mx-auto flex h-7 w-7 items-center justify-center rounded-xl ${c.chip}`}
            >
              <c.icon className="h-3.5 w-3.5" />
            </div>
            <p className={`mt-1.5 text-xl font-bold leading-none tabular-nums ${c.valueCls}`}>
              {c.value}
            </p>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {c.label}
            </p>
          </div>
        ))}
      </div>

      {q && found && (
        <section className="mt-4 space-y-3">
          {/* Kartu identitas struk. */}
          <div className="rounded-2xl glass-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                {found.code}
              </p>
              <span className="rounded-full bg-slate-100 dark:bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                {PAYMENT_LABELS[found.paymentMethod] ?? found.paymentMethod}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-dashed border-slate-200 dark:border-slate-800 pt-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {dtFmt.format(found.createdAt)} WIB · {foundItemCount} item
              </p>
              <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {formatRupiah(Math.round(Number(found.total)))}
              </p>
            </div>
          </div>

          {/* Kartu status — aturan keputusan, kartu aksen kiri sesuai
              bobot: merah = masalah, amber = perlu tindakan, hijau =
              selesai, biru = baru. */}
          {found.status === "REFUNDED" ? (
            <div className="rounded-2xl border-l-4 glass-card p-4 text-sm font-medium text-slate-600 dark:text-slate-400">
              Struk ini sudah <b>DIREFUND</b>. Uang dianggap kembali ke
              pembeli dan stok telah dikembalikan.
            </div>
          ) : found.handoverStatus === "SERVED" ? (
            <div className="rounded-2xl border-l-4 border-emerald-500 glass-card p-4 text-sm text-slate-700 dark:text-slate-300">
              <p className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                <BadgeCheck className="h-4 w-4" />
                Tercatat disajikan{" "}
                {dtFmt.format(found.handoverConfirmedAt ?? found.createdAt)} WIB
                {foundByName ? ` oleh ${foundByName}` : ""}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Aturan: klaim penggantian pesanan untuk struk ini DITOLAK —
                penyerahan tercatat permanen (siapa + kapan) dan tidak bisa
                dibatalkan.
              </p>
              <Link
                href={`/owner/verify/${found.id}`}
                className="mt-2 inline-block text-xs font-bold text-emerald-700 dark:text-emerald-300 underline"
              >
                Lihat jejak lengkap
              </Link>
            </div>
          ) : found.handoverStatus === "CONFIRMED" ? (
            <div className="rounded-2xl border-l-4 border-emerald-600 glass-card p-4 text-sm text-slate-700 dark:text-slate-300">
              <p className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                <BadgeCheck className="h-4 w-4" />
                Terverifikasi diterima pembeli{" "}
                {dtFmt.format(found.handoverConfirmedAt ?? found.createdAt)} WIB
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Bukti terkuat: tanda tangan pembeli tersimpan permanen.
              </p>
              <Link
                href={`/owner/verify/${found.id}`}
                className="mt-2 inline-block text-xs font-bold text-emerald-700 dark:text-emerald-300 underline"
              >
                Lihat tanda tangan &amp; jejak
              </Link>
            </div>
          ) : found.handoverStatus === "DISPUTED" ? (
            <div className="rounded-2xl border-l-4 border-red-500 glass-card p-4 text-sm text-red-700 dark:text-red-300">
              <p className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="h-4 w-4" />
                Sengketa terbuka — pembeli membantah pernah menerima.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-red-600/80">
                Selesaikan langsung dengan pembeli; seluruh jejak kejadian
                tersedia di halaman detail.
              </p>
              <Link
                href={`/owner/verify/${found.id}`}
                className="mt-2 inline-block text-xs font-bold text-red-700 dark:text-red-300 underline"
              >
                Buka detail penyelesaian
              </Link>
            </div>
          ) : found.handoverStatus === "COURIER_CLAIMED" ? (
            <div className="rounded-2xl border-l-4 border-amber-500 glass-card p-4 text-sm text-amber-800 dark:text-amber-200">
              <p className="font-bold">
                Ditandai sudah diantar (klaim staf, tanpa tanda tangan).
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-700/80">
                Bukti lemah — bila pembeli ada di tempat, minta ia tanda tangan
                di halaman detail untuk bukti kuat.
              </p>
              <Link
                href={`/owner/verify/${found.id}`}
                className="mt-2 inline-block text-xs font-bold text-amber-700 dark:text-amber-300 underline"
              >
                Buka detail
              </Link>
            </div>
          ) : foundAgeMin >= 30 ? (
            <div className="space-y-3 rounded-2xl border-l-4 border-red-500 glass-card p-4">
              <p className="flex items-center gap-1.5 text-sm font-bold text-red-600 dark:text-red-400">
                <Clock3 className="h-4 w-4" />
                Sudah {foundAgeMin} menit dan belum disajikan!
              </p>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Sajikan pesanan sekarang, atau tutup dengan alasan (mis. diambil
                sendiri oleh pembeli) — alasan tercatat permanen untuk evaluasi
                pola staf.
              </p>
              <ServeButton transactionId={found.id} withNote />
              <Link
                href={`/owner/verify/${found.id}`}
                className="block text-center text-xs font-bold text-red-600 dark:text-red-400 underline"
              >
                Buka detail
              </Link>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border-l-4 border-blue-500 glass-card p-4">
              <p className="flex items-center gap-1.5 text-sm font-bold text-blue-700 dark:text-blue-300">
                <Clock3 className="h-4 w-4" />
                Belum disajikan ({foundAgeMin} mnt lalu) — sajikan sekarang.
              </p>
              <ServeButton transactionId={found.id} />
              <Link
                href={`/owner/verify/${found.id}`}
                className="block text-center text-xs font-bold text-blue-700 dark:text-blue-300 underline"
              >
                Buka detail
              </Link>
            </div>
          )}
        </section>
      )}

      {q && !found && (
        <div className="mt-3 rounded-2xl glass-card p-5 text-center text-sm text-slate-400 dark:text-slate-500">
          Struk <span className="font-mono font-bold text-slate-600 dark:text-slate-400">{q}</span>{" "}
          tidak ditemukan. Periksa lagi nomornya — formatnya TRX-tanggal-nomor,
          tercetak di bagian atas struk.
        </div>
      )}

      <ServeQueuePanel rows={queueRows} />
      </div>
    </main>
  );
}