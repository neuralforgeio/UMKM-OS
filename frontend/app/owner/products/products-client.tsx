/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Boxes,
  Camera,
  Loader2,
  Package,
  PackagePlus,
  Pencil,
  Search,
  X,
} from "lucide-react";
import { formatRupiah } from "@/lib/format";
import {
  categoryAvatarClass,
  categoryChipClass,
  initialsOf,
} from "../../cashier/ui";
import { toggleProductActive } from "./actions";
import { ImageManagerModal } from "./image-manager-modal";
import { ProductFormModal } from "./product-form-modal";
import type { CategoryOption, ProductRow } from "./types";

const STATUS_TABS = [
  { key: "ALL", label: "Semua" },
  { key: "ACTIVE", label: "Aktif" },
  { key: "ARCHIVED", label: "Arsip" },
] as const;

type StatusFilter = (typeof STATUS_TABS)[number]["key"];

// One shared grid template for the header row and every product row so
// the desktop columns stay perfectly aligned.
const ROW_GRID =
  "lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.7fr)_auto]";

function StockBadge({ product }: { product: ProductRow }) {
  if (product.stock <= 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">
        Habis
      </span>
    );
  }
  if (product.stock <= product.minStock) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold tabular-nums text-amber-700">
        {product.stock} {product.unit} · menipis
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold tabular-nums text-slate-600">
      {product.stock} {product.unit}
    </span>
  );
}

