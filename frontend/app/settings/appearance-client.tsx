"use client";

// Pengaturan Tampilan (v1.3.0; v3.3.0 ikut bahasa desain "Indigo & Quiet
// Surfaces"). Pemilih tema tetap tiga pilihan: Sistem (default) / Gelap /
// Terang — tiap kartu memperlihatkan PRATINJAU tampilan yang sebenarnya
// supaya pengguna melihat bedanya sebelum mengeklik. Pilihan diterapkan
// seketika lewat next-themes dan tersimpan per-akun (lihat
// lib/theme-storage.ts).
//
// v3.3.0 — bahasa shell yang sama dengan halaman lain:
//   - pita atas berbatas: ubin merek "U" + chip profil (bila login);
//   - kepala halaman pola PDF 01: overline + SATU judul + deskripsi;
//   - kartu pemilih = permukaan tenang (glass-card) + cekal indigo statis,
//     tanpa gerakan dekoratif — halaman pengaturan adalah alat, bukan
//     panggung.
// Tombol "Kembali" tetap sadar peran (prop dari server component induk).
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, Check, Monitor, Moon, Sun } from "lucide-react";
import { AuroraBackground } from "@/components/aurora-background";
import { UserMenu, type UserMenuUser } from "@/components/user-menu";

type ThemeOption = "system" | "dark" | "light";

const OPTIONS: {
  value: ThemeOption;
  label: string;
  desc: string;
  icon: typeof Monitor;
}[] = [
  {
    value: "system",
    label: "Gunakan Pengaturan Sistem",
    desc: "Otomatis mengikuti tema perangkat — berganti sendiri saat perangkat berganti.",
    icon: Monitor,
  },
  {
    value: "dark",
    label: "Mode Gelap",
    desc: "Cocok untuk jadwal malam dan ruangan remang — hemat mata & baterai.",
    icon: Moon,
  },
  {
    value: "light",
    label: "Mode Terang",
    desc: "Klasik dan kontras tinggi untuk siang hari di terik warung.",
    icon: Sun,
  },
];

// Ubin merek "U" — sama dengan sidebar WorkspaceShell & halaman login.
function BrandTile({ className = "h-9 w-9 text-base" }: { className?: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-lg bg-primary font-extrabold tracking-tight text-primary-foreground ${className}`}
    >
      U
    </div>
  );
}

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
      {/* titik aksen merek */}
      <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-blue-500" />
    </div>
  );
}

export function AppearanceSettings({
  backHref,
  backLabel,
  user,
}: {
  backHref: string;
  backLabel: string;
  user: UserMenuUser | null;
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = mounted
    ? (OPTIONS.find((o) => o.value === theme)?.value ?? "system")
    : null;

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-100 font-sans text-slate-900 antialiased selection:bg-primary/20 dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />

      {/* Pita atas berbatas — bahasa shell: ubin merek kiri, chip profil
          (bila sedang login) di kanan. */}
      <header className="relative z-20 shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandTile className="h-8 w-8 text-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm leading-none font-bold tracking-tight text-slate-900 dark:text-slate-100">
                UMKM OS
              </p>
              <p className="text-overline mt-0.5 text-muted-foreground">
                Pengaturan tampilan
              </p>
            </div>
          </div>
          {user ? <UserMenu user={user} /> : null}
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>

        {/* Kepala halaman (pola PDF 01): overline + SATU judul utama +
            deskripsi satu baris. */}
        <div className="mt-5">
          <p className="text-overline text-muted-foreground">Pengaturan</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-50">
            Tampilan
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Pilih tema aplikasi. Defaultnya{" "}
            <b className="font-semibold text-slate-700 dark:text-slate-200">
              Pengaturan Sistem
            </b>{" "}
            — aplikasi mengikuti tema perangkatmu secara otomatis.
          </p>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {OPTIONS.map((opt) => {
            const active = current === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                aria-pressed={active}
                className={`glass-card relative rounded-2xl p-4 text-left transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  active ? "ring-2 ring-primary" : "hover:shadow-lg"
                }`}
              >
                {active && (
                  <span className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                )}
                <div className="mb-3 flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
                      active
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400"
                    }`}
                  >
                    <opt.icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {opt.label}
                  </p>
                </div>
                <ThemePreview mode={opt.value} />
                <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>

        <div className="glass-card mt-7 rounded-2xl p-4 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          Pilihan tersimpan di mesin ini (localStorage) dengan kunci khusus
          AKUNMU — tema mengikuti orang, bukan browser: dua orang yang
          berbagi satu komputer tetap punya tema masing-masing, dan tema
          terakhir tersimpan juga sebagai tema halaman masuk. Seluruh
          halaman aplikasi kini mendukung penuh dua tema — terang dan gelap
          sama pentingnya sesuai arahan desain.
        </div>
      </main>
    </div>
  );
}
