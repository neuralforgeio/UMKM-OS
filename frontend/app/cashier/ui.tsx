"use client";

import type { PosProduct } from "./types";
import { formatRupiah, formatThousands } from "@/lib/format";

// All money math runs in integer "sen" (1 Rp = 100 sen) to avoid float drift.
export const priceSen = (product: PosProduct) =>
  Math.round(parseFloat(product.price) * 100);
export const displayRp = (sen: number) => formatRupiah(sen / 100);

// Stable hue per category: product chips and cart avatars share the same
// color language so the eye can group items at a glance.
const CATEGORY_STYLES: Record<string, { chip: string; avatar: string }> = {
  Minuman: { chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", avatar: "bg-sky-500" },
  Makanan: { chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", avatar: "bg-amber-500" },
  Sembako: { chip: "bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300", avatar: "bg-lime-600" },
  Snack: { chip: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", avatar: "bg-rose-500" },
  Perawatan: { chip: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", avatar: "bg-violet-500" },
};
const FALLBACK = {
  chip: "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400",
  avatar: "bg-slate-400",
};

export function categoryChipClass(name: string | null): string {
  return (name && CATEGORY_STYLES[name]?.chip) || FALLBACK.chip;
}

export function categoryAvatarClass(name: string | null): string {
  return (name && CATEGORY_STYLES[name]?.avatar) || FALLBACK.avatar;
}

// Two-letter initials for the cart line avatar ("Aqua 600ml" -> "AQ").
export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((word) => word[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

// Rp text input with live "Rp 300.000" grouping. Digits only: pasting
// "300.000" or "300,000" is cleaned to 300000 before parsing.
export function MoneyInput({
  valueSen,
  onChangeSen,
  ariaLabel,
}: {
  valueSen: number;
  onChangeSen: (nextSen: number) => void;
  ariaLabel: string;
}) {
  const display = valueSen > 0 ? formatThousands(valueSen / 100) : "";

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-slate-400 dark:text-slate-500">
        Rp
      </span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        value={display}
        placeholder="0"
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 12);
          const rupiah = digits ? parseInt(digits, 10) : 0;
          onChangeSen(rupiah * 100);
        }}
        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-10 pr-3 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100 outline-none transition placeholder:font-normal placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20"
      />
    </div>
  );
}

// Percent input with a "%" suffix. Whole numbers only, clamped to 0..100.
export function PercentInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: number;
  onChange: (nextPercent: number) => void;
  ariaLabel: string;
}) {
  const display = value > 0 ? String(value) : "";

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        value={display}
        placeholder="0"
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 3);
          const percent = digits ? Math.min(100, parseInt(digits, 10)) : 0;
          onChange(percent);
        }}
        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-3 pr-9 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100 outline-none transition placeholder:font-normal placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20"
      />
      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-sm font-semibold text-slate-400 dark:text-slate-500">
        %
      </span>
    </div>
  );
}