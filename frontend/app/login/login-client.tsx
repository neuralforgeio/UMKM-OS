"use client";

// Login UMKM OS v3.2.0 — desain login baru dari arahan desain atasan
// (PDF Figma halaman "SECURE WORKSPACE · Welcome back"):
//
//   KIRI  panel merek Midnight penuh tinggi: ubin "U", UMKM OS /
//         BUSINESS OPERATING SYSTEM, pil "SATU RUANG KERJA · SEMUA
//         OUTLET", judul besar dua baris, widget RINGKASAN BISNIS ber-
//         lencana LIVE (menampilkan VERSI BACKEND ASLI dari GET
//         /api/v1/version — bukan angka demo), dan strip jaminan di
//         dasar. Dua lingkaran radial senyap memberi kedalaman tanpa
//         gradien dekoratif berisik.
//   KANAN kartu formulir di atas latar Cloud: pil "WORKSPACE AMAN",
//         "Selamat datang kembali", email + sandi dengan mata LIHAT,
//         satu tombol utama indigo penuh lebar.
//
// Yang TIDAK dibuat: deret tombol SSO penyedia pihak ketiga dari mockup
// (aplikasi memakai NextAuth credentials ke backend-go — tidak ada
// penyedia OAuth, memasangnya berarti fitur palsu) dan angka penjualan
// contoh (pra-autentikasi tidak ada data; widget menampilkan status
// layanan yang benar-benar dicek).
//
// LOGIKA TIDAK BERUBAH: server action loginAction (NextAuth → Go),
// pesan error asli, toggle tema pra-autentikasi, versi backend nyata.
import { useActionState, useState } from "react";
import {
  LuArrowRight,
  LuCheck,
  LuEye,
  LuEyeOff,
  LuLock,
  LuMail,
  LuShieldCheck,
} from "react-icons/lu";
import { loginAction } from "./actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuroraBackground } from "@/components/aurora-background";

const FRONTEND_VERSION = "3.2.0";

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

