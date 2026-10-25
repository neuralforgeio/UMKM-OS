"use client";

// Tabel kelola akun lintas outlet — design language v1.3.0 (glass, tema
// gelap/terang, framer-motion, react-icons) dengan LOGICA yang sama
// seperti versi sebelumnya: filter (cari/peran/outlet/status) + pagination
// 20 baris berjalan di klien mengikuti pola halaman produk — jumlah akun
// selalu kecil, memuat semua baris sekali jauh lebih responsif daripada
// query ulang server tiap ketik.
// Data kini datang dari backend-go (lewat server component induk):
// akun terhapus tidak pernah dikirim — dari sudut daftar, hapus =
// selamanya; jejaknya hidup di /dev/logs.
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  LuArchive,
  LuArchiveRestore,
  LuArrowLeft,
  LuChevronRight,
  LuKeyRound,
  LuPencil,
  LuScrollText,
  LuSearch,
  LuShieldCheck,
  LuStore,
  LuTrash2,
  LuUserCheck,
  LuUserPlus,
  LuUsers,
  LuX,
} from "react-icons/lu";
import { TablePagination } from "@/components/table-pagination";
import { PasswordInput } from "@/components/password-input";
import { ThemeToggle } from "@/components/theme-toggle";
import { isPasswordValid } from "@/lib/password-policy";
import {
  deleteAccountSoft,
  resetAccountPassword,
  setAccountActive,
} from "./actions";
import { AccountFormModal } from "./account-form-modal";
import { formatWibShort, initials, roleView } from "./view-helpers";
import type { OutletOption, UserRow } from "./types";

const PAGE_SIZE = 20;

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

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
// tersendiri — terpisah dari form utama.
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
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Reset password ${user.name}`}
    >
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="glass-card relative flex w-full max-w-sm flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-4 dark:border-slate-800/70">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <LuKeyRound className="h-4 w-4" />
            </div>
            <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
              Reset password — {user.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="password baru"
            showChecklist
          />
          <p className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
            Password lama tidak perlu diketahui. Berlaku untuk login berikutnya;
            sesi yang sedang berjalan tidak diputus.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200/70 px-5 py-4 dark:border-slate-800/70">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => startAsync(handleSubmit)}
            disabled={pending || !isPasswordValid(password)}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending && <Spinner className="h-3.5 w-3.5" />}
            Reset Password
          </button>
        </div>
      </div>
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
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Hapus akun ${user.name}`}
    >
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="glass-card relative flex w-full max-w-sm flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-4 dark:border-slate-800/70">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-600 dark:text-red-400">
              <LuTrash2 className="h-4 w-4" />
            </div>
            <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
              Hapus akun — {user.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Akun dihapus{" "}
            <b className="text-slate-900 dark:text-slate-100">
              selamanya dari daftar
            </b>{" "}
            — tidak bisa dibatalkan. Email <b>{user.email}</b> dibebaskan supaya
            bisa dipakai akun baru. Riwayat transaksi dan jejak log atas nama
            akun ini{" "}
            <b className="text-slate-900 dark:text-slate-100">
              tetap tersimpan
            </b>{" "}
            — penghapusan ini sendiri juga masuk log.
          </p>
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Ketik email akun untuk konfirmasi
            </label>
            <input
              className="glass-input mt-1.5 font-mono"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={user.email}
              autoComplete="off"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200/70 px-5 py-4 dark:border-slate-800/70">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => startAsync(handleSubmit)}
            disabled={pending || !typedOk}
            className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending && <Spinner className="h-3.5 w-3.5" />}
            Hapus Akun
          </button>
        </div>
      </div>
    </div>
  );
}

