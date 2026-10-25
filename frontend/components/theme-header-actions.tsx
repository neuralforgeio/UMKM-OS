"use client";

// Aksi tema untuk header tiap area (kasir / owner / dev) — v1.6.0.
// Berisi dua pintu pengganti tema:
//   1. ThemeToggle  — pil 3 pilihan (sistem/gelap/terang), ganti seketika;
//   2. tautan gear  — menuju halaman /settings berisi kartu pratinjau.
// Tema tersimpan PER PENGGUNA di localStorage (kunci "theme-<idUser>",
// v1.7.0) — tiap orang punya temanya sendiri bahkan bila berbagi satu
// browser, persis permintaan pemilik: "setiap orang punya tema
// masing-masing yang tersimpan di local machine mereka".
import Link from "next/link";
import { LuSettings2 } from "react-icons/lu";
import { ThemeToggle } from "./theme-toggle";

export function ThemeHeaderActions({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ThemeToggle />
      <Link
        href="/settings"
        title="Pengaturan tampilan (tema)"
        aria-label="Buka pengaturan tampilan"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 backdrop-blur transition-colors hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:text-white"
      >
        <LuSettings2 className="h-4 w-4" />
      </Link>
    </div>
  );
}