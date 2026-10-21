"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  Loader2,
  PackagePlus,
  Search,
  X,
} from "lucide-react";
import { formatRupiah, formatThousands } from "@/lib/format";
import { createStockMovementAction, type StockActionState } from "./actions";

export type StockProductOption = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  minStock: number;
  unit: string;
  costRupiah: number;
};

export type StockMovementRow = {
  id: string;
  productName: string;
  sku: string;
  unit: string;
  type: string;
  quantity: number;
  unitCostRupiah: number | null;
  note: string | null;
  userName: string | null;
  timeLabel: string;
};

type MovementType = "IN" | "ADJUST";
type TypeFilter = "ALL" | "IN" | "SALE" | "ADJUST";

const TYPE_META: Record<string, { label: string; badge: string }> = {
  IN: {
    label: "Masuk",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  },
  SALE: {
    label: "Penjualan",
    badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  },
  ADJUST: {
    label: "Opname",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  },
};

const FILTERS: { key: TypeFilter; label: string }[] = [
  { key: "ALL", label: "Semua" },
  { key: "IN", label: "Masuk" },
  { key: "SALE", label: "Penjualan" },
  { key: "ADJUST", label: "Opname" },
];

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

function typeMeta(type: string) {
  return (
    TYPE_META[type] ?? {
      label: type,
      badge: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    }
  );
}

// Display follows the blueprint convention: quantity is stored positive
// and the type decides the direction. Opname keeps its signed delta in
// the note, so the magnitude gets a plus-minus marker here.
function signedQuantity(row: StockMovementRow) {
  if (row.type === "IN") return `+${row.quantity}`;
  if (row.type === "SALE") return `-${row.quantity}`;
  return `±${row.quantity}`;
}