// Ubin merek "U" — sama dengan sidebar WorkspaceShell v3.2.0.
function BrandTile({ className = "h-10 w-10 text-lg" }: { className?: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-lg bg-primary font-extrabold tracking-tight text-primary-foreground ${className}`}
    >
      U
    </div>
  );
}

// Kemampuan NYATA aplikasi — baris tenang di dalam widget ringkasan,
// bukan kartu-kartu mengambang penuh animasi.
const KEMAMPUAN = [
  {
    judul: "Kasir yang cepat",
    isi: "Transaksi, struk, dan kode klaim pembeli terbit otomatis.",
  },
  {
    judul: "Stok tercatat sendiri",
    isi: "Terpotong saat barang terjual — tanpa hitung ulang manual.",
  },
  {
    judul: "Laporan yang jujur",
    isi: "Angka dari data Anda sendiri, bukan perkiraan buatan.",
  },
] as const;

export default function LoginClient({
  backendVersion,
}: {
  backendVersion: string | null;
}) {
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative min-h-dvh bg-slate-100 font-sans text-slate-900 antialiased selection:bg-primary/20 dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />

      {/* Tema hanya boleh diatur pra-autentikasi (login) dan di
          /settings — dijaga tests/navbar-profile.test.ts. */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 grid min-h-dvh lg:grid-cols-2">
        {/* ============ KIRI: panel merek Midnight (pola PDF) ============ */}
        <div
          className="relative hidden flex-col justify-between overflow-hidden bg-[#171925] p-10 lg:flex xl:p-14 dark:bg-[#0e101a]"
          style={{
            backgroundImage:
              "radial-gradient(640px circle at 88% -12%, rgba(102, 88, 232, 0.16), transparent 55%), radial-gradient(720px circle at -12% 112%, rgba(102, 88, 232, 0.12), transparent 55%)",
          }}
        >
          {/* Blok merek */}
          <div className="flex items-center gap-3">
            <BrandTile />
            <div>
              <span className="block text-lg leading-none font-bold tracking-tight text-white">
                UMKM OS
              </span>
              <span className="text-overline mt-1 block text-slate-400">
                Business Operating System
              </span>
            </div>
          </div>

          {/* Judul + widget ringkasan */}
          <div className="max-w-md">
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[11px] font-semibold tracking-wider text-slate-300 uppercase">
              Satu ruang kerja · semua outlet
            </span>

            <h1 className="mt-6 text-4xl leading-[1.1] font-extrabold tracking-tight text-white xl:text-[2.75rem]">
              Kelola tiap outlet.
              <br />
              Tetap terkendali.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              Penjualan, tim, stok, dan pelanggan — terhubung dalam satu
              ruang kerja tenang untuk bisnis yang bertumbuh.
            </p>

            {/* Widget ringkasan — status layanan NYATA, bukan angka demo */}
            <div className="mt-9 rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-overline text-slate-400">
                  Ringkasan bisnis
                </p>
                {backendVersion ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-300 uppercase">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Live
                  </span>
                ) : (
                  <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                    Menyambung
                  </span>
                )}
              </div>

              <p className="mt-3 text-lg font-bold tracking-tight text-white">
                Sekilas platform hari ini
              </p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums text-white">
                {backendVersion ? `Backend v${backendVersion}` : "Menyiapkan\u2026"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {backendVersion
                  ? "Layanan kasir · stok · laporan aktif"
                  : "Memeriksa koneksi backend-go\u2026"}
              </p>

              <ul className="mt-5 space-y-3.5 border-t border-white/10 pt-5">
                {KEMAMPUAN.map(({ judul, isi }) => (
                  <li key={judul} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-300">
                      <LuCheck className="h-3.5 w-3.5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-white">
                        {judul}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">
                        {isi}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Strip jaminan di dasar panel */}
          <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
            Akses aman · Izin berbasis peran · Siap multi-outlet
          </p>
        </div>

        {/* ============ KANAN: kartu formulir masuk ============ */}
        <div className="flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10">
          <div className="glass-card w-full max-w-md p-6 sm:p-8">
            {/* Brand ringkas (mobile) */}
            <div className="mb-7 flex items-center gap-3 lg:hidden">
              <BrandTile className="h-9 w-9 text-base" />
              <div>
                <span className="block text-base leading-none font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  UMKM OS
                </span>
                <span className="text-overline mt-0.5 block text-muted-foreground">
                  Business Operating System
                </span>
              </div>
            </div>

            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-overline font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              Workspace aman
            </span>

            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Selamat datang kembali
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              Masuk untuk mengakses workspace Anda.
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
                  Email Kerja
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
                    className="glass-input w-full rounded-xl py-3 pr-14 pl-10 text-sm font-medium transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword ? "Sembunyikan sandi" : "Lihat sandi"
                    }
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[11px] font-bold tracking-wider text-slate-400 transition-colors hover:text-slate-700 focus:outline-none dark:hover:text-slate-200"
                  >
                    {showPassword ? (
                      <LuEyeOff className="h-4 w-4" />
                    ) : (
                      <LuEye className="h-4 w-4" />
                    )}
                    <span className="ml-1.5 hidden sm:inline">Lihat</span>
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
                <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-500">
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
                  {isPending ? "Memverifikasi\u2026" : "Masuk ke UMKM OS"}
                </span>
                {isPending ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <LuArrowRight className="h-4 w-4" />
                )}
              </button>
            </form>

            {/* Catatan keamanan menggantikan deret SSO mockup — aplikasi
                memakai kredensial NextAuth ke backend-go, bukan OAuth. */}
            <div className="mt-7 flex items-start gap-2.5 border-t border-slate-200 pt-5 dark:border-slate-800">
              <LuShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success-strong" />
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Akses dilindungi izin berbasis peran dan sesi bertanda
                tangan. Belum terdaftar? Akun dibuat pemilik melalui menu{" "}
                <span className="font-semibold text-primary">
                  Kelola Akun
                </span>
                .
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] text-slate-400 dark:text-slate-500">
            UMKM OS · frontend v{FRONTEND_VERSION}
            {backendVersion ? ` · backend v${backendVersion}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
