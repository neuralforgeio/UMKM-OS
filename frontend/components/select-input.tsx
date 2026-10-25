"use client";

import type { SelectHTMLAttributes } from "react";
import { LuChevronDown } from "react-icons/lu";

export function SelectInput({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative w-full">
      <select
        {...props}
        className={`glass-input w-full cursor-pointer appearance-none rounded-xl py-2.5 pr-8 pl-3 text-xs transition-all focus:outline-none ${className}`}
      >
        {children}
      </select>
      {/* Chevron kustom: pointer-events-none supaya klik tetap sampai
          ke select (area kanan tetap bisa dipakai membuka dropdown). */}
      <LuChevronDown className="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
