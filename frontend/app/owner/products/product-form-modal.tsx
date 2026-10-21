"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Boxes, ChevronLeft, Loader2, X } from "lucide-react";
import { saveProduct } from "./actions";
import type { CategoryOption, ProductRow } from "./types";

type ProductFormModalProps = {
  // null = create a new product, a row = edit that product.
  product: ProductRow | null;
  categories: CategoryOption[];
  onClose: () => void;
};

// Digit-only sanitizing: typing or pasting "Rp 5.000" becomes "5000".
const digits = (value: string, max: number) =>
  value.replace(/\D/g, "").slice(0, max);

const LABEL_CLASS =
  "text-xs font-semibold uppercase tracking-wide text-slate-500";
const INPUT_CLASS =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

// Rp text field: right-aligned tabular digits with a fixed "Rp" prefix,
// the same money-entry language as the cashier panel.
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
        value={value}
        placeholder={placeholder ?? "0"}
        onChange={(event) => onChange(digits(event.target.value, 10))}
        className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-right text-sm font-semibold tabular-nums text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

// Plain integer field (stock, minimum stock) without the Rp prefix.
function QtyInput({
  id,
  value,
  onChange,
  max,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  max: number;
}) {
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value}
      placeholder="0"
      onChange={(event) => onChange(digits(event.target.value, max))}
      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-right text-sm font-semibold tabular-nums text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
    />
  );
}

export function ProductFormModal({
  product,
  categories,
  onClose,
}: ProductFormModalProps) {
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [useNewCategory, setUseNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [price, setPrice] = useState(
    product ? String(product.priceRupiah) : "",
  );
  const [cost, setCost] = useState(product ? String(product.costRupiah) : "");
  const [unit, setUnit] = useState(product?.unit ?? "pcs");
  const [stock, setStock] = useState(product ? String(product.stock) : "0");
  const [minStock, setMinStock] = useState(
    product ? String(product.minStock) : "5",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleCategorySelect = (value: string) => {
    if (value === "__new__") {
      setUseNewCategory(true);
      return;
    }
    setCategoryId(value);
  };

  const submit = () => {
    setError(null);

    const trimmedName = name.trim();
    const trimmedSku = sku.trim().toUpperCase();
    const trimmedUnit = unit.trim() || "pcs";
    const trimmedCategory = newCategoryName.trim();
    const priceRp = price ? parseInt(price, 10) : 0;
    const costRp = cost ? parseInt(cost, 10) : 0;
    const stockQty = stock ? parseInt(stock, 10) : 0;
    const minStockQty = minStock ? parseInt(minStock, 10) : 0;

    if (!trimmedName) {
      setError("Nama produk wajib diisi.");
      return;
    }
    if (!/^[A-Z0-9-]{2,32}$/.test(trimmedSku)) {
      setError(
        "SKU wajib 2-32 karakter: huruf besar, angka, atau tanda hubung.",
      );
      return;
    }
    if (useNewCategory && !trimmedCategory) {
      setError("Nama kategori baru wajib diisi.");
      return;
    }
    if (priceRp <= 0) {
      setError("Harga jual harus lebih dari 0.");
      return;
    }
    if (costRp < 0) {
      setError("Harga beli tidak boleh negatif.");
      return;
    }
    if (stockQty < 0 || minStockQty < 0) {
      setError("Stok tidak boleh negatif.");
      return;
    }

    startTransition(async () => {
      const result = await saveProduct({
        id: product?.id,
        name: trimmedName,
        sku: trimmedSku,
        categoryId: useNewCategory ? null : categoryId || null,
        newCategoryName: useNewCategory ? trimmedCategory : null,
        priceRupiah: priceRp,
        costRupiah: costRp,
        unit: trimmedUnit,
        stock: stockQty,
        minStock: minStockQty,
      });
      if (result.ok) {
        onClose();
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
      aria-label={product ? `Ubah produk ${product.name}` : "Produk baru"}
    >
      <div
        className="absolute inset-0 bg-slate-900/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Boxes className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold leading-tight text-slate-900">
                {product ? "Ubah Produk" : "Produk Baru"}
              </h2>
              <p className="truncate text-xs text-slate-500">
                {product
                  ? product.sku
                  : "Tambahkan barang yang dijual di warung"}
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
            <div>
              <label htmlFor="product-name" className={LABEL_CLASS}>
                Nama Produk
              </label>
              <input
                ref={firstFieldRef}
                id="product-name"
                type="text"
                autoComplete="off"
                value={name}
                onChange={(event) => setName(event.target.value.slice(0, 100))}
                placeholder="Contoh: Beras Pandan Wangi 5kg"
                className={`mt-1 ${INPUT_CLASS}`}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="product-sku" className={LABEL_CLASS}>
                  SKU
                </label>
                <input
                  id="product-sku"
                  type="text"
                  autoComplete="off"
                  value={sku}
                  onChange={(event) =>
                    setSku(
                      event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9-]/g, "")
                        .slice(0, 32),
                    )
                  }
                  placeholder="BRG-001"
                  className={`mt-1 font-mono ${INPUT_CLASS}`}
                />
              </div>
              <div>
                <label htmlFor="product-unit" className={LABEL_CLASS}>
                  Satuan
                </label>
                <input
                  id="product-unit"
                  type="text"
                  autoComplete="off"
                  value={unit}
                  onChange={(event) =>
                    setUnit(event.target.value.trim().slice(0, 16))
                  }
                  placeholder="pcs"
                  className={`mt-1 ${INPUT_CLASS}`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="product-category" className={LABEL_CLASS}>
                Kategori
              </label>
              {useNewCategory ? (
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id="product-category"
                    type="text"
                    autoComplete="off"
                    value={newCategoryName}
                    onChange={(event) =>
                      setNewCategoryName(event.target.value.slice(0, 50))
                    }
                    placeholder="Nama kategori baru"
                    className={`flex-1 ${INPUT_CLASS}`}
                  />
                  <button
                    type="button"
                    onClick={() => setUseNewCategory(false)}
                    className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Pilih lama
                  </button>
                </div>
              ) : (
                <select
                  id="product-category"
                  value={categoryId}
                  onChange={(event) => handleCategorySelect(event.target.value)}
                  className={`mt-1 ${INPUT_CLASS}`}
                >
                  <option value="">Tanpa kategori</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                  <option value="__new__">+ Kategori baru…</option>
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="product-price" className={LABEL_CLASS}>
                  Harga Jual
                </label>
                <RpInput
                  id="product-price"
                  value={price}
                  onChange={setPrice}
                  placeholder="68000"
                />
              </div>
              <div>
                <label htmlFor="product-cost" className={LABEL_CLASS}>
                  Harga Beli
                </label>
                <RpInput
                  id="product-cost"
                  value={cost}
                  onChange={setCost}
                  placeholder="55000"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="product-stock" className={LABEL_CLASS}>
                  Stok Saat Ini
                </label>
                <QtyInput
                  id="product-stock"
                  value={stock}
                  onChange={setStock}
                  max={6}
                />
              </div>
              <div>
                <label htmlFor="product-min-stock" className={LABEL_CLASS}>
                  Stok Minimum
                </label>
                <QtyInput
                  id="product-min-stock"
                  value={minStock}
                  onChange={setMinStock}
                  max={5}
                />
                <p className="mt-1 text-[11px] leading-tight text-slate-400">
                  Stok sama atau di bawah angka ini ditandai perlu restok.
                </p>
              </div>
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
              {isPending ? "Menyimpan…" : "Simpan Produk"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
