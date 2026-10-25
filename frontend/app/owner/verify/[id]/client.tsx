"use client";
// Interaksi halaman detail (layar kurir).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "@/components/handover/signature-pad";
import { claimDelivered, confirmHandoverInApp } from "../actions";

export function ConfirmInAppForm({ transactionId }: { transactionId: string }) {
  const router = useRouter();
  const [signature, setSignature] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (!signature) return setError("Tanda tangan pembeli belum digambar.");
    if (!agreed) return setError("Centang dulu pernyataan pembeli.");
    startTransition(async () => {
      const res = await confirmHandoverInApp({
        transactionId,
        buyerName,
        signatureData: signature,
      });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <SignaturePad onChange={setSignature} />
      <input
        value={buyerName}
        onChange={(e) => setBuyerName(e.target.value)}
        placeholder="Nama pembeli (opsional)"
        maxLength={40}
        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
      />
      <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Pembeli menyatakan pesanan ini diterima dengan lengkap dan benar.
        </span>
      </label>
      {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
      <button
        onClick={submit}
        disabled={pending}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Menyimpan..." : "Simpan Bukti Serah Terima"}
      </button>
    </div>
  );
}

export function ClaimDeliveredButton({
  transactionId,
}: {
  transactionId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const ok = window.confirm(
      "Tandai SUDAH DIANTAR tanpa tanda tangan pembeli?\n\n" +
        "Bukti hanya klaim kurir (lemah). Kalau pembeli bisa tanda tangan, pakai tombol atas.",
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await claimDelivered({ transactionId });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-1">
      <button
        onClick={submit}
        disabled={pending}
        className="w-full rounded-lg border border-amber-500 px-4 py-2.5 text-sm font-semibold text-amber-700 dark:text-amber-300 disabled:opacity-50"
      >
        {pending
          ? "Menyimpan..."
          : "Sudah Diantar â€” Klaim Kurir (tanpa tanda tangan)"}
      </button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    // Clipboard API tidak tersedia di HTTP (LAN IP), jadi sediakan
    // fallback execCommand untuk HP kurir yang membuka via IP.
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    setCopied(ok);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={copy}
      className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-[11px] text-slate-600 dark:text-slate-400"
    >
      {copied ? "Tersalin âœ“" : (label ?? "Salin")}
    </button>
  );
}