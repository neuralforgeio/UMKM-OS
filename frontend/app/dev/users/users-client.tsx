"use client";

// Konsol "Kelola Akun & Hak Akses" — design v1.5.0 (ala mockup Gemini:
// aurora + glassmorphism) kini SADAR TEMA: mengikuti tema aplikasi
// (terang/gelap/sistem) lewat varian dark: — tidak lagi memaksa gelap.
// LOGIC TETAP VERSI KITA: data dari backend-go lewat server component
// induk; filter (cari/peran/outlet/status) + pagination 20 baris di
// klien; aksi lewat server action (buat/ubah/reset password/toggle
// aktif/hapus ketik-email); baris DEVELOPER & baris sendiri terkunci
// (server juga menolak); akun terhapus tidak pernah dikirim Go — dari
// sudut daftar, hapus = selamanya; jejaknya hidup di /dev/logs.
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  LuArchive,
  LuArchiveRestore,
  LuArrowRight,
  LuBell,
  LuChevronRight,
  LuCircleCheck,
  LuCodeXml,
  LuCrown,
  LuFileCheck2,
  LuHistory,
  LuKeyRound,
  LuMapPin,
  LuPencil,
  LuScanLine,
  LuSearch,
  LuShield,
  LuShieldAlert,
  LuStore,
  LuTrash2,
  LuUserPlus,
  LuUsers,
  LuX,
} from "react-icons/lu";
import { AuroraBackground } from "@/components/aurora-background";
import { SelectInput } from "@/components/select-input";
import { TablePagination } from "@/components/table-pagination";
import { UserMenu } from "@/components/user-menu";
import type { UserMenuUser } from "@/components/user-menu";
import { PasswordInput } from "@/components/password-input";
import { isPasswordValid } from "@/lib/password-policy";
import {
  deleteAccountSoft,
  resetAccountPassword,
  setAccountActive,
} from "./actions";
import { AccountFormModal } from "./account-form-modal";
import {
  avatarGradient,
  formatWibDateTime,
  initials,
  roleBadgeDark,
} from "./view-helpers";
import type { OutletOption, UserRow } from "./types";

