"use client";
// Form konfirmasi & pembantahan dari sisi pembeli (HP pembeli).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "@/components/handover/signature-pad";
import { confirmByCode, disputeByCode } from "./actions";

export function BuyerConfirmForm({ code }: { code: string }) {
  const router = useRouter();
  const [signature, setSignature] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (!signature) return setError("Tanda tangan belum digambar.");
    if (!agreed) return setError("Centang pernyataannya dulu.");
    startTransition(async () => {
      const res = await confirmByCode({
        code,
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
        placeholder="Nama kamu (opsional)"
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
          Saya menyatakan pesanan di atas sudah saya terima dengan lengkap dan
          benar.
        </span>
      </label>
      {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
      <button
        onClick={submit}
        disabled={pending}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Menyimpan..." : "Konfirmasi Penerimaan"}
      </button>
    </div>
  );
}

export function BuyerDisputeButton({ code }: { code: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await disputeByCode({ code, reason });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-2">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400"
        >
          Saya TIDAK menerima pesanan ini
        </button>
      ) : (
        <div className="space-y-2 rounded-xl bg-red-50 dark:bg-red-950/40 p-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ceritakan singkat (opsional): barang belum sampai, kurang, rusak..."
            rows={3}
            maxLength={200}
            className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs text-slate-600 dark:text-slate-400"
            >
              Batal
            </button>
            <button
              onClick={submit}
              disabled={pending}
              className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Mengirim..." : "Kirim Pembantahan"}
            </button>
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}