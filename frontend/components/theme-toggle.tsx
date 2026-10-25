"use client";

// Toggle tema ringan (v1.3.0): tiga pilihan — Sistem / Gelap / Terang.
// Pil aktif meluncur mulus berkat framer-motion layoutId.
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { LuMonitor, LuMoon, LuSun } from "react-icons/lu";

const OPTIONS = [
  { value: "system", label: "Ikut sistem", icon: LuMonitor },
  { value: "dark", label: "Mode gelap", icon: LuMoon },
  { value: "light", label: "Mode terang", icon: LuSun },
] as const;

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes baru tahu tema sesungguhnya setelah hidrasi — render
  // placeholder statis dulu supaya HTML server & klien identik.
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        aria-hidden
        className={`h-9 w-[104px] animate-pulse rounded-full border border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-900/70 ${className}`}
      />
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Pilih tema tampilan"
      className={`flex items-center gap-0.5 rounded-full border border-slate-200 bg-white/80 p-1 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 ${className}`}
    >
      {OPTIONS.map((opt) => {
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.label}
            onClick={() => setTheme(opt.value)}
            className="relative flex h-7 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          >
            {active && (
              <motion.span
                layoutId="theme-pill"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="absolute inset-0 rounded-full bg-blue-600/10 ring-1 ring-blue-500/40 dark:bg-blue-500/20"
              />
            )}
            <opt.icon className="relative h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
