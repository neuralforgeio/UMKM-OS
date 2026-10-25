"use client";

// Pemilih tema (v1.3.0): System (default) / Gelap / Terang.
// Kartu berisi PRATINJAU tampilan yang sebenarnya — pengguna melihat
// bedanya sebelum mengeklik. Terapkan seketika lewat next-themes.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import {
  LuArrowLeft,
  LuCheck,
  LuMonitor,
  LuMoon,
  LuSparkles,
  LuSun,
} from "react-icons/lu";
import { AuroraBackground } from "@/components/aurora-background";

type ThemeOption = "system" | "dark" | "light";

const OPTIONS: {
  value: ThemeOption;
  label: string;
  desc: string;
  icon: typeof LuMonitor;
}[] = [
  {
    value: "system",
    label: "Gunakan Pengaturan Sistem",
    desc: "Otomatis mengikuti tema perangkat — berganti sendiri saat perangkat berganti.",
    icon: LuMonitor,
  },
  {
    value: "dark",
    label: "Mode Gelap",
    desc: "Cocok untuk jadwal malam dan ruangan remang — hemat mata & baterai.",
    icon: LuMoon,
  },
  {
    value: "light",
    label: "Mode Terang",
    desc: "Klasik dan kontras tinggi untuk siang hari di terik warung.",
    icon: LuSun,
  },
];

// Mockup jendela mini — masing-masing kartu memperlihatkan tema pilihannya.
function ThemePreview({ mode }: { mode: ThemeOption }) {
  const dark = mode === "dark";
  const light = mode === "light";
  return (
    <div
      className={`relative h-24 w-full overflow-hidden rounded-xl border ${
        dark ? "border-slate-800" : "border-slate-300"
      }`}
    >
      {/* mode "system" = dua belahan terang/gelap */}
      <div className={`absolute inset-0 ${dark ? "bg-slate-950" : "bg-slate-50"}`} />
      {mode === "system" && (
        <div className="absolute inset-y-0 right-1/2 w-1/2 bg-slate-950" />
      )}
      {/* sidebar mini */}
      <div
        className={`absolute top-2 bottom-2 left-2 w-6 rounded-md ${
          dark ? "bg-slate-900" : "bg-white shadow-sm"
        }`}
      />
      {/* bar judul mini */}
      <div
        className={`absolute top-2 left-9 h-2 w-10 rounded-full ${
          dark ? "bg-slate-800" : "bg-slate-200"
        }`}
      />
      <div
        className={`absolute top-2 left-[5.25rem] h-2 w-6 rounded-full ${
          dark ? "bg-slate-800" : "bg-blue-200"
        }`}
      />
      {/* kartu konten mini */}
      <div className="absolute right-2 bottom-2 left-9 grid grid-cols-3 gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-8 rounded-md ${
              dark
                ? "bg-slate-900"
                : light
                  ? "bg-white shadow-sm"
                  : i < 2
                    ? "bg-white shadow-sm"
                    : "bg-slate-900"
            }`}
          />
        ))}
      </div>
      {/* titik aksen brand */}
      <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-blue-500" />
    </div>
  );
}

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = mounted
    ? (OPTIONS.find((o) => o.value === theme)?.value ?? "system")
    : null;

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-100 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />

      <div className="relative z-10 mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <LuArrowLeft className="h-3.5 w-3.5" />
          Kembali
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6"
        >
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3.5 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-300">
            <LuSparkles className="h-3.5 w-3.5" />
            Pengaturan — akan terus berkembang
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Tampilan
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Pilih tema aplikasi. Defaultnya{" "}
            <b className="text-slate-700 dark:text-slate-200">
              Pengaturan Sistem
            </b>{" "}
            — aplikasi mengikuti tema perangkatmu secara otomatis.
          </p>
        </motion.div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {OPTIONS.map((opt, i) => {
            const active = current === opt.value;
            return (
              <motion.button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
                aria-pressed={active}
                className={`glass-card relative rounded-2xl p-4 text-left transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  active ? "ring-2 ring-blue-500" : "hover:shadow-lg"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="theme-check"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-md"
                  >
                    <LuCheck className="h-3.5 w-3.5" />
                  </motion.span>
                )}
                <div className="mb-3 flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
                      active
                        ? "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    <opt.icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {opt.label}
                  </p>
                </div>
                <ThemePreview mode={opt.value} />
                <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {opt.desc}
                </p>
              </motion.button>
            );
          })}
        </div>

        <p className="mt-8 rounded-2xl border border-slate-200/80 bg-white/60 p-4 text-[11px] leading-relaxed text-slate-500 backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-400">
          Pilihan tersimpan di perangkat ini (localStorage) dan diterapkan
          seketika. Halaman login, pengaturan, dan konsol Kelola Akun sudah
          mendukung penuh dua tema — halaman lain menyusul didandani
          bertahap.
        </p>
      </div>
    </div>
  );
}
