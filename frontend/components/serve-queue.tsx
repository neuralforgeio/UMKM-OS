"use client";

// Antrean Penyajian — jantung anti-lupa Verifikasi Struk v3 (dine-in).
// Semua transaksi hari ini yang belum ditandai SERVED tampil di sini
// lengkap dengan umur pesanan; kasir cukup satu tap "Sudah Disajikan"
// saat makanan/meja diserahkan. Dipakai di layar kasir (floating bar)
// dan di konsol verifikasi (panel inline).

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, UtensilsCrossed, X } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import {
  getServeQueue,
  markServed,
  type ServeQueueRow,
} from "@/app/owner/verify/actions";

const timeFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
});

function ageMinutes(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

function ageBadge(age: number) {
  if (age >= 10) return "bg-red-600";
  if (age >= 5) return "bg-amber-500";
  return "bg-slate-400";
}

// Re-render every 30s so the queue ages stay honest without touching
// the server — the row DATA itself refreshes separately.
function useNowTick() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// Keeps the queue live: initial rows come from the server render, then
// a lightweight server-action poll every 30s picks up orders taken by
// OTHER kasir devices (this device refreshes via router.refresh()).
function useServeQueueRows(initial: ServeQueueRow[]) {
  const [rows, setRows] = useState(initial);
  useEffect(() => {
    setRows(initial);
  }, [initial]);
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const next = await getServeQueue();
        setRows(next);
      } catch {
        // keep showing the last known rows
      }
    }, 30_000);
    return () => clearInterval(t);
  }, []);
  return rows;
}

export function ServeButton({
  transactionId,
  withNote = false,
  compact = false,
}: {
  transactionId: string;
  withNote?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await markServed({
        transactionId,
        note: withNote ? note : undefined,
      });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className={compact ? "shrink-0" : "space-y-2"}>
      {withNote && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="Alasan penutupan (opsional, tercatat permanen)"
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none transition placeholder:text-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700"
        />
      )}
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className={
          compact
            ? "flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            : "flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? "Menyimpan…" : "Sudah Disajikan"}
      </button>
      {error && (
        <p
          className={`text-xs font-semibold text-red-600 dark:text-red-400 ${compact ? "max-w-[10rem] text-right" : ""}`}
        >
          {error}
        </p>
      )}
    </div>
  );
}

function ServeRow({ row, now }: { row: ServeQueueRow; now: number }) {
  const age = ageMinutes(row.createdAtIso, now);
  return (
    <li className="flex items-center gap-3 rounded-2xl glass-card p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
          {row.code}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
          {timeFmt.format(new Date(row.createdAtIso))} · {row.itemCount} item ·{" "}
          {formatRupiah(row.totalRupiah)}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums text-white ${ageBadge(age)}`}
        title="Umur pesanan sejak checkout"
      >
        {age} mnt
      </span>
      <ServeButton transactionId={row.id} compact />
    </li>
  );
}

export function ServeQueuePanel({
  rows: initialRows,
}: {
  rows: ServeQueueRow[];
}) {
  const rows = useServeQueueRows(initialRows);
  const now = useNowTick();
  return (
    <section className="mt-4">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Antrean Penyajian</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          {rows.length} menunggu · segar tiap 30 dtk
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-2xl glass-card p-5 text-center text-sm text-slate-400 dark:text-slate-500">
          Semua pesanan hari ini sudah ditandai disajikan.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <ServeRow key={row.id} row={row} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function ServeQueueBar({
  rows: initialRows,
}: {
  rows: ServeQueueRow[];
}) {
  const rows = useServeQueueRows(initialRows);
  const [open, setOpen] = useState(false);
  const now = useNowTick();

  if (rows.length === 0) return null;
  const oldest = Math.max(
    ...rows.map((row) => ageMinutes(row.createdAtIso, now)),
  );

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 print:hidden">
      {open && (
        <div className="mx-auto w-full max-w-md px-3 pb-2">
          <div className="rounded-2xl glass-card p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Antrean Penyajian
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup antrean"
                className="rounded-lg p-1 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="max-h-[50dvh] space-y-2 overflow-y-auto">
              {rows.map((row) => (
                <ServeRow key={row.id} row={row} now={now} />
              ))}
            </ul>
            <Link
              href="/owner/verify"
              className="mt-2 block text-center text-xs font-semibold text-blue-600 dark:text-blue-400"
            >
              Buka Konsol Verifikasi
            </Link>
          </div>
        </div>
      )}
      <div className="mx-auto w-full max-w-md px-3 pb-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-lg transition ${
            oldest >= 10
              ? "bg-red-600"
              : oldest >= 5
                ? "bg-amber-500"
                : "bg-slate-800 dark:bg-slate-700"
          }`}
        >
          <UtensilsCrossed className="h-4 w-4" />
          {rows.length} pesanan belum disajikan · tertua {oldest} mnt
        </button>
      </div>
    </div>
  );
}