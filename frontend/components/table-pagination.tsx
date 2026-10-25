"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

// Shared pagination footer for owner data tables. Renders nothing
// while everything fits on one page, so adding it is always safe.
export function TablePagination({
  page,
  pageCount,
  pageSize,
  total,
  onPage,
  unit = "data",
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPage: (next: number) => void;
  unit?: string;
}) {
  if (pageCount <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // Compact page list: 1 … 4 5 6 … 12 — window of ±2 around the
  // current page, first and last page always visible.
  const items: (number | "…")[] = [];
  if (pageCount <= 7) {
    for (let i = 1; i <= pageCount; i++) items.push(i);
  } else {
    items.push(1);
    if (page > 4) items.push("…");
    for (
      let i = Math.max(2, page - 2);
      i <= Math.min(pageCount - 1, page + 2);
      i++
    ) {
      items.push(i);
    }
    if (page < pageCount - 3) items.push("…");
    items.push(pageCount);
  }

  const pageButtonClass = (active: boolean) =>
    `flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-xs font-bold tabular-nums transition ${
      active
        ? "bg-blue-600 text-white shadow-sm"
        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
    }`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Menampilkan {from}–{to} dari {total} {unit}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Halaman sebelumnya"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {items.map((item, index) =>
          item === "…" ? (
            <span
              key={`ellipsis-${index}`}
              className="px-1 text-xs font-bold text-slate-400"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPage(item)}
              className={pageButtonClass(item === page)}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          aria-label="Halaman berikutnya"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
