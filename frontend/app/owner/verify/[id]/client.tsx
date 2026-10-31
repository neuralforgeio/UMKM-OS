"use client";
// Interaksi halaman detail (layar kurir).
// v3.3.0 — restyle bahasa desain baru: input & tombol memakai token
// design system (glass-input, radius 12px, warna semantik). Perilaku
// formulir TIDAK berubah.
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
        className="glass-input w-full rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
      />
      <label className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#6658e8]"
        />
        <span>
          Pembeli menyatakan pesanan ini diterima dengan lengkap dan benar.
        </span>
      </label>
      {error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <button
        onClick={submit}
        disabled={pending}
        className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
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
        className="w-full rounded-xl border border-amber-500 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
      >
        {pending
          ? "Menyimpan..."
          : "Sudah Diantar — Klaim Kurir (tanpa tanda tangan)"}
      </button>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
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
      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-100"
    >
      {copied ? "Tersalin ✓" : (label ?? "Salin")}
    </button>
  );
}