export function UsersClient({
  users,
  outlets,
  currentUserId,
  userName,
  userEmail,
}: {
  users: UserRow[];
  outlets: OutletOption[];
  currentUserId: string;
  userName?: string;
  userEmail?: string;
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

  // Metrik kartu: angka ASLI dari data yang sama dengan tabel — bukan
  // angka demo. Kasir "bertugas" = punya transaksi ≤ 7 hari terakhir.
  const activeCount = users.filter((u) => u.isActive).length;
  const kasirCount = users.filter((u) => u.role === "KASIR").length;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const bertugasCount = users.filter(
    (u) =>
      u.lastTransactionAtIso &&
      new Date(u.lastTransactionAtIso).getTime() >= weekAgo,
  ).length;

  return (
    <div className="relative min-h-dvh bg-slate-100 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-60 dark:opacity-40" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        {/* ===== Topbar: breadcrumb + profil + tema ===== */}
        <motion.header
          variants={stagger}
          initial="hidden"
          animate="show"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <motion.div variants={fadeUp} className="min-w-0">
            <Link
              href="/dev"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
            >
              <LuArrowLeft className="h-3.5 w-3.5" />
              Konsol
              <LuChevronRight className="h-3 w-3" />
              <span className="text-slate-700 dark:text-slate-200">
                Kelola Akun
              </span>
            </Link>
            <p className="mt-1 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Kelola Akun
            </p>
          </motion.div>
          <motion.div variants={fadeUp} className="flex items-center gap-2.5">
            <ThemeToggle />
            <div className="flex items-center gap-2.5 rounded-full border border-slate-200/80 bg-white/70 py-1.5 pl-1.5 pr-4 backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/70">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white">
                {initials(userName || "Developer")}
              </div>
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-xs font-bold leading-tight">
                  {userName ?? "Developer"}
                </p>
                <p className="truncate text-[11px] text-slate-400">
                  {userEmail ?? ""}
                </p>
              </div>
            </div>
          </motion.div>
        </motion.header>

        {/* ===== Kartu metrik ===== */}
        <motion.section
          variants={stagger}
          initial="hidden"
          animate="show"
          className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          {[
            {
              icon: LuUsers,
              label: "Total akun",
              value: users.length,
              hint: "terdaftar & belum terhapus",
            },
            {
              icon: LuUserCheck,
              label: "Akun aktif",
              value: activeCount,
              hint: "boleh login sekarang",
            },
            {
              icon: LuStore,
              label: "Outlet terdaftar",
              value: outlets.length,
              hint: "pilihan ikatan akun",
            },
            {
              icon: LuShieldCheck,
              label: "Kasir bertugas",
              value: bertugasCount,
              hint: `dari ${kasirCount} kasir — jualan ≤ 7 hari`,
            },
          ].map((card) => (
            <motion.div
              key={card.label}
              variants={fadeUp}
              className="glass-card p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {card.label}
                </p>
                <card.icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                {card.value}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                {card.hint}
              </p>
            </motion.div>
          ))}
        </motion.section>

        {/* ===== Toolbar filter ===== */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="glass-card mt-4 grid gap-2.5 p-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div className="relative lg:col-span-2">
            <LuSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama / email…"
              className="glass-input pl-9"
            />
          </div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="glass-input"
            aria-label="Filter peran"
          >
            <option value="ALL">Semua peran</option>
            <option value="OWNER">Owner</option>
            <option value="KASIR">Kasir</option>
            <option value="DEVELOPER">Developer</option>
          </select>
          <select
            value={outlet}
            onChange={(e) => setOutlet(e.target.value)}
            className="glass-input"
            aria-label="Filter outlet"
          >
            <option value="ALL">Semua outlet</option>
            <option value="__none__">Tanpa outlet (owner global)</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="glass-input"
            aria-label="Filter status"
          >
            <option value="ALL">Semua status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </select>
        </motion.section>

        {/* ===== Tabel ===== */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="glass-card mt-3 overflow-hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 px-4 py-3 dark:border-slate-800/70">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {filtered.length} akun tampil · rantai: developer → owner → kasir
              · akun terhapus tidak lagi tampil (jejaknya ada di log)
            </p>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700"
            >
              <LuUserPlus className="h-4 w-4" />
              Akun Baru
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-slate-200/70 text-left text-[11px] tracking-wider text-slate-400 uppercase dark:border-slate-800/70 dark:text-slate-500">
                  <th className="px-4 pt-3 pb-2.5 font-semibold">Akun</th>
                  <th className="px-4 pt-3 pb-2.5 font-semibold">Peran</th>
                  <th className="px-4 pt-3 pb-2.5 font-semibold">Outlet</th>
                  <th className="px-4 pt-3 pb-2.5 font-semibold">Status</th>
                  <th className="px-4 pt-3 pb-2.5 font-semibold">
                    Transaksi Terakhir
                  </th>
                  <th className="px-4 pt-3 pb-2.5 text-right font-semibold">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {pageRows.map((user) => {
                    const isSelf = user.id === currentUserId;
                    // Baris developer & baris sendiri hanya bisa DILIHAT —
                    // semua tombol modifikasinya mati (server juga menolak).
                    const locked = user.role === "DEVELOPER" || isSelf;
                    const lockTitle = isSelf
                      ? "Akun Anda sendiri — ubah lewat Akun Saya"
                      : "Akun developer dikelola lewat DEV_SEED_* di .env";
                    const rv = roleView(user.role);
                    return (
                      <motion.tr
                        key={user.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="border-b border-slate-100/80 align-middle last:border-0 dark:border-slate-800/50"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-white/70 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                              {initials(user.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                                {user.name}
                                {isSelf && (
                                  <span className="ml-1.5 rounded-full border border-violet-500/20 bg-violet-500/10 px-1.5 py-0.5 align-middle text-[10px] font-bold text-violet-600 dark:text-violet-400">
                                    Anda
                                  </span>
                                )}
                              </p>
                              <p className="truncate text-xs text-slate-400">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${rv.badge}`}
                          >
                            {rv.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {user.outletName ?? (
                            <span className="text-slate-400 dark:text-slate-500">
                              {user.role === "OWNER" ? "Semua outlet" : "—"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {user.isActive ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              </span>
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-slate-400/20 bg-slate-400/10 px-2 py-0.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                              Nonaktif
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                          {formatWibShort(user.lastTransactionAtIso)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setEditing(user)}
                              disabled={locked}
                              title={locked ? lockTitle : "Ubah akun"}
                              aria-label={`Ubah ${user.name}`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300/80 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              <LuPencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setResetting(user)}
                              disabled={locked}
                              title={
                                locked
                                  ? lockTitle
                                  : "Reset password (tanpa pw lama)"
                              }
                              aria-label={`Reset password ${user.name}`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300/80 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              <LuKeyRound className="h-3.5 w-3.5" />
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
                              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-30 ${
                                user.isActive
                                  ? "border-slate-300/80 text-red-500 hover:bg-red-500/10 dark:border-slate-700"
                                  : "border-slate-300/80 text-emerald-600 hover:bg-emerald-500/10 dark:border-slate-700"
                              }`}
                            >
                              {togglingId === user.id ? (
                                <Spinner className="h-3.5 w-3.5" />
                              ) : user.isActive ? (
                                <LuArchive className="h-3.5 w-3.5" />
                              ) : (
                                <LuArchiveRestore className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleting(user)}
                              disabled={locked}
                              title={locked ? lockTitle : "Hapus akun permanen"}
                              aria-label={`Hapus ${user.name}`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/30 text-red-600 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-30 dark:text-red-400"
                            >
                              <LuTrash2 className="h-3.5 w-3.5" />
                            </button>
                            <Link
                              href={`/dev/logs?actor=${user.id}`}
                              title="Lihat jejak log aktor ini"
                              aria-label={`Jejak log ${user.name}`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300/80 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                            >
                              <LuScrollText className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
                {pageRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-slate-400"
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
        </motion.section>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400 dark:text-slate-500">
          <LuShieldCheck className="h-3.5 w-3.5" />
          Semua aksi di tabel ini tercatat di jejak audit backend-go
          (ACCOUNT_*), termasuk yang gagal.
        </p>
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
