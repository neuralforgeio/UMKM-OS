"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { confirmClaim } from "../actions";

// Public claim form: the 6-digit code lives only on the customer's
// receipt, so entering it here IS the customer-side proof of handover.
export function VerifyClient({
  code,
  prefill,
}: {
  code: string;
  prefill: string;
}) {
  const router = useRouter();
  const [claimCode, setClaimCode] = useState(prefill);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await confirmClaim({ code, claimCode });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-slate-900">
        Konfirmasi Penerimaan
      </h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Kode klaim tercetak di bagian bawah struk Anda.
      </p>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={claimCode}
        onChange={(e) =>
          setClaimCode(e.target.value.replace(/\D/g, "").slice(0, 6))
        }
        placeholder="000000"
        disabled={isPending}
        className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center font-mono text-lg tracking-[0.4em] text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
      {prefill && (
        <p className="mt-1.5 text-xs text-slate-500">
          Kode terisi otomatis dari QR — tinggal tekan Konfirmasi.
        </p>
      )}
      {error && (
        <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={isPending || claimCode.length !== 6}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CheckCircle2 className="h-4 w-4" />
        {isPending ? "Memproses..." : "Konfirmasi Diterima"}
      </button>
    </section>
  );
}
