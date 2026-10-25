"use client";

// Login UMKM OS v1.3.0 — design glassmorphism gelap/terang dengan aurora,
// gelombang SVG, kartu fitur mengambang, dan animasi framer-motion.
// LOGIC TETAP VERSI KITA: server action loginAction (NextAuth credentials
// -> backend-go), pesan error asli, tanpa data demo palsu — angka versi
// diambil dari GET /api/v1/version yang sesungguhnya.
import { useActionState, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  LuArrowRight,
  LuCircleCheck,
  LuEye,
  LuEyeOff,
  LuLayers,
  LuLock,
  LuMail,
  LuShieldCheck,
  LuSparkles,
  LuStore,
  LuTrendingUp,
} from "react-icons/lu";
import { loginAction } from "./actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuroraBackground } from "@/components/aurora-background";

const FRONTEND_VERSION = "1.3.0";

// Animasi masuk berjenjang (terjemahan fadeInUp milik design).
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay, ease: EASE },
  }),
};

// Spinner resident (gaya tombol design).
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

export default function LoginClient({
  backendVersion,
}: {
  backendVersion: string | null;
}) {
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative flex min-h-dvh items-center overflow-x-hidden bg-slate-100 font-sans text-slate-900 antialiased selection:bg-blue-600 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />

      <div className="relative z-10 mx-auto my-auto flex min-h-dvh w-full max-w-7xl items-center p-4 sm:p-6 lg:p-8">
        <div className="grid w-full grid-cols-1 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/60 shadow-2xl backdrop-blur-2xl lg:grid-cols-12 dark:border-slate-800/80 dark:bg-slate-900/40">
          {/* ================= KIRI: branding + kartu fitur ================= */}
          <div className="relative hidden min-h-[680px] flex-col justify-between overflow-hidden p-14 lg:col-span-7 lg:flex">
            {/* Gelombang SVG yang mengalir ke panel kanan */}
            <div className="pointer-events-none absolute inset-y-0 -right-20 z-0 hidden w-[160%] overflow-hidden opacity-30 lg:block dark:opacity-40">
              <svg
                className="animate-wave-flow h-full w-full"
                viewBox="0 0 800 800"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M 300 0 C 450 150, 200 350, 480 500 C 600 600, 350 750, 520 800 L 800 800 L 800 0 Z"
                  fill="url(#waveGradient1)"
                />
                <path
                  d="M 220 0 C 380 180, 150 380, 420 540 C 550 640, 280 720, 450 800 L 800 800 L 800 0 Z"
                  fill="url(#waveGradient2)"
                />
                <defs>
                  <linearGradient
                    id="waveGradient1"
                    x1="200"
                    y1="0"
                    x2="800"
                    y2="800"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                    <stop offset="50%" stopColor="#6366f1" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity="0.8" />
                  </linearGradient>
                  <linearGradient
                    id="waveGradient2"
                    x1="100"
                    y1="0"
                    x2="800"
                    y2="800"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.2" />
                    <stop
                      offset="100%"
                      stopColor="#3b82f6"
                      stopOpacity="0.05"
                    />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Header & lencana hidup */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={0.1}
              className="relative z-10 flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[1px] shadow-lg shadow-blue-500/20">
                  <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-white dark:bg-slate-950">
                    <LuStore className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                  </div>
                </div>
                <div>
                  <span className="block text-xl font-extrabold leading-none tracking-tight text-slate-900 dark:text-white">
                    UMKM OS
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Platform Kasir &amp; Operasional Warung
                  </span>
                </div>
              </div>

              <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3.5 py-1.5 text-xs text-slate-600 sm:flex dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {backendVersion
                    ? `Live · backend v${backendVersion}`
                    : "Live Sync"}
                </span>
              </div>
            </motion.div>

            {/* Hero + kartu fitur mengambang */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={0.25}
              className="relative z-10 my-auto py-8"
            >
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3.5 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-300">
                <LuSparkles className="h-3.5 w-3.5" />
                <span>POS untuk Warung Indonesia</span>
              </div>

              <h1 className="text-3xl text-4xl font-extrabold leading-[1.15] tracking-tight text-slate-900 sm:text-5xl dark:text-white">
                Kelola warungmu <br />
                <span className="bg-gradient-to-r from-blue-500 via-cyan-500 to-indigo-500 bg-clip-text text-transparent dark:from-blue-400 dark:via-cyan-300 dark:to-indigo-200">
                  lebih pintar &amp; presisi.
                </span>
              </h1>

              <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-400">
                Satu platform terintegrasi untuk transaksi cepat, pencatatan
                stok otomatis, dan analisis omset warung harian tanpa ribet.
              </p>

              <div className="mt-8 grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="glass-card animate-float group relative overflow-hidden rounded-2xl p-4 transition-all hover:border-blue-500/40">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                      <LuTrendingUp className="h-4 w-4 text-emerald-500" />
                      Kasir Kilat
                    </span>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      Real-time
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    Struk + kode klaim otomatis
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-200/80 pt-2.5 text-[11px] text-slate-500 dark:border-slate-800/80 dark:text-slate-400">
                    <span>Stok terpotong saat terjual</span>
                    <LuCircleCheck className="h-3.5 w-3.5 text-emerald-500" />
                  </div>
                </div>

                <div className="glass-card animate-float-delayed group relative overflow-hidden rounded-2xl p-4 transition-all hover:border-indigo-500/40">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                      <LuLayers className="h-4 w-4 text-cyan-500" />
                      Status Stok
                    </span>
                    <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-600 dark:text-cyan-400">
                      Sinkron
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-blue-500 dark:border-slate-700 dark:bg-slate-800/90 dark:text-blue-400">
                      <LuShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        Laporan harian &amp; peramalan
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Saran restock otomatis
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div className="h-full w-[94%] rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Footer kiri */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={0.4}
              className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 pt-4 text-xs text-slate-500 dark:border-slate-800/60 dark:text-slate-500"
            >
              <p>
                © {new Date().getFullYear()} UMKM OS · Dirancang Khusus Warung
                Nusantara
              </p>
            </motion.div>
          </div>

          {/* ================= KANAN: form login ================= */}
          <div className="relative flex flex-col justify-between border-t border-slate-200/80 bg-white/70 p-6 backdrop-blur-2xl sm:p-10 lg:col-span-5 lg:border-t-0 lg:border-l dark:border-slate-800/80 dark:bg-slate-950/80 lg:p-12">
            <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl" />

            <div className="relative z-10 mx-auto my-auto w-full max-w-sm py-4">
              <div className="mb-8 flex items-center justify-between gap-3">
                {/* Brand ringkas (mobile) */}
                <div className="flex items-center gap-3 lg:hidden">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[1px]">
                    <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-white dark:bg-slate-950">
                      <LuStore className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    </div>
                  </div>
                  <div>
                    <span className="block text-base font-extrabold leading-none text-slate-900 dark:text-white">
                      UMKM OS
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      Kasir &amp; Intelijensi Bisnis
                    </span>
                  </div>
                </div>
                <div className="hidden lg:block" />
                <ThemeToggle />
              </div>

              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={0.2}
              >
                <div className="mb-2 inline-flex items-center gap-2 text-xs font-bold tracking-wider text-blue-600 uppercase dark:text-blue-400">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  <span>Portal Akses Masuk</span>
                </div>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                  Masuk ke Akun
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-sm dark:text-slate-400">
                  Silakan isi kredensial akun warung yang sudah terdaftar.
                </p>
              </motion.div>

              <motion.form
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={0.3}
                action={formAction}
                className="mt-8 space-y-4"
              >
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase dark:text-slate-300"
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
                      className="block text-xs font-bold tracking-wider text-slate-600 uppercase dark:text-slate-300"
                    >
                      Kata Sandi
                    </label>
                    <span
                      title="Hubungi pemilik warung — password direset lewat konsol Kelola Akun"
                      className="cursor-help text-xs font-semibold text-slate-400 dark:text-slate-500"
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
                      className="h-4 w-4 rounded border-slate-300 bg-white accent-blue-600 dark:border-slate-700 dark:bg-slate-900"
                    />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      Ingat saya
                    </span>
                  </label>
                  <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-500">
                    <LuShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    Sesi ditandatangani JWT
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-4 py-3.5 font-bold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:outline-none focus:ring-offset-slate-100 disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-slate-950"
                >
                  <span>
                    {isPending ? "Memverifikasi..." : "Masuk ke Dashboard"}
                  </span>
                  {isPending ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <LuArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  )}
                </button>
              </motion.form>

              <div className="mt-8 border-t border-slate-200/80 pt-6 text-center dark:border-slate-800/80">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Belum mendaftarkan warung? Akun dibuat oleh pemilik melalui
                  menu{" "}
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    Kelola Akun
                  </span>
                  .
                </p>
              </div>
            </div>

            <div className="relative z-10 mt-4 text-center text-[11px] text-slate-500 dark:text-slate-500">
              UMKM OS · frontend v{FRONTEND_VERSION}
              {backendVersion ? ` · backend v${backendVersion}` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Toast error — pesan asli dari loginAction (backend-go). */}
      <AnimatePresence>
        {state?.error && (
          <motion.div
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            role="alert"
            className="glass-card fixed right-6 bottom-6 z-50 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl!"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/20 text-red-500">
              <LuShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Gagal masuk
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300">
                {state.error}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