const PAGE_SIZE = 20;

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Ikon + bayangan avatar per peran (visual saja — label & warna kelas
// ada di view-helpers.roleBadgeDark/avatarGradient supaya bisa diuji).
const ROLE_ICON: Record<UserRow["role"], typeof LuCrown> = {
  DEVELOPER: LuCodeXml,
  OWNER: LuCrown,
  KASIR: LuScanLine,
};
const AVATAR_SHADOW: Record<UserRow["role"], string> = {
  DEVELOPER: "shadow-purple-500/20",
  OWNER: "shadow-blue-500/20",
  KASIR: "shadow-emerald-500/20",
};

// Kelas dasar tombol aksi baris tabel (design: ikon senyap, menyala
// berwarna saat hover). disabled dipakai baris terkunci.
const ACTION_BTN =
  "p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all disabled:cursor-not-allowed disabled:opacity-30";

// Spinner resident — gaya tombol design (sama dengan login).
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

// Modal reset password: aksi sensitif selalu butuh langkah (dan niat)
// tersendiri — terpisah dari form utama. Checklist syarat hidup di
// bawah input (4 syarat: panjang, huruf besar, angka, simbol).
function ResetPasswordModal({
  user,
  onClose,
}: {
  user: UserRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startAsync] = useTransition();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit() {
    setError(null);
    const result = await resetAccountPassword({
      userId: user.id,
      newPassword: password,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`Reset password ${user.name}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="glass-card relative w-full max-w-md rounded-3xl p-6 shadow-2xl sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute top-5 right-5 rounded-lg p-1 text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
        >
          <LuX className="h-5 w-5" />
        </button>

        <div className="mb-6 flex items-center space-x-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <LuKeyRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-extrabold text-slate-900 dark:text-white">
              Reset Kata Sandi
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {user.name} · {user.email}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {error && (
            <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-bold tracking-wider text-slate-600 dark:text-slate-300 uppercase">
              Kata Sandi Baru
            </label>
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              showChecklist
            />
            <span className="mt-1 block text-[10px] text-slate-500">
              Minimal 8 karakter — wajib ada huruf besar, angka, dan simbol.
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Password lama tidak perlu diketahui. Berlaku untuk login berikutnya;
            sesi yang sedang berjalan tidak diputus.
          </p>
        </div>

        <div className="mt-6 flex items-center justify-end space-x-3 border-t border-slate-200 dark:border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => startAsync(handleSubmit)}
            disabled={pending || !isPasswordValid(password)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-amber-600/25 transition-all hover:from-amber-400 hover:to-orange-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending && <Spinner className="h-3.5 w-3.5" />}
            Reset Password
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Modal konfirmasi hapus: ketik email = konfirmasi yang tidak bisa
// dilakukan asal klik. Teks tetap tegas dan menjelaskan akibat persisnya.
function DeleteAccountModal({
  user,
  onClose,
}: {
  user: UserRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startAsync] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const typedOk = confirmText.trim().toLowerCase() === user.email;

  async function handleSubmit() {
    setError(null);
    const result = await deleteAccountSoft({ userId: user.id });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`Hapus akun ${user.name}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="glass-card relative w-full max-w-md rounded-3xl p-6 shadow-2xl sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute top-5 right-5 rounded-lg p-1 text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
        >
          <LuX className="h-5 w-5" />
        </button>

        <div className="mb-6 flex items-center space-x-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <LuTrash2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-extrabold text-slate-900 dark:text-white">Hapus Akun</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {user.name} · {user.email}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {error && (
            <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Akun dihapus <b className="text-slate-900 dark:text-white">selamanya dari daftar</b> —
            tidak bisa dibatalkan. Email{" "}
            <b className="text-slate-700 dark:text-slate-200">{user.email}</b> dibebaskan supaya
            bisa dipakai akun baru. Riwayat transaksi dan jejak log atas nama
            akun ini <b className="text-slate-900 dark:text-white">tetap tersimpan</b> — penghapusan
            ini sendiri juga masuk log.
          </p>
          <div>
            <label className="mb-1.5 block text-xs font-bold tracking-wider text-slate-600 dark:text-slate-300 uppercase">
              Ketik email akun untuk konfirmasi
            </label>
            <input
              className="glass-input w-full rounded-xl px-4 py-2.5 font-mono text-xs focus:outline-none"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={user.email}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end space-x-3 border-t border-slate-200 dark:border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => startAsync(handleSubmit)}
            disabled={pending || !typedOk}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-600/25 transition-all hover:bg-rose-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending && <Spinner className="h-3.5 w-3.5" />}
            Hapus Akun
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function UsersClient({
  users,
  outlets,
  currentUserId,
  userName,
  userEmail,
  me,
}: {
  users: UserRow[];
  outlets: OutletOption[];
  currentUserId: string;
  userName?: string;
  userEmail?: string;
  me: UserMenuUser;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("ALL");
  const [outlet, setOutlet] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  // undefined = tertutup; null = modal buat; row = modal edit.
  const [editing, setEditing] = useState<UserRow | null | undefined>(undefined);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((user) => {
      if (role !== "ALL" && user.role !== role) return false;
      if (outlet !== "ALL") {
        if (
          outlet === "__none__"
            ? user.outletId !== null
            : user.outletId !== outlet
        )
          return false;
      }
      if (status === "ACTIVE" && !user.isActive) return false;
      if (status === "INACTIVE" && user.isActive) return false;
      if (!q) return true;
      return (
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q)
      );
    });
  }, [users, query, role, outlet, status]);

  useEffect(() => {
    setPage(1);
  }, [query, role, outlet, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  async function handleToggle(user: UserRow) {
    setTogglingId(user.id);
    try {
      const result = await setAccountActive({
        userId: user.id,
        isActive: !user.isActive,
      });
      if (result.ok) {
        startTransition(() => router.refresh());
      }
    } finally {
      setTogglingId(null);
    }
  }

  // Angka kartu metrik: ASLI dari data yang sama dengan tabel — bukan
  // angka demo. Kartu 2 & 4 memang kualitatif (hirarki & status audit).
  const activeCount = users.filter((u) => u.isActive).length;
  const activePct =
    users.length === 0 ? 0 : Math.round((activeCount / users.length) * 100);
  const namaOutletPertama = outlets[0]?.name;

  return (
    <div className="relative min-h-dvh bg-slate-100 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />

      <div className="relative z-10 flex min-h-dvh flex-col">
        {/* ===== Topbar: brand + breadcrumb + notifikasi + profil ===== */}
        <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-4">
              <Link href="/dev" className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[1px] shadow-md shadow-blue-500/20">
                  <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-white dark:bg-slate-950">
                    <LuStore className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div>
                  <span className="block text-base leading-none font-extrabold tracking-tight text-slate-900 dark:text-white">
                    UMKM OS
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    Kasir &amp; Intelijensi Bisnis
                  </span>
                </div>
              </Link>

              <div className="hidden items-center space-x-2 border-l border-slate-200 dark:border-slate-800 pl-4 text-xs font-medium text-slate-500 dark:text-slate-400 md:flex">
                <Link
                  href="/dev"
                  className="text-slate-600 dark:text-slate-300 transition hover:text-slate-900 dark:hover:text-white"
                >
                  Konsol
                </Link>
                <LuChevronRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-600" />
                <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 font-semibold text-blue-600 dark:text-blue-400">
                  Kelola Akun
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* v2.2.0: chip profil (avatar + nama + email) — menu di
                  bawahnya: Profil / Pengaturan Tampilan / Keluar. Tema
                  hanya diatur di /settings. */}
              <UserMenu user={me} />

              {/* Lonceng = pintu ke log aktivitas (notifikasi sistem). */}
              <Link
                href="/dev/logs"
                title="Notifikasi — log aktivitas sistem"
                aria-label="Log aktivitas sistem"
                className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-2 text-slate-500 dark:text-slate-400 transition-all hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white"
              >
                <LuBell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-500" />
              </Link>

              <div className="hidden h-6 w-[1px] bg-slate-200 dark:bg-slate-800 sm:block" />

              <div className="flex items-center space-x-3 pl-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 text-xs font-bold text-white ring-2 ring-purple-500/30">
                  {initials(userName || "Developer")}
                </div>
                <div className="hidden text-left sm:block">
                  <div className="text-xs leading-tight font-bold text-slate-900 dark:text-white">
                    {userName ?? "Developer"}
                  </div>
                  <div className="max-w-[200px] truncate text-[10px] text-slate-500 dark:text-slate-400">
                    {userEmail ?? ""}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ===== Konten utama ===== */}
        <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-8 sm:px-6 lg:px-8">
          {/* Judul halaman + aksi utama */}
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                  Kelola Akun &amp; Hak Akses
                </h1>
                <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  Semua Outlet
                </span>
              </div>
              <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500 dark:text-slate-400 sm:text-sm">
                Atur wewenang pengguna, alokasi tugas kasir per outlet, serta
                pantau aktivitas jualan terakhir setiap akun.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] sm:w-auto"
              >
                <LuUserPlus className="h-4 w-4" />
                <span>Tambah Akun Baru</span>
              </button>
            </div>
          </div>

          {/* Kartu metrik */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="glass-card group relative overflow-hidden rounded-2xl p-4 transition-all hover:border-blue-500/40">
              <div className="mb-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">Total Akun Terdaftar</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <LuUsers className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {users.length}{" "}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  Pengguna
                </span>
              </div>
              <div
                className={`mt-2 flex items-center gap-1 text-[11px] font-medium ${
                  activePct === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                }`}
              >
                <LuCircleCheck className="h-3.5 w-3.5" />
                {users.length === 0
                  ? "Belum ada akun terdaftar"
                  : `${activePct}% Akun Aktif`}
              </div>
            </div>

            <div className="glass-card group relative overflow-hidden rounded-2xl p-4 transition-all hover:border-purple-500/40">
              <div className="mb-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">Hirarki Akses</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <LuShield className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 pt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span className="font-bold text-purple-600 dark:text-purple-400">Dev</span>
                <LuArrowRight className="h-3 w-3 text-slate-400 dark:text-slate-600" />
                <span className="font-bold text-blue-600 dark:text-blue-400">Owner</span>
                <LuArrowRight className="h-3 w-3 text-slate-400 dark:text-slate-600" />
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Kasir</span>
              </div>
              <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                Pemisahan wewenang berlapis per token
              </div>
            </div>

            <div className="glass-card group relative overflow-hidden rounded-2xl p-4 transition-all hover:border-cyan-500/40">
              <div className="mb-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">Outlet Terhubung</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  <LuMapPin className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {outlets.length}{" "}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  Lokasi
                </span>
              </div>
              <div className="mt-2 truncate text-[11px] font-medium text-cyan-600 dark:text-cyan-400">
                {namaOutletPertama ?? "Belum ada outlet"}
              </div>
            </div>

            <div className="glass-card group relative overflow-hidden rounded-2xl p-4 transition-all hover:border-amber-500/40">
              <div className="mb-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">Audit System</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <LuFileCheck2 className="h-4 w-4" />
                </div>
              </div>
              <div className="pt-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                ACCOUNT_* Active
              </div>
              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                Jejak aktivitas akun tercatat otomatis
              </div>
            </div>
          </div>

          {/* Toolbar cari + filter */}
          <div className="glass-card rounded-2xl p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
              <div className="relative lg:col-span-5">
                {/* Ikon cari dipasang top-1/2 -translate-y-1/2 agar SELALU
                    di tengah vertikal — pola inset-y-0 + h-4 membuat ikon
                    terpaku di atas input (menceng 11px) karena CSS
                    mengabaikan bottom saat top+height sudah ditentukan. */}
                <LuSearch className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari nama atau email…"
                  className="glass-input w-full rounded-xl py-2.5 pr-4 pl-10 text-xs font-medium transition-all focus:outline-none"
                />
              </div>

              <div className="lg:col-span-2">
                <SelectInput
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  aria-label="Filter peran"
                >
                  <option value="ALL">Semua Peran</option>
                  <option value="DEVELOPER">Developer</option>
                  <option value="OWNER">Owner</option>
                  <option value="KASIR">Kasir</option>
                </SelectInput>
              </div>

              <div className="lg:col-span-3">
                <SelectInput
                  value={outlet}
                  onChange={(e) => setOutlet(e.target.value)}
                  aria-label="Filter outlet"
                >
                  <option value="ALL">Semua Outlet</option>
                  <option value="__none__">Tanpa Outlet (Owner Global)</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </SelectInput>
              </div>

              <div className="lg:col-span-2">
                <SelectInput
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  aria-label="Filter status"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="ACTIVE">Aktif</option>
                  <option value="INACTIVE">Nonaktif</option>
                </SelectInput>
              </div>
            </div>
          </div>

          {/* Tabel akun */}
          <div className="glass-card overflow-hidden rounded-2xl border-slate-200/80 dark:border-slate-800/80 shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-100/70 dark:bg-slate-900/60 text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                    <th className="px-6 py-4">Pengguna</th>
                    <th className="px-4 py-4">Peran Hak Akses</th>
                    <th className="px-4 py-4">Outlet Ditugaskan</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Transaksi Terakhir</th>
                    <th className="px-6 py-4 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/50 text-xs">
                  {pageRows.map((user) => {
                    const isSelf = user.id === currentUserId;
                    // Baris developer & baris sendiri hanya bisa DILIHAT —
                    // semua tombol modifikasinya mati (server juga menolak).
                    const locked = user.role === "DEVELOPER" || isSelf;
                    const lockTitle = isSelf
                      ? "Akun Anda sendiri — ubah lewat Akun Saya"
                      : "Akun developer dikelola lewat DEV_SEED_* di .env";
                    const rb = roleBadgeDark(user.role);
                    const RoleIcon = ROLE_ICON[user.role];
                    return (
                      <tr
                        key={user.id}
                        className="transition-colors hover:bg-slate-200/50 dark:hover:bg-slate-800/30"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3.5">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr text-xs font-bold text-white shadow-md ${avatarGradient(user.role)} ${AVATAR_SHADOW[user.role]}`}
                            >
                              {initials(user.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900 dark:text-white">
                                <span className="truncate">{user.name}</span>
                                {isSelf && (
                                  <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                                    Anda
                                  </span>
                                )}
                              </div>
                              <div className="max-w-[220px] truncate text-[11px] text-slate-500 dark:text-slate-400">
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase ${rb.badge}`}
                          >
                            <RoleIcon className="h-3 w-3" />
                            {rb.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {user.outletName ? (
                            <span className="font-medium text-slate-700 dark:text-slate-200">
                              {user.outletName}
                            </span>
                          ) : user.role === "OWNER" ? (
                            <span className="italic text-slate-500 dark:text-slate-400">
                              — (Akses Semua)
                            </span>
                          ) : (
                            <span className="italic text-slate-500 dark:text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {user.isActive ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-500/20 bg-slate-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                              Nonaktif
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                          {formatWibDateTime(user.lastTransactionAtIso)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              type="button"
                              onClick={() => setEditing(user)}
                              disabled={locked}
                              title={locked ? lockTitle : "Ubah akun"}
                              aria-label={`Ubah ${user.name}`}
                              className={`${ACTION_BTN} hover:text-blue-600 dark:hover:text-blue-400`}
                            >
                              <LuPencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setResetting(user)}
                              disabled={locked}
                              title={
                                locked
                                  ? lockTitle
                                  : "Reset sandi (tanpa pw lama)"
                              }
                              aria-label={`Reset password ${user.name}`}
                              className={`${ACTION_BTN} hover:text-amber-600 dark:hover:text-amber-400`}
                            >
                              <LuKeyRound className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggle(user)}
                              disabled={locked || togglingId === user.id}
                              title={
                                locked
                                  ? lockTitle
                                  : user.isActive
                                    ? "Nonaktifkan akun"
                                    : "Aktifkan kembali"
                              }
                              aria-label={
                                user.isActive
                                  ? `Nonaktifkan ${user.name}`
                                  : `Aktifkan ${user.name}`
                              }
                              className={`${ACTION_BTN} ${
                                user.isActive
                                  ? "hover:text-amber-600 dark:hover:text-amber-400"
                                  : "hover:text-emerald-600 dark:hover:text-emerald-400"
                              }`}
                            >
                              {togglingId === user.id ? (
                                <Spinner className="h-4 w-4" />
                              ) : user.isActive ? (
                                <LuArchive className="h-4 w-4" />
                              ) : (
                                <LuArchiveRestore className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleting(user)}
                              disabled={locked}
                              title={locked ? lockTitle : "Hapus akun permanen"}
                              aria-label={`Hapus ${user.name}`}
                              className={`${ACTION_BTN} hover:text-rose-600 dark:hover:text-rose-400`}
                            >
                              <LuTrash2 className="h-4 w-4" />
                            </button>
                            <Link
                              href={`/dev/logs?actor=${user.id}`}
                              title="Lihat jejak log aktor ini"
                              aria-label={`Jejak log ${user.name}`}
                              className={`${ACTION_BTN} hover:text-cyan-600 dark:hover:text-cyan-400`}
                            >
                              <LuHistory className="h-4 w-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pageRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                      >
                        Tidak ada akun yang cocok dengan filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <TablePagination
              page={safePage}
              pageCount={pageCount}
              pageSize={PAGE_SIZE}
              total={filtered.length}
              onPage={setPage}
              unit="akun"
            />

            {/* Footer audit */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-900/40 px-6 py-3 text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center space-x-2">
                <LuShieldAlert className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>
                  Semua aksi di tabel ini tercatat di jejak audit (
                  <code className="text-blue-700 dark:text-blue-300">ACCOUNT_*</code>), termasuk
                  percobaan gagal.
                </span>
              </div>
              <div>
                Menampilkan {filtered.length} dari {users.length} akun terdaftar
              </div>
            </div>
          </div>
        </main>
      </div>

      {editing !== undefined && (
        <AccountFormModal
          user={editing}
          outlets={outlets}
          onClose={() => setEditing(undefined)}
        />
      )}
      {resetting && (
        <ResetPasswordModal
          user={resetting}
          onClose={() => setResetting(null)}
        />
      )}
      {deleting && (
        <DeleteAccountModal user={deleting} onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}