"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock, LockOpen, RotateCcw } from "lucide-react";
import { cancelClaim, ownerConfirmClaim, unlockClaim } from "./actions";

type ActionResult = { ok: true } | { ok: false; error: string };

// Owner-side action panel for ONE struk. Three states, one job each:
// claimed → proof banner + undo; locked → unlock or manual confirm;
// unclaimed → confirm with the customer's claim code (or manual).
export function OwnerVerifyClient({
  code,
  hasClaimCode,
  claimedAtLabel,
  claimNote,
  locked,
}: {
  code: string;
  hasClaimCode: boolean;
  claimedAtLabel: string | null;
  claimNote: string | null;
  locked: boolean;
}) {
  const router = useRouter();
  const [claimCode, setClaimCode] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<ActionResult>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const errorBox = error && (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
      {error}
    </div>
  );

  const noteInput = (
    <div>
      <label className="text-xs font-semibold text-slate-500">
        Catatan (opsional)
      </label>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 120))}
        placeholder="cth: diserahkan langsung ke pembeli"
        disabled={isPending}
        className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );

  if (claimedAtLabel) {
    return (
      <div className="space-y-3 border-t border-slate-100 pt-4">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-emerald-800">Sudah Diterima</p>
            <p className="mt-0.5 text-xs text-emerald-700">
              {claimedAtLabel}
              {claimNote ? ` — ${claimNote}` : ""}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-emerald-600">
              Konfirmasi ini adalah bukti serah terima — pembeli tidak bisa
              mengaku belum menerima pesanan.
            </p>
          </div>
        </div>
        {errorBox}
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (
              window.confirm(
                "Batalkan konfirmasi struk ini? Status kembali menjadi belum diterima.",
              )
            ) {
              run(() => cancelClaim(code));
            }
          }}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          {isPending ? "Memproses..." : "Batalkan Konfirmasi"}
        </button>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="space-y-3 border-t border-slate-100 pt-4">
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-rose-800">Struk Terkunci</p>
            <p className="mt-0.5 text-xs leading-relaxed text-rose-700">
              Lima kali kode klaim salah dari formulir publik. Buka kunci
              setelah memastikan dengan pembeli, atau konfirmasi manual.
            </p>
          </div>
        </div>
        {noteInput}
        {errorBox}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => unlockClaim(code))}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LockOpen className="h-4 w-4" />
            Buka Kunci
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(() =>
                ownerConfirmClaim({
                  code,
                  note: note.trim() || undefined,
                }),
              )
            }
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            Konfirmasi Manual
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-slate-100 pt-4">
      {hasClaimCode ? (
        <div>
          <label className="text-xs font-semibold text-slate-500">
            Kode klaim dari struk pembeli (6 digit)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={claimCode}
            onChange={(e) =>
              setClaimCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="000000"
            disabled={isPending}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-center font-mono text-lg tracking-[0.4em] text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Kosongkan untuk konfirmasi manual oleh pemilik — tercatat sebagai
            konfirmasi manual, bukan dengan kode struk.
          </p>
        </div>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-500">
          Struk lama tanpa kode klaim — konfirmasi dicatat sebagai konfirmasi
          manual oleh pemilik.
        </p>
      )}
      {noteInput}
      {errorBox}
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          run(() =>
            ownerConfirmClaim({
              code,
              claimCode: hasClaimCode ? claimCode : undefined,
              note: note.trim() || undefined,
            }),
          )
        }
        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CheckCircle2 className="h-4 w-4" />
        {isPending
          ? "Memproses..."
          : hasClaimCode
            ? "Konfirmasi Diterima"
            : "Konfirmasi Manual"}
      </button>
    </div>
  );
}
