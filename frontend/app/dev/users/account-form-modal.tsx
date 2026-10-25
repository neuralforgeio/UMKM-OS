"use client";

// Modal buat / edit akun dari konsol developer — design language v1.3.0
// (glass, tema gelap/terang). LOGIC IDENTIK dengan versi sebelumnya:
// Create: nama, email, password awal (checklist hijau saat mengetik),
// peran, outlet — dan opsi "+ Outlet baru…" yang membuat outlet SEBELUM
// akun (pola yang sama dengan "+ Kategori baru…" di form produk).
// Edit: sama tanpa password (reset password punya modal sendiri).
// Semua field controlled state: nilai TIDAK PERNAH hilang saat submit
// gagal — pesan error muncul, form tetap terisi.
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LuMapPin, LuShieldCheck, LuUserPlus, LuX } from "react-icons/lu";
import { PasswordInput } from "@/components/password-input";
import { isPasswordValid } from "@/lib/password-policy";
import { createAccount, createOutlet, updateAccount } from "./actions";
import { roleView } from "./view-helpers";
import type { OutletOption, UserRow } from "./types";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const LABEL_CLASS =
  "text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400";

// Nilai sentinel pilihan "buat outlet baru dulu" — konvensi "__new__"
// disalin dari form produk (kategori) supaya perilakunya seragam.
const NEW_OUTLET = "__new__";

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

