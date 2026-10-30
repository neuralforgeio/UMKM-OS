"use client";

// Toggle tema ringan (v3.1.0 restyling): tiga pilihan — Sistem / Gelap /
// Terang. Mekanisme TIDAK berubah: next-themes menulis ke kunci
// per-pengguna "theme-<idUser>" (lihat lib/theme-storage.ts) dan tema
// hanya boleh hidup di halaman login (pra-autentikasi) + /settings —
// dijaga tests/navbar-profile.test.ts.
// Tampilan mengikuti design system baru: pil putih datar bergaris tepi
// (tanpa blur), pilihan aktif memakai tint indigo + ring tipis.
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
        className={`h-9 w-[104px] animate-pulse rounded-full border border-border bg-surface ${className}`}
      />
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Pilih tema tampilan"
      className={`flex items-center gap-0.5 rounded-full border border-border bg-surface p-1 ${className}`}
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
            className="relative flex h-7 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
          >
            {active && (
              <motion.span
                layoutId="theme-pill"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="absolute inset-0 rounded-full bg-primary/10 ring-1 ring-primary/35"
              />
            )}
            <opt.icon
              className={`relative h-3.5 w-3.5 ${active ? "text-primary" : ""}`}
            />
          </button>
        );
      })}
    </div>
  );
}
