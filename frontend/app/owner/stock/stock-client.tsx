"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createStockMovementAction, type StockActionState } from "./actions";

export type StockProductOption = {
  id: string;
  name: string;
  sku: string;
  stock: number;
};

export type StockMovementRow = {
  id: string;
  productName: string;
  sku: string;
  type: string;
  quantity: number;
  unitCost: number;
  note: string | null;
  createdAt: string;
  timeLabel: string;
};

// Local rupiah formatter, kept inline so this module has no extra import.
// Output matches the shared formatRupiah convention: "Rp 12.500".
const formatRupiah = (value: number): string =>
  "Rp " + value.toLocaleString("id-ID");

type MovementType = "IN" | "OUT" | "ADJUST";
type TypeFilter = "ALL" | MovementType;

const TYPE_META: Record<MovementType, { label: string; badge: string }> = {
  IN: {
    label: "Masuk",
    badge: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
  },
  OUT: {
    label: "Keluar",
    badge: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
  },
  ADJUST: {
    label: "Opname",
    badge: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
  },
};

const FALLBACK_META = {
  label: "Lain",
  badge: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

const FILTERS: { key: TypeFilter; label: string }[] = [
  { key: "ALL", label: "Semua" },
  { key: "IN", label: "Masuk" },
  { key: "OUT", label: "Keluar" },
  { key: "ADJUST", label: "Opname" },
];

// Normalize display for any storage convention: IN always reads positive,
// OUT always reads negative, ADJUST keeps its signed delta.
function movementMeta(type: string) {
  return TYPE_META[type as MovementType] ?? FALLBACK_META;
}

function signedQuantity(row: StockMovementRow) {
  if (row.type === "IN") return `+${Math.abs(row.quantity)}`;
  if (row.type === "OUT") return `-${Math.abs(row.quantity)}`;
  return row.quantity > 0 ? `+${row.quantity}` : String(row.quantity);
}

function quantityColor(row: StockMovementRow) {
  if (row.type === "IN") return "text-emerald-600";
  if (row.type === "OUT") return "text-rose-600";
  return row.quantity > 0 ? "text-emerald-600" : "text-rose-600";
}

export function StockClient({
  products,
  rows,
}: {
  products: StockProductOption[];
  rows: StockMovementRow[];
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const handleSuccess = useCallback((message: string) => {
    setModalOpen(false);
    setBanner(message);
  }, []);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (typeFilter !== "ALL" && row.type !== typeFilter) return false;
      if (!q) return true;
      return (
        row.productName.toLowerCase().includes(q) ||
        row.sku.toLowerCase().includes(q) ||
        (row.note ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, typeFilter]);

  const countFor = (key: TypeFilter) =>
    key === "ALL" ? rows.length : rows.filter((r) => r.type === key).length;

  const canRecord = products.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari produk, SKU, atau catatan..."
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={!canRecord}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="text-base leading-none">+</span> Catat Gerakan
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((filter) => {
          const active = typeFilter === filter.key;
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setTypeFilter(filter.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {filter.label}
              <span
                className={`ml-1.5 tabular-nums ${
                  active ? "text-slate-300" : "text-slate-400"
                }`}
              >
                {countFor(filter.key)}
              </span>
            </button>
          );
        })}
      </div>

      {banner && (
        <div className="flex items-start justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          <p>{banner}</p>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="shrink-0 rounded p-1 text-emerald-600 hover:bg-emerald-100"
            aria-label="Tutup notifikasi"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {!canRecord && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Belum ada produk. Tambahkan produk dulu di menu Produk sebelum
          mencatat gerakan stok.
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {filteredRows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-slate-700">
              {rows.length === 0
                ? "Belum ada gerakan stok"
                : "Tidak ada gerakan yang cocok"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {rows.length === 0
                ? "Klik Catat Gerakan untuk mencatat stok masuk pertama kamu."
                : "Coba ubah kata kunci atau filter tipenya."}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-medium">Waktu</th>
                    <th className="px-4 py-3 font-medium">Produk</th>
                    <th className="px-4 py-3 font-medium">Tipe</th>
                    <th className="px-4 py-3 text-right font-medium">Jumlah</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Biaya Satuan
                    </th>
                    <th className="px-4 py-3 font-medium">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((row) => {
                    const meta = movementMeta(row.type);
                    return (
                      <tr key={row.id} className="transition hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                          {row.timeLabel}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">
                            {row.productName}
                          </p>
                          <p className="text-xs text-slate-400">
                            {row.sku || "tanpa SKU"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-semibold tabular-nums ${quantityColor(row)}`}
                        >
                          {signedQuantity(row)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                          {row.unitCost > 0 ? formatRupiah(row.unitCost) : "-"}
                        </td>
                        <td
                          className="max-w-[14rem] truncate px-4 py-3 text-slate-500"
                          title={row.note ?? undefined}
                        >
                          {row.note || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-slate-100 md:hidden">
              {filteredRows.map((row) => {
                const meta = movementMeta(row.type);
                return (
                  <li key={row.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {row.productName}
                        </p>
                        <p className="text-xs text-slate-400">
                          {row.sku || "tanpa SKU"}
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span
                        className={`font-semibold tabular-nums ${quantityColor(row)}`}
                      >
                        {signedQuantity(row)} unit
                      </span>
                      <span className="tabular-nums text-slate-600">
                        {row.unitCost > 0
                          ? formatRupiah(row.unitCost)
                          : "biaya -"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-slate-400">
                      <span className="whitespace-nowrap">{row.timeLabel}</span>
                      {row.note ? (
                        <span className="truncate">{row.note}</span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {modalOpen && (
        <RecordMovementModal
          products={products}
          onClose={() => setModalOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}

function RecordMovementModal({
  products,
  onClose,
  onSuccess,
}: {
  products: StockProductOption[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState<
    StockActionState,
    FormData
  >(createStockMovementAction, {});
  const [productId, setProductId] = useState("");
  const [type, setType] = useState<MovementType>("IN");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");

  const selected = products.find((p) => p.id === productId) ?? null;

  // Close automatically once the server action reports success.
  useEffect(() => {
    if (state.success) onSuccess(state.success);
  }, [state.success, onSuccess]);

  // Escape closes the modal, and background scroll is locked while open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const quantityLabel =
    type === "IN"
      ? "Jumlah masuk"
      : type === "OUT"
        ? "Jumlah keluar"
        : "Stok hasil hitung fisik";

  const parsedQty = quantity ? Number(quantity) : null;
  const adjustDelta =
    type === "ADJUST" && selected && parsedQty !== null
      ? parsedQty - selected.stock
      : null;

  const canSubmit = !pending && productId !== "" && quantity !== "";

  const unitCostDisplay = unitCost ? formatRupiah(Number(unitCost)) : "";

  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Catat gerakan stok"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Catat Gerakan Stok
            </h2>
            <p className="text-xs text-slate-500">
              Stok produk ikut diperbarui otomatis.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Tutup"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form action={formAction} className="space-y-4 px-5 py-5">
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="unitCost" value={unitCost} />

          <div>
            <label
              htmlFor="productId"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Produk
            </label>
            <select
              id="productId"
              name="productId"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              className={inputClass}
            >
              <option value="">Pilih produk...</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {product.sku || "tanpa SKU"} · stok{" "}
                  {product.stock}
                </option>
              ))}
            </select>
            {selected && (
              <p className="mt-1.5 text-xs text-slate-500">
                Stok sekarang:{" "}
                <span className="font-medium tabular-nums text-slate-700">
                  {selected.stock}
                </span>{" "}
                unit
              </p>
            )}
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Tipe gerakan
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(TYPE_META) as MovementType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                    type === t
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {TYPE_META[t].label}
                </button>
              ))}
            </div>
            {type === "ADJUST" && (
              <p className="mt-1.5 text-xs text-slate-500">
                Samakan stok sistem dengan hasil hitung fisik. Selisihnya
                dicatat otomatis.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="quantity"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              {quantityLabel}
            </label>
            <input
              id="quantity"
              name="quantity"
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={quantity}
              onChange={(event) =>
                setQuantity(event.target.value.replace(/\D/g, "").slice(0, 9))
              }
              className={`${inputClass} tabular-nums`}
            />
            {adjustDelta !== null && (
              <p className="mt-1.5 text-xs text-slate-500">
                Selisih yang akan dicatat:{" "}
                <span
                  className={`font-medium tabular-nums ${
                    adjustDelta > 0
                      ? "text-emerald-600"
                      : adjustDelta < 0
                        ? "text-rose-600"
                        : "text-slate-600"
                  }`}
                >
                  {adjustDelta > 0 ? `+${adjustDelta}` : adjustDelta} unit
                </span>
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="unitCost"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Biaya satuan{" "}
              <span className="font-normal text-slate-400">(opsional)</span>
            </label>
            <input
              id="unitCost"
              type="text"
              inputMode="numeric"
              placeholder="Rp 0"
              value={unitCostDisplay}
              onChange={(event) =>
                setUnitCost(event.target.value.replace(/\D/g, "").slice(0, 12))
              }
              className={`${inputClass} tabular-nums`}
            />
          </div>

          <div>
            <label
              htmlFor="note"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Catatan{" "}
              <span className="font-normal text-slate-400">(opsional)</span>
            </label>
            <input
              id="note"
              name="note"
              type="text"
              placeholder="Misal: belanja dari supplier A"
              className={inputClass}
            />
          </div>

          {state.error && (
            <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 ring-1 ring-rose-200">
              {state.error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-[2] rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Menyimpan..." : "Simpan Gerakan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default StockClient;