export function AccountFormModal({
  user,
  outlets,
  onClose,
}: {
  // null = mode buat akun baru; row = mode edit akun itu.
  user: UserRow | null;
  outlets: OutletOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pending, startAsync] = useTransition();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  // Baris DEVELOPER tidak pernah bisa dibuka edit (tombolnya mati), tapi
  // state tetap disempitkan eksplisit ke OWNER | KASIR supaya tipe input
  // action tidak pernah berbohong.
  const [role, setRole] = useState<"OWNER" | "KASIR">(
    user?.role === "OWNER" ? "OWNER" : "KASIR",
  );
  // "" = tanpa outlet (hanya sah untuk OWNER: akses semua outlet).
  const [outletId, setOutletId] = useState(user?.outletId ?? "");
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  // Field "outlet baru" — aktif hanya saat pilihan outlet = __new__.
  const [newOutletName, setNewOutletName] = useState("");
  const [newOutletAddress, setNewOutletAddress] = useState("");

  // Escape untuk menutup modal — sama seperti editor foto/gambar produk.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const outletRequired = role === "KASIR";
  const creatingOutlet = outletId === NEW_OUTLET;
  const rv = roleView(role);

  async function handleSubmit() {
    setError(null);

    // Langkah 1 — bila dipilih "+ Outlet baru…": buat outlet DULU.
    // Akun butuh id outlet nyata; kalau pembuatan outlet gagal, akun
    // tidak dibuat dan semua isian tetap ada di layar.
    let finalOutletId = outletId;
    if (creatingOutlet) {
      const trimmed = newOutletName.trim();
      if (trimmed.length < 2) {
        setError("Nama outlet baru minimal 2 karakter.");
        return;
      }
      const result = await createOutlet({
        name: trimmed,
        address: newOutletAddress.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      finalOutletId = result.outletId;
    }

    // Langkah 2 — validasi cepat di klien (server tetap memvalidasi
    // ulang; ini hanya supaya pesan muncul seketika tanpa round-trip).
    const inputOutlet = finalOutletId || null;
    if (outletRequired && !inputOutlet) {
      setError("Kasir wajib dipilihkan outlet.");
      return;
    }
    if (!user && !isPasswordValid(password)) {
      setError("Password belum memenuhi semua syarat (lihat checklist).");
      return;
    }

    // Langkah 3 — buat/ubah akun.
    const result = user
      ? await updateAccount({
          userId: user.id,
          name,
          email,
          role,
          outletId: inputOutlet,
          isActive,
        })
      : await createAccount({
          name,
          email,
          password,
          role,
          outletId: inputOutlet,
        });

    if (!result.ok) {
      setError(result.error);
      return;
    }
    // router.refresh() = server component mengambil data baru; modal
    // ditutup setelah baris baru benar-benar terlihat di tabel.
    startTransition(() => {
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={user ? `Ubah akun ${user.name}` : "Buat akun baru"}
    >
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="glass-card relative flex max-h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-4 dark:border-slate-800/70">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${
                user
                  ? "bg-violet-600"
                  : "bg-gradient-to-br from-violet-500 to-indigo-600"
              }`}
            >
              {user ? (
                <LuShieldCheck className="h-4 w-4" />
              ) : (
                <LuUserPlus className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                {user ? `Ubah akun — ${user.name}` : "Buat akun baru"}
              </p>
              {user && (
                <p className="text-[11px] text-slate-400">
                  <span
                    className={`rounded-full border px-1.5 py-0.5 font-bold ${rv.badge}`}
                  >
                    {rv.label}
                  </span>
                </p>
              )}
            </div>
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

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="acc-name" className={LABEL_CLASS}>
              Nama
            </label>
            <input
              id="acc-name"
              className="glass-input mt-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Budi Santoso"
              maxLength={60}
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="acc-email" className={LABEL_CLASS}>
              Email (untuk login)
            </label>
            <input
              id="acc-email"
              type="email"
              className="glass-input mt-1.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@contoh.com"
              maxLength={100}
              autoComplete="off"
            />
          </div>

          {!user && (
            <div>
              <label htmlFor="acc-password" className={LABEL_CLASS}>
                Password awal
              </label>
              <div className="mt-1.5">
                <PasswordInput
                  id="acc-password"
                  value={password}
                  onChange={setPassword}
                  placeholder="ketik untuk melihat syarat"
                  showChecklist
                />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                Disimpan ter-hash bcrypt di backend-go. User dapat menggantinya
                sendiri lewat ganti password biasa.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="acc-role" className={LABEL_CLASS}>
                Peran
              </label>
              <select
                id="acc-role"
                className="glass-input mt-1.5"
                value={role}
                onChange={(e) =>
                  setRole(e.target.value === "OWNER" ? "OWNER" : "KASIR")
                }
              >
                <option value="OWNER">Owner</option>
                <option value="KASIR">Kasir</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                Akun DEVELOPER tidak bisa dibuat dari sini.
              </p>
            </div>
            <div>
              <label htmlFor="acc-outlet" className={LABEL_CLASS}>
                Outlet {outletRequired ? "(wajib)" : "(opsional)"}
              </label>
              <select
                id="acc-outlet"
                className="glass-input mt-1.5"
                value={outletId}
                onChange={(e) => setOutletId(e.target.value)}
              >
                <option value="">
                  {outletRequired ? "— pilih outlet —" : "Semua outlet"}
                </option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
                {/* Pintu yang sama seperti "+ Kategori baru…" di form
                    produk: pilih, isi nama, selesai — tanpa keluar dari
                    form akun. */}
                <option value={NEW_OUTLET}>+ Outlet baru…</option>
              </select>
            </div>
          </div>

          {creatingOutlet && (
            <div className="space-y-2 rounded-xl border border-violet-500/20 bg-violet-500/10 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-violet-700 dark:text-violet-300">
                <LuMapPin className="h-3.5 w-3.5" />
                Outlet baru
              </p>
              <input
                className="glass-input"
                value={newOutletName}
                onChange={(e) => setNewOutletName(e.target.value)}
                placeholder="Nama outlet (mis. Warung Bu Sari 2)"
                maxLength={60}
                autoComplete="off"
              />
              <input
                className="glass-input"
                value={newOutletAddress}
                onChange={(e) => setNewOutletAddress(e.target.value)}
                placeholder="Alamat (opsional)"
                maxLength={120}
                autoComplete="off"
              />
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Outlet dibuat lebih dulu saat menekan tombol simpan, lalu akun
                otomatis terikat ke outlet itu. Gagal bikin outlet = tidak ada
                yang dibuat, isian tetap aman di layar.
              </p>
            </div>
          )}

          {user && (
            <label className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 px-3 py-2.5 dark:border-slate-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 accent-violet-600"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Akun aktif (bisa login)
              </span>
            </label>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200/70 px-5 py-4 dark:border-slate-800/70">
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
            disabled={pending}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending && <Spinner className="h-3.5 w-3.5" />}
            {user ? "Simpan" : "Buat Akun"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
