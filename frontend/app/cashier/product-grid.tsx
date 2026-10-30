/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Package, Plus, Search, X } from "lucide-react";
import type { PosProduct } from "./types";
import {
  categoryAvatarClass,
  categoryChipClass,
  displayRp,
  initialsOf,
  priceSen,
} from "./ui";

const PAGE_SIZE = 16;

type ProductGridProps = {
  products: PosProduct[];
  cartQty: Record<string, number>;
  onAdd: (productId: string) => void;
};

function ProductCard({
  product,
  qty,
  onAdd,
}: {
  product: PosProduct;
  qty: number;
  onAdd: (productId: string) => void;
}) {
  const soldOut = product.stock <= 0;
  const lowStock = !soldOut && product.stock <= product.minStock;

  return (
    // No fixed height, no overflow-hidden, no min-h-0 here: the card
    // grows with its content and the grid row grows with the card, so
    // a long product name can never be clipped again.
    // Seluruh kartu adalah tombol (target sentuh besar untuk kasir);
    // chip "+" di baris harga hanyalah petunjuk visual, bukan tombol
    // terpisah — pola "quick add" arahan desain POS.
    <button
      type="button"
      disabled={soldOut}
      onClick={() => onAdd(product.id)}
      className={`group relative flex h-full flex-col rounded-xl border p-2.5 text-left transition active:scale-[0.98] lg:p-3 ${
        soldOut
          ? "cursor-not-allowed border-slate-200 opacity-55 dark:border-slate-800"
          : qty > 0
            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700"
      }`}
    >
      {qty > 0 && (
        <span className="absolute top-1.5 right-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {qty}
        </span>
      )}
      <span className="mb-2 block aspect-square w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
        {product.thumbImageId ? (
          <img
            src={`/api/images/${product.thumbImageId}`}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            className={`flex h-full w-full items-center justify-center text-xl font-bold text-white/90 ${categoryAvatarClass(product.categoryName)}`}
          >
            {initialsOf(product.name)}
          </span>
        )}
      </span>
      <span
        className={`line-clamp-2 text-[13px] font-semibold leading-snug text-slate-900 dark:text-slate-100 lg:text-sm ${
          qty > 0 ? "pr-6" : "pr-1"
        }`}
      >
        {product.name}
      </span>
      {/* SKU tampil sebagai chip huruf besar ala komponen POS desain
          (LAT, AME, MAT, ...) — identitas cepat bagi kasir. */}
      {product.sku ? (
        <span className="mt-1 inline-block w-fit rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-slate-500 uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          {product.sku}
        </span>
      ) : null}
      <div className="mt-auto flex items-end justify-between gap-1 pt-2">
        <span className="text-[13px] font-bold text-slate-900 dark:text-slate-100 lg:text-sm">
          {displayRp(priceSen(product))}
        </span>
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
            soldOut
              ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600"
              : qty > 0
                ? "bg-primary text-primary-foreground"
                : "bg-slate-100 text-slate-500 group-hover:bg-primary group-hover:text-primary-foreground dark:bg-slate-800 dark:text-slate-400"
          }`}
          aria-hidden
        >
          <Plus className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-1 border-t border-slate-100 pt-1.5 dark:border-slate-800">
        {product.categoryName ? (
          <span
            className={`truncate rounded-full px-1.5 py-0.5 text-[10px] font-medium ${categoryChipClass(product.categoryName)}`}
          >
            {product.categoryName}
          </span>
        ) : (
          <span />
        )}
        <span
          className={`shrink-0 text-[10px] font-semibold ${
            soldOut
              ? "text-red-600 dark:text-red-400"
              : lowStock
                ? "text-amber-600 dark:text-amber-400"
                : "text-slate-400 dark:text-slate-500"
          }`}
        >
          {soldOut ? "Habis" : `stok ${product.stock}`}
        </span>
      </div>
    </button>
  );
}

export function ProductGrid({ products, cartQty, onAdd }: ProductGridProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const product of products) {
      if (product.categoryName && !seen.includes(product.categoryName)) {
        seen.push(product.categoryName);
      }
    }
    return seen;
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      if (category && product.categoryName !== category) return false;
      if (!q) return true;
      return (
        product.name.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q)
      );
    });
  }, [products, query, category]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const placeholderCount = filtered.length > 0 ? PAGE_SIZE - paged.length : 0;

  const resetFilters = () => {
    setQuery("");
    setCategory(null);
    setPage(1);
  };

  return (
    <section className="glass-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl">
      {/* Toolbar: overline + hitungan, pencarian, paginasi, lalu pil kategori. */}
      <div className="shrink-0 border-b border-slate-100 p-3 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex shrink-0 items-baseline gap-1.5 text-overline text-muted-foreground">
            <Package className="h-3.5 w-3.5 translate-y-px" />
            Pilih Produk
            <span className="font-sans text-xs font-bold tracking-normal normal-case text-slate-500 dark:text-slate-400">
              · {filtered.length}
            </span>
          </h2>
          <div className="relative min-w-40 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama, SKU, atau barcode..."
              className="glass-input w-full rounded-xl py-2 pr-9 pl-9 text-sm outline-none transition"
            />
            {query && (
              <button
                type="button"
                aria-label="Bersihkan pencarian"
                onClick={() => {
                  setQuery("");
                  setPage(1);
                }}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label="Halaman sebelumnya"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {totalPages <= 5 ? (
                Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`h-8 w-8 rounded-lg text-xs font-bold tabular-nums transition ${
                      n === currentPage
                        ? "bg-primary text-primary-foreground"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {n}
                  </button>
                ))
              ) : (
                <span className="px-2 text-xs font-bold tabular-nums text-slate-600 dark:text-slate-400">
                  {currentPage} / {totalPages}
                </span>
              )}
              <button
                type="button"
                aria-label="Halaman berikutnya"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {categories.length > 0 && (
          <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => {
                setCategory(null);
                setPage(1);
              }}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition ${
                category === null
                  ? "bg-slate-900 text-primary-foreground dark:bg-slate-100 dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              Semua
            </button>
            {categories.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setCategory(name === category ? null : name);
                  setPage(1);
                }}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition ${
                  category === name
                    ? "bg-slate-900 text-primary-foreground dark:bg-slate-100 dark:text-slate-900"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 p-10 text-center dark:border-slate-800">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
              <Package className="h-6 w-6 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
              Tidak ada produk yang cocok
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Coba ubah kata kunci atau kategori.
            </p>
            {(query || category) && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-3 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Hapus filter
              </button>
            )}
          </div>
        ) : (
          // Desktop: 4x4 grid stretched to the panel, every row keeping
          // its content as the minimum height (minmax(auto,1fr)); the
          // area scrolls when the viewport is genuinely too short.
          // Mobile: 2-3 columns, natural card heights.
          <div className="grid grid-cols-2 content-start gap-2.5 sm:grid-cols-3 lg:h-full lg:grid-cols-4 lg:[grid-template-rows:repeat(4,minmax(auto,1fr))] lg:gap-3">
            {paged.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                qty={cartQty[product.id] ?? 0}
                onAdd={onAdd}
              />
            ))}
            {Array.from({ length: placeholderCount }).map((_, i) => (
              <div
                key={`slot-${i}`}
                aria-hidden="true"
                className="hidden rounded-xl border border-dashed border-slate-200 lg:block dark:border-slate-800"
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
