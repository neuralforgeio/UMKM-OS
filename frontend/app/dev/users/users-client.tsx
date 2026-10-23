"use client";

// Tabel kelola akun lintas outlet (Task 34 Fase B, diperbarui Task 35).
// Filter (cari/peran/outlet/status) + pagination 20 baris berjalan di
// klien mengikuti pola halaman produk — jumlah akun selalu kecil
// (puluhan), jadi memuat semua baris sekali jauh lebih responsif
// daripada query ulang server tiap ketik.
// Task 35: akun terhapus TIDAK PERNAH dikirim ke komponen ini (server
// memfilter deletedAt: null) — dari sudut pandang daftar, hapus =
// selamanya; jejaknya hidup di /dev/logs.
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  KeyRound,
  Loader2,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { TablePagination } from "@/components/table-pagination";
import { PasswordInput } from "@/components/password-input";
import { isPasswordValid } from "@/lib/password-policy";
import {
  deleteAccountSoft,
  resetAccountPassword,
  setAccountActive,
} from "./actions";
import { AccountFormModal } from "./account-form-modal";
import type { OutletOption, UserRow } from "./types";

const PAGE_SIZE = 20;

const ROLE_BADGE: Record<string, string> = {
  OWNER: "bg-blue-100 text-blue-700",
  KASIR: "bg-emerald-100 text-emerald-700",
  DEVELOPER: "bg-violet-100 text-violet-700",
};

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-100";

function formatWibShort(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

function StatusBadge({ user }: { user: UserRow }) {
  if (!user.isActive) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
        Nonaktif
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
      Aktif
    </span>
  );
}

// Modal kecil: reset password. Terpisah dari form utama supaya aksi
// sensitif ini selalu butuh langkah (dan niat) tersendiri.
// Task 35: input kini type password + toggle lihat + checklist syarat
// hidup; tombol aktif hanya saat semua syarat hijau.
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
        className="absolute inset-0 bg-slate-900/70"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <p className="truncate text-sm font-bold text-slate-900">
            Reset password — {user.name}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          {error && (
            <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
              {error}
            </p>
          )}
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="password baru"
            showChecklist
          />
          <p className="text-[11px] leading-relaxed text-slate-400">
            Password lama tidak perlu diketahui. Berlaku untuk login
            berikutnya; sesi yang sedang berjalan tidak diputus.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => startAsync(handleSubmit)}
            disabled={pending || !isPasswordValid(password)}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Reset Password
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal konfirmasi hapus. Teks sengaja tegas dan menjelaskan akibat
// persisnya: hilang dari daftar selamanya, email dibebaskan, jejak tetap.
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

  // Ketik email = konfirmasi yang tidak bisa dilakukan asal klik.
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
        className="absolute inset-0 bg-slate-900/70"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <p className="truncate text-sm font-bold text-slate-900">
            Hapus akun — {user.name}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          {error && (
            <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
              {error}
            </p>
          )}
          <p className="text-sm leading-relaxed text-slate-600">
            Akun dihapus <b className="text-slate-900">selamanya dari daftar</b>{" "}
            — tidak bisa dibatalkan, tidak bisa di-pulihkan dari konsol.
            Email <b>{user.email}</b> dibebaskan supaya bisa dipakai akun
            baru. Riwayat transaksi dan jejak log atas nama akun ini{" "}
            <b className="text-slate-900">tetap tersimpan</b> — penghapusan
            ini sendiri juga masuk log.
          </p>
          <div>
            <label className="text-xs font-semibold text-slate-500">
              Ketik email akun untuk konfirmasi
            </label>
            <input
              className={`${INPUT_CLASS} mt-1.5 font-mono`}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={user.email}
              autoComplete="off"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => startAsync(handleSubmit)}
            disabled={pending || !typedOk}
            className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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
}: {
  users: UserRow[];
  outlets: OutletOption[];
  currentUserId: string;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("ALL");
  const [outlet, setOutlet] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  // undefined = tertutup; null = modal buat; row = modal edit/reset/hapus.
  const [editing, setEditing] = useState<UserRow | null | undefined>(
    undefined,
  );
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((user) => {
      if (role !== "ALL" && user.role !== role) return false;
      if (outlet !== "ALL") {
        if (outlet === "__none__" ? user.outletId !== null : user.outletId !== outlet)
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

  const activeCount = users.filter((u) => u.isActive).length;

  return (
    <div className="min-h-dvh bg-slate-100">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:py-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight text-slate-900">
              Kelola Akun — semua outlet
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {users.length} akun · {activeCount} aktif · rantai: developer →
              owner → kasir · akun terhapus tidak lagi tampil (jejaknya ada
              di log)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700"
          >
            <UserPlus className="h-4 w-4" />
            Akun Baru
          </button>
        </header>

        <section className="mt-4 grid gap-2.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama / email…"
              className={`${INPUT_CLASS} pl-9`}
            />
          </div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={INPUT_CLASS}
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
            className={INPUT_CLASS}
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
            className={INPUT_CLASS}
            aria-label="Filter status"
          >
            <option value="ALL">Semua status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </select>
        </section>

        <section className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 pb-2.5 font-semibold">Akun</th>
                  <th className="px-4 pb-2.5 font-semibold">Peran</th>
                  <th className="px-4 pb-2.5 font-semibold">Outlet</th>
                  <th className="px-4 pb-2.5 font-semibold">Status</th>
                  <th className="px-4 pb-2.5 font-semibold">
                    Transaksi Terakhir
                  </th>
                  <th className="px-4 pb-2.5 text-right font-semibold">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((user) => {
                  const isSelf = user.id === currentUserId;
                  // Baris developer & baris sendiri hanya bisa DILIHAT —
                  // semua tombol modifikasinya mati (server juga menolak).
                  const locked = user.role === "DEVELOPER" || isSelf;
                  const lockTitle = isSelf
                    ? "Akun Anda sendiri — ubah lewat Akun Saya"
                    : "Akun developer dikelola lewat DEV_SEED_* di .env";
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-slate-100 last:border-0 align-middle"
                    >
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-slate-900">
                          {user.name}
                          {isSelf && (
                            <span className="ml-1.5 rounded-full bg-violet-100 px-1.5 py-0.5 align-middle text-[10px] font-bold text-violet-700">
                              Anda
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {user.email}
                        </p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ROLE_BADGE[user.role]}`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {user.outletName ?? (
                          <span className="text-slate-400">
                            {user.role === "OWNER" ? "Semua outlet" : "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge user={user} />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {formatWibShort(user.lastTransactionAtIso)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditing(user)}
                            disabled={locked}
                            title={locked ? lockTitle : "Ubah akun"}
                            aria-label={`Ubah ${user.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setResetting(user)}
                            disabled={locked}
                            title={
                              locked ? lockTitle : "Reset password (tanpa pw lama)"
                            }
                            aria-label={`Reset password ${user.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
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
                                ? "border-slate-300 text-red-500 hover:bg-red-50"
                                : "border-slate-300 text-emerald-600 hover:bg-emerald-50"
                            }`}
                          >
                            {togglingId === user.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : user.isActive ? (
                              <Archive className="h-3.5 w-3.5" />
                            ) : (
                              <ArchiveRestore className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(user)}
                            disabled={locked}
                            title={locked ? lockTitle : "Hapus akun permanen"}
                            aria-label={`Hapus ${user.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
        </section>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Semua aksi di tabel ini tercatat di jejak audit (ACCOUNT_*), termasuk
          yang gagal.
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
        <DeleteAccountModal
          user={deleting}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
