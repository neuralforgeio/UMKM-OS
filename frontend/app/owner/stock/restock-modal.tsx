"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PackagePlus, X } from "lucide-react";
import { formatThousands } from "@/lib/format";
import { recordRestock } from "./actions";
import type { RestockTarget } from "./types";

// Digit-only sanitizing: typing or pasting "Rp 5.000" becomes "5000".
const digits = (value: string, max: number) =>
  value.replace(/\D/g, "").slice(0, max);

// Live grouping for numeric fields: the stored string stays raw digits
// ("4000"), only the presentation gains Indonesian thousand dots.
const grouped = (value: string) =>
  value ? formatThousands(parseInt(value, 10)) : "";

const LABEL_CLASS =
  "text-xs font-semibold uppercase tracking-wide text-slate-500";
const INPUT_CLASS =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

// Rp text field with a fixed prefix and live thousand separators — the
// same money language as the product form and the cashier panel.
function RpInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-slate-400">
        Rp
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={grouped(value)}
        placeholder={placeholder ?? "0"}
        onChange={(event) => onChange(digits(event.target.value, 10))}
        className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-right text-sm font-semibold tabular-nums text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

// Plain integer field (restock quantity) without the Rp prefix.
function QtyInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={grouped(value)}
      placeholder="0"
      onChange={(event) => onChange(digits(event.target.value, 5))}
      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-right text-sm font-semibold tabular-nums text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
    />
  );
}

type RestockModalProps = {
  target: RestockTarget;
  onClose: () => void;
};

export function RestockModal({ target, onClose }: RestockModalProps) {
  // Prefill with the dashboard suggestion and the known purchase cost —
  // the owner only adjusts when the supplier price actually changed.
  const [quantity, setQuantity] = useState(String(target.suggestedQty));
  const [cost, setCost] = useState(
    target.costRupiah > 0 ? String(target.costRupiah) : "",
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const qty = quantity ? parseInt(quantity, 10) : 0;
  const costRp = cost ? parseInt(cost, 10) : null;
  // Live preview: the owner sees where the stock lands before saving.
  const stockAfter = target.stock + qty;

  const submit = () => {
    setError(null);
    if (qty <= 0) {
      setError("Jumlah restok harus lebih dari 0.");
      return;
    }
    if (costRp !== null && costRp < 0) {
      setError("Harga beli tidak boleh negatif.");
      return;
    }
    startTransition(async () => {
      const result = await recordRestock({
        productId: target.id,
        quantity: qty,
        costRupiah: costRp,
        note: note.trim() || null,
      });
      if (result.ok) {
        onClose();
        // Pull fresh stock numbers, dashboard widget, and timeline.
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Catat restok ${target.name}`}
    >
      <div
        className="absolute inset-0 bg-slate-900/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <PackagePlus className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold leading-tight text-slate-900">
                Catat Restok
              </h2>
              <p className="truncate text-xs text-slate-500">
                {target.name} · {target.sku}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup formulir"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Stok Saat Ini
                </p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                  {target.stock} {target.unit}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Setelah Restok
                </p>
                <p
                  className={`mt-0.5 text-sm font-bold tabular-nums ${
                    qty > 0 ? "text-emerald-600" : "text-slate-400"
                  }`}
                >
                  {stockAfter} {target.unit}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="restock-quantity" className={LABEL_CLASS}>
                  Jumlah Masuk
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1">
                    <QtyInput
                      id="restock-quantity"
                      value={quantity}
                      onChange={setQuantity}
                    />
                  </div>
                  <span className="shrink-0 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">
                    {target.unit}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-tight text-slate-400">
                  Saran: +{target.suggestedQty} {target.unit} (2x batas
                  minimum).
                </p>
              </div>
              <div>
                <label htmlFor="restock-cost" className={LABEL_CLASS}>
                  Harga Beli / {target.unit}
                </label>
                <div className="mt-1">
                  <RpInput
                    id="restock-cost"
                    value={cost}
                    onChange={setCost}
                    placeholder="63.000"
                  />
                </div>
                <p className="mt-1 text-[11px] leading-tight text-slate-400">
                  Opsional — tersimpan sebagai snapshot biaya.
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="restock-note" className={LABEL_CLASS}>
                Catatan
              </label>
              <input
                id="restock-note"
                type="text"
                autoComplete="off"
                value={note}
                onChange={(event) => setNote(event.target.value.slice(0, 200))}
                placeholder="Contoh: belanja dari Toko Grosir Jaya"
                className={`mt-1 ${INPUT_CLASS}`}
              />
              <p className="mt-1 text-[11px] leading-tight text-slate-400">
                Opsional — tampil di riwayat pergerakan stok.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700"
              >
                {error}
              </div>
            )}
          </div>

          <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:flex-none sm:px-5"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:px-6"
            >
              {isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {isPending ? "Menyimpan…" : "Simpan Restok"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