function quantityColor(row: StockMovementRow) {
  if (row.type === "IN") return "text-emerald-600";
  if (row.type === "SALE") return "text-rose-600";
  return "text-amber-600";
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
  const [prefill, setPrefill] = useState<{
    productId: string;
    type: MovementType;
  } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  // Same formula as the dashboard widget: enough units to reach twice
  // the minimum, at least one.
  const suggestionFor = (product: StockProductOption) =>
    Math.max(product.minStock * 2 - product.stock, 1);

  const lowStock = useMemo(
    () => products.filter((product) => product.stock <= product.minStock),
    [products],
  );

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
    key === "ALL" ? rows.length : rows.filter((row) => row.type === key).length;

  const openModal = (productId: string, type: MovementType) => {
    setPrefill({ productId, type });
    setModalOpen(true);
  };

  const handleSuccess = useCallback((message: string) => {
    setModalOpen(false);
    setPrefill(null);
    setBanner(message);
  }, []);

  const canRecord = products.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari produk, SKU, atau catatan..."
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>
        <button
          type="button"
          onClick={() => openModal("", "IN")}
          disabled={!canRecord}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PackagePlus className="h-4 w-4" />
          Catat Gerakan
        </button>
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-900">
              Perlu Restok — {lowStock.length} produk di bawah batas minimum
            </h2>
          </div>
          <ul className="mt-2 divide-y divide-amber-100">
            {lowStock.map((product) => (
              <li
                key={product.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-amber-950">
                    {product.name}
                  </p>
                  <p className="text-xs text-amber-700">
                    {product.sku} · sisa {product.stock} {product.unit} · min{" "}
                    {product.minStock}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openModal(product.id, "IN")}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-500"
                >
                  <PackagePlus className="h-3.5 w-3.5" />
                  Restok +{suggestionFor(product)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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
            className="shrink-0 rounded p-1 text-emerald-600 transition hover:bg-emerald-100"
            aria-label="Tutup notifikasi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {!canRecord && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Belum ada produk aktif. Tambahkan produk dulu di menu Produk sebelum
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
                ? "Klik Catat Gerakan untuk mencatat restok pertama kamu."
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
                    const meta = typeMeta(row.type);
                    return (
                      <tr key={row.id} className="transition hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                          <p>{row.timeLabel}</p>
                          {row.userName && (
                            <p className="text-xs text-slate-400">
                              oleh {row.userName}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">
                            {row.productName}
                          </p>
                          <p className="text-xs text-slate-400">{row.sku}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td
                          className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${quantityColor(row)}`}
                        >
                          {signedQuantity(row)}{" "}
                          <span className="text-xs font-normal text-slate-400">
                            {row.unit}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600">
                          {row.unitCostRupiah
                            ? formatRupiah(row.unitCostRupiah)
                            : "-"}
                        </td>
                        <td
                          className="max-w-[16rem] truncate px-4 py-3 text-slate-500"
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
                const meta = typeMeta(row.type);
                return (
                  <li key={row.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {row.productName}
                        </p>
                        <p className="text-xs text-slate-400">{row.sku}</p>
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
                        {signedQuantity(row)} {row.unit}
                      </span>
                      <span className="tabular-nums text-slate-600">
                        {row.unitCostRupiah
                          ? formatRupiah(row.unitCostRupiah)
                          : "biaya -"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-slate-400">
                      <span className="whitespace-nowrap">
                        {row.timeLabel}
                        {row.userName ? ` · ${row.userName}` : ""}
                      </span>
                      {row.note && <span className="truncate">{row.note}</span>}
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
          initialProductId={prefill?.productId ?? ""}
          initialType={prefill?.type ?? "IN"}
          onClose={() => {
            setModalOpen(false);
            setPrefill(null);
          }}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}

function RecordMovementModal({
  products,
  initialProductId,
  initialType,
  onClose,
  onSuccess,
}: {
  products: StockProductOption[];
  initialProductId: string;
  initialType: MovementType;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState<
    StockActionState,
    FormData
  >(createStockMovementAction, {});
  const [productId, setProductId] = useState(initialProductId);
  const [type, setType] = useState<MovementType>(initialType);
  const [quantity, setQuantity] = useState("");
  const initialProduct = products.find(
    (product) => product.id === initialProductId,
  );
  const [unitCost, setUnitCost] = useState(
    initialProduct && initialProduct.costRupiah > 0
      ? String(initialProduct.costRupiah)
      : "",
  );

  const selected = products.find((product) => product.id === productId) ?? null;

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

  const onProductChange = (id: string) => {
    setProductId(id);
    // Prefill the cost with the known purchase cost; the owner only
    // adjusts it when the supplier price actually changed.
    const product = products.find((item) => item.id === id);
    setUnitCost(
      product && product.costRupiah > 0 ? String(product.costRupiah) : "",
    );
  };

  const parsedQty = quantity ? Number(quantity) : null;
  const stockAfter =
    selected && parsedQty !== null && type === "IN"
      ? selected.stock + parsedQty
      : null;
  const adjustDelta =
    selected && parsedQty !== null && type === "ADJUST"
      ? parsedQty - selected.stock
      : null;

  const canSubmit = !pending && productId !== "" && quantity !== "";
  const costDisplay = unitCost ? formatThousands(Number(unitCost)) : "";

  const quantityLabel =
    type === "IN" ? "Jumlah masuk" : "Stok hasil hitung fisik";

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
            <X className="h-4 w-4" />
          </button>
        </div>

        <form action={formAction} className="space-y-4 px-5 py-5">
          <input type="hidden" name="type" value={type} />
          <input
            type="hidden"
            name="unitCost"
            value={type === "IN" ? unitCost : ""}
          />

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
              onChange={(event) => onProductChange(event.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Pilih produk...</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · stok {product.stock} {product.unit}
                </option>
              ))}
            </select>
            {selected && (
              <p className="mt-1.5 text-xs text-slate-500">
                Stok sekarang:{" "}
                <span className="font-medium tabular-nums text-slate-700">
                  {selected.stock} {selected.unit}
                </span>{" "}
                · batas minimum {selected.minStock}
              </p>
            )}
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Tipe gerakan
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType("IN")}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  type === "IN"
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <PackagePlus className="h-4 w-4" />
                Restok
              </button>
              <button
                type="button"
                onClick={() => setType("ADJUST")}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  type === "ADJUST"
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <ClipboardCheck className="h-4 w-4" />
                Opname
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              {type === "IN"
                ? "Barang masuk dari supplier atau pembelian."
                : "Samakan stok sistem dengan hasil hitung fisik. Selisihnya dicatat otomatis."}
            </p>
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
                setQuantity(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className={`${INPUT_CLASS} tabular-nums`}
            />
            {stockAfter !== null && (
              <p className="mt-1.5 text-xs text-slate-500">
                Stok setelah dicatat:{" "}
                <span className="font-medium tabular-nums text-emerald-700">
                  {stockAfter} {selected?.unit}
                </span>
              </p>
            )}
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
                  {adjustDelta > 0 ? `+${adjustDelta}` : adjustDelta}{" "}
                  {selected?.unit}
                </span>
              </p>
            )}
          </div>

          {type === "IN" && (
            <div>
              <label
                htmlFor="unitCost"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Biaya satuan{" "}
                <span className="font-normal text-slate-400">(opsional)</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
                  Rp
                </span>
                <input
                  id="unitCost"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={costDisplay}
                  onChange={(event) =>
                    setUnitCost(
                      event.target.value.replace(/\D/g, "").slice(0, 12),
                    )
                  }
                  className={`${INPUT_CLASS} pl-10 text-right font-semibold tabular-nums`}
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Tersimpan sebagai snapshot biaya untuk laporan laba.
              </p>
            </div>
          )}

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
              maxLength={200}
              placeholder="Misal: belanja dari supplier A"
              className={INPUT_CLASS}
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
              className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending ? "Menyimpan..." : "Simpan Gerakan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default StockClient;