// Product identity tile: the chosen photo when one exists, otherwise
// the colored category initials — the same fallback language as the POS.
function ProductAvatar({ product }: { product: ProductRow }) {
  if (product.thumbImageId) {
    return (
      <img
        src={`/api/images/${product.thumbImageId}`}
        alt=""
        loading="lazy"
        className="h-10 w-10 shrink-0 rounded-lg object-cover"
      />
    );
  }
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white ${categoryAvatarClass(product.categoryName)}`}
    >
      {initialsOf(product.name)}
    </div>
  );
}

function ProductRowItem({
  product,
  toggling,
  onEdit,
  onToggle,
  onManagePhotos,
}: {
  product: ProductRow;
  toggling: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onManagePhotos: () => void;
}) {
  return (
    // Mobile: a two-column mini-grid that stacks identity, meta pairs and
    // actions. Desktop: the shared seven-column table grid.
    <li
      className={`grid grid-cols-2 items-center gap-x-3 gap-y-2 px-4 py-3 lg:gap-3 lg:py-2.5 ${ROW_GRID} ${
        product.isActive ? "" : "bg-slate-50/60"
      }`}
    >
      <div className="col-span-2 flex min-w-0 items-center gap-2.5 lg:col-span-1">
        <ProductAvatar product={product} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {product.name}
            {!product.isActive && (
              <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 align-middle text-[10px] font-bold text-slate-500">
                Arsip
              </span>
            )}
          </p>
          <p className="truncate font-mono text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {product.sku}
          </p>
        </div>
      </div>

      <div className="min-w-0">
        {product.categoryName ? (
          <span
            className={`inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryChipClass(product.categoryName)}`}
          >
            {product.categoryName}
          </span>
        ) : (
          <span className="text-[11px] text-slate-300">—</span>
        )}
      </div>

      <p className="text-right text-sm font-bold tabular-nums text-blue-600">
        <span className="mr-1 text-[11px] font-semibold text-slate-400 lg:hidden">
          Jual{" "}
        </span>
        {formatRupiah(product.priceRupiah)}
      </p>

      <p className="text-left text-[13px] tabular-nums text-slate-500 lg:text-right">
        <span className="mr-1 text-[11px] font-semibold text-slate-400 lg:hidden">
          Beli{" "}
        </span>
        {formatRupiah(product.costRupiah)}
      </p>

      <div className="justify-self-end lg:justify-self-start">
        <StockBadge product={product} />
      </div>

      <p className="text-xs font-semibold tabular-nums text-slate-500">
        {product.soldLast30Days > 0 ? (
          <>
            {product.soldLast30Days}{" "}
            <span className="font-normal text-slate-400">{product.unit}</span>
          </>
        ) : (
          <span className="font-normal text-slate-300">—</span>
        )}
      </p>

      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={onManagePhotos}
          aria-label={`Foto ${product.name}`}
          title="Kelola foto produk"
          className={`relative flex h-8 w-8 items-center justify-center rounded-lg border transition hover:bg-slate-50 ${
            product.images.length > 0
              ? "border-blue-300 text-blue-600"
              : "border-slate-300 text-slate-600"
          }`}
        >
          <Camera className="h-3.5 w-3.5" />
          {product.images.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-0.5 text-[9px] font-bold text-white shadow">
              {product.images.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Ubah ${product.name}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-50"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          disabled={toggling}
          aria-label={
            product.isActive
              ? `Arsipkan ${product.name}`
              : `Aktifkan kembali ${product.name}`
          }
          className={`flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-40 ${
            product.isActive
              ? "border-slate-300 text-red-500 hover:bg-red-50"
              : "border-slate-300 text-emerald-600 hover:bg-emerald-50"
          }`}
        >
          {toggling ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : product.isActive ? (
            <Archive className="h-3.5 w-3.5" />
          ) : (
            <ArchiveRestore className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </li>
  );
}

export function ProductsClient({
  outletName,
  products,
  categories,
}: {
  outletName: string;
  products: ProductRow[];
  categories: CategoryOption[];
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  // undefined = closed, null = create, a row = edit that product.
  const [editing, setEditing] = useState<ProductRow | null | undefined>(
    undefined,
  );
  // Product whose photo manager modal is open (kept as an id and
  // re-resolved from the fresh list so uploads show up immediately).
  const [managingId, setManagingId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryId && product.categoryId !== categoryId) return false;
      if (status === "ACTIVE" && !product.isActive) return false;
      if (status === "ARCHIVED" && product.isActive) return false;
      if (!q) return true;
      return (
        product.name.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q)
      );
    });
  }, [products, query, categoryId, status]);

  const summary = useMemo(() => {
    const active = products.filter((product) => product.isActive);
    const low = active.filter((product) => product.stock <= product.minStock);
    // Stock value at purchase cost: what the shelves are worth.
    const stockValue = products.reduce(
      (sum, product) => sum + product.stock * product.costRupiah,
      0,
    );
    return {
      activeCount: active.length,
      archivedCount: products.length - active.length,
      lowCount: low.length,
      stockValue,
    };
  }, [products]);

  const hasFilters =
    query.trim() !== "" || categoryId !== null || status !== "ALL";

  // Resolve the managed product from the live list: router.refresh()
  // after each mutation re-renders the page, so uploads appear here
  // without closing the modal.
  const managing = managingId
    ? products.find((product) => product.id === managingId)
    : undefined;

  const resetFilters = () => {
    setQuery("");
    setCategoryId(null);
    setStatus("ALL");
  };

  const handleToggle = (product: ProductRow) => {
    setListError(null);
    setTogglingId(product.id);
    startTransition(async () => {
      const result = await toggleProductActive(product.id, !product.isActive);
      if (!result.ok) setListError(result.error);
      setTogglingId(null);
    });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-slate-100">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Boxes className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight text-slate-900">
                Manajemen Produk — {outletName}
              </h1>
              <p className="truncate text-xs text-slate-500">
                {summary.activeCount} produk aktif · {summary.archivedCount}{" "}
                arsip
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <PackagePlus className="h-4 w-4" />
              <span className="hidden sm:inline">Produk Baru</span>
              <span className="sm:hidden">Baru</span>
            </button>
            <Link
              href="/owner"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
              <span className="sm:hidden">Kembali</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 sm:py-6">
        <section className="rounded-2xl bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-44 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari nama produk atau SKU..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Bersihkan pencarian"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatus(tab.key)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    status === tab.key
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {categories.length > 0 && (
            <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setCategoryId(null)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition ${
                  categoryId === null
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Semua
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    setCategoryId(
                      category.id === categoryId ? null : category.id,
                    )
                  }
                  className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition ${
                    categoryId === category.id
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {summary.activeCount} aktif
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              {summary.archivedCount} arsip
            </span>
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              {summary.lowCount} perlu restok
            </span>
            <span className="ml-auto font-semibold text-slate-700">
              Nilai stok (harga beli) {formatRupiah(summary.stockValue)}
            </span>
          </div>
        </section>

        {listError && (
          <div
            role="alert"
            className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {listError}
          </div>
        )}

        <section className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                <Package className="h-7 w-7 text-slate-400" />
              </div>
              <p className="mt-3 text-sm font-medium text-slate-500">
                Tidak ada produk yang cocok
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Coba ubah kata kunci, kategori, atau status.
              </p>
              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-3 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Hapus filter
                </button>
              )}
            </div>
          ) : (
            <>
              <div
                className={`hidden lg:grid ${ROW_GRID} gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400`}
              >
                <span>Produk</span>
                <span>Kategori</span>
                <span className="text-right">Harga Jual</span>
                <span className="text-right">Harga Beli</span>
                <span>Stok</span>
                <span>Terjual 30 Hari</span>
                <span className="text-right">Aksi</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {filtered.map((product) => (
                  <ProductRowItem
                    key={product.id}
                    product={product}
                    toggling={togglingId === product.id}
                    onEdit={() => setEditing(product)}
                    onToggle={() => handleToggle(product)}
                    onManagePhotos={() => setManagingId(product.id)}
                  />
                ))}
              </ul>
            </>
          )}
        </section>
      </main>

      {editing !== undefined && (
        <ProductFormModal
          product={editing}
          categories={categories}
          onClose={() => setEditing(undefined)}
        />
      )}

      {managing && (
        <ImageManagerModal
          product={managing}
          onClose={() => setManagingId(null)}
        />
      )}
    </div>
  );
}
