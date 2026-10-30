"use client";

// Login UMKM OS v3.1.0 — ditulis ulang mengikuti arahan desain atasan
// ("Visual direction 02 · Indigo, neutral surfaces, calm hierarchy").
//
// Yang DIHAPUS dari v1.3.0 (dituding "AI slop"): aurora beranimasi,
// gelombang SVG, kartu fitur mengambang, gradien biru-cyan-indigo,
// badge "Live · Sync" berdenyut, dan gerakan framer-motion di seluruh
// kartu. Yang TETAP: LOGIATI tidak tersentuh — server action
// loginAction (NextAuth credentials → backend-go), pesan error asli,
// toggle tema pra-autentikasi, dan versi backend NYATA dari
// GET /api/v1/version. Tanpa data demo palsu.
import { useActionState, useState } from "react";
import {
  LuArrowRight,
  LuChartLine,
  LuEye,
  LuEyeOff,
  LuLock,
  LuMail,
  LuShieldCheck,
  LuStore,
} from "react-icons/lu";
import { loginAction } from "./actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuroraBackground } from "@/components/aurora-background";

const FRONTEND_VERSION = "3.1.0";

// Spinner pada tombol saat memverifikasi kredensial.
function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        opacity="0.25"
      />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Tiga kemampuan NYATA aplikasi — dijelaskan sebagai baris tenang,
// bukan kartu-kartu mengambang penuh animasi.
const FITUR = [
  {
    Icon: LuStore,
    judul: "Kasir yang cepat",
    isi: "Transaksi, struk, dan kode klaim pembeli terbit otomatis.",
  },
  {
    Icon: LuShieldCheck,
    judul: "Stok tercatat sendiri",
    isi: "Stok terpotong saat barang terjual — tanpa hitung ulang manual.",
  },
  {
    Icon: LuChartLine,
    isi: "Laporan harian dan peramalan pendapatan dari data Anda sendiri.",
    judul: "Laporan yang jujur",
  },
];

export default function LoginClient({
  backendVersion,
}: {
  backendVersion: string | null;
}) {
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-100 font-sans text-slate-900 antialiased selection:bg-primary/20 dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />

      {/* Tema hanya boleh diatur pra-autentikasi (login) dan di
          /settings — dijaga tests/navbar-profile.test.ts. */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <main className="relative z-10 flex min-h-dvh items-center justify-center p-4 sm:p-6">
        <div className="grid w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:rounded-2xl lg:grid-cols-12 dark:border-slate-800 dark:bg-slate-900">
          {/* ============ KIRI: narasi merek (tenang, datar) ============ */}
          <div className="hidden flex-col justify-between p-10 lg:col-span-7 lg:flex xl:p-12">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
                <LuStore className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-lg leading-none font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  UMKM OS
                </span>
                <span className="text-overline mt-1 block text-muted-foreground">
                  Platform Kasir &amp; Operasional Warung
                </span>
              </div>
            </div>

            <div className="my-10">
              <h1 className="text-3xl leading-tight font-extrabold tracking-tight text-slate-900 xl:text-4xl dark:text-slate-50">
                Setiap penjualan berarti.
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Satu ruang kerja untuk seluruh bisnis warung Anda —
                transaksi, stok, dan laporan dalam satu tempat yang sama.
              </p>

              <ul className="mt-10 space-y-6">
                {FITUR.map(({ Icon, judul, isi }) => (
                  <li key={judul} className="flex items-start gap-3.5">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-primary dark:border-slate-700 dark:bg-slate-800">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {judul}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {isi}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-500">
              © {new Date().getFullYear()} UMKM OS · Dirancang untuk warung
              Nusantara
              {backendVersion ? ` · backend v${backendVersion}` : ""}
            </p>
          </div>

          {/* ============ KANAN: formulir masuk ============ */}
          <div className="flex flex-col justify-center border-t border-slate-200 p-6 sm:p-10 lg:col-span-5 lg:border-t-0 lg:border-l xl:p-12 dark:border-slate-800">
            <div className="mx-auto w-full max-w-sm">
              {/* Brand ringkas (mobile) */}
              <div className="mb-8 flex items-center gap-3 lg:hidden">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
                  <LuStore className="h-4.5 w-4.5" />
                </div>
                <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  UMKM OS
                </span>
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Masuk ke Akun
              </h2>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                Silakan isi kredensial akun warung yang sudah terdaftar.
              </p>

              {state?.error && (
                <div
                  role="alert"
                  className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 dark:border-red-900/60 dark:bg-red-950/40"
                >
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                    Gagal masuk
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-red-600 dark:text-red-400">
                    {state.error}
                  </p>
                </div>
              )}

              <form action={formAction} className="mt-7 space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-300"
                  >
                    Email Warung
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <LuMail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      autoComplete="email"
                      required
                      placeholder="nama@warungmu.com"
                      className="glass-input w-full rounded-xl py-3 pr-4 pl-10 text-sm font-medium transition-all outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-300"
                    >
                      Kata Sandi
                    </label>
                    <span
                      title="Hubungi pemilik warung — sandi direset lewat konsol Kelola Akun"
                      className="cursor-help text-xs font-medium text-slate-400 dark:text-slate-500"
                    >
                      Lupa sandi?
                    </span>
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <LuLock className="h-4 w-4" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      autoComplete="current-password"
                      required
                      placeholder="••••••••••••"
                      className="glass-input w-full rounded-xl py-3 pr-11 pl-10 text-sm font-medium transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? "Sembunyikan sandi" : "Lihat sandi"
                      }
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition-colors hover:text-slate-700 focus:outline-none dark:hover:text-slate-200"
                    >
                      {showPassword ? (
                        <LuEyeOff className="h-4 w-4" />
                      ) : (
                        <LuEye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex cursor-pointer items-center gap-2 select-none">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="h-4 w-4 rounded border-slate-300 bg-white accent-[#6658e8] dark:border-slate-700 dark:bg-slate-900"
                    />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      Ingat saya
                    </span>
                  </label>
                  <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-500">
                    <LuShieldCheck className="h-3.5 w-3.5 text-success-strong" />
                    Sesi ditandatangani JWT
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover active:scale-[0.995] focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none focus:ring-offset-slate-100 disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-slate-950"
                >
                  <span>
                    {isPending ? "Memverifikasi..." : "Masuk ke Workspace"}
                  </span>
                  {isPending ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <LuArrowRight className="h-4 w-4" />
                  )}
                </button>
              </form>

              <div className="mt-8 border-t border-slate-200 pt-5 dark:border-slate-800">
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Belum mendaftarkan warung? Akun dibuat oleh pemilik melalui
                  menu{" "}
                  <span className="font-semibold text-primary">
                    Kelola Akun
                  </span>
                  .
                </p>
              </div>
            </div>

            <p className="mt-6 text-center text-[11px] text-slate-400 dark:text-slate-500">
              UMKM OS · frontend v{FRONTEND_VERSION}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
