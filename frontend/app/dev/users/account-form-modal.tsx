"use client";

// Modal buat / edit akun dari konsol developer — design v1.5.0 ala
// mockup Gemini (glass gelap, max-w-lg rounded-3xl, label uppercase,
// tombol gradien). LOGIC IDENTIK dengan versi sebelumnya:
// Create: nama, email, password awal (checklist hidup saat mengetik —
// kini 4 syarat: panjang, huruf besar, ANGKA, simbol), peran, outlet —
// dan opsi "+ Outlet baru…" yang membuat outlet SEBELUM akun (pola yang
// sama dengan "+ Kategori baru…" di form produk).
// Edit: sama tanpa password (reset password punya modal sendiri) +
// checkbox aktif. Semua field controlled state: nilai TIDAK PERNAH
// hilang saat submit gagal — pesan error muncul, form tetap terisi.
// Modal ikut tema aplikasi (varian dark:) — terang di tema terang,
// gelap di tema gelap, sama dengan halaman induknya.
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LuMapPin, LuShieldCheck, LuUserPlus, LuX } from "react-icons/lu";
import { PasswordInput } from "@/components/password-input";
import { SelectInput } from "@/components/select-input";
import { isPasswordValid } from "@/lib/password-policy";
import { createAccount, createOutlet, updateAccount } from "./actions";
import { roleBadgeDark } from "./view-helpers";
import type { OutletOption, UserRow } from "./types";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const LABEL_CLASS =
  "mb-1.5 block text-xs font-bold tracking-wider text-slate-600 uppercase dark:text-slate-300";

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
  const rb = roleBadgeDark(role);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={user ? `Ubah akun ${user.name}` : "Buat akun baru"}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="glass-card relative flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border-slate-300/80 dark:border-slate-700/80 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute top-5 right-5 rounded-lg p-1 text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
        >
          <LuX className="h-5 w-5" />
        </button>

        <div className="flex shrink-0 items-center space-x-3 px-6 pt-6 pb-5 sm:px-8">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-lg ${
              user
                ? "bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-blue-600/25"
                : "bg-gradient-to-tr from-blue-500 via-blue-600 to-indigo-600 shadow-blue-500/25"
            }`}
          >
            {user ? (
              <LuShieldCheck className="h-5 w-5" />
            ) : (
              <LuUserPlus className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-extrabold text-slate-900 dark:text-white">
              {user ? `Ubah Akun — ${user.name}` : "Tambah Akun Baru"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {user ? (
                <span
                  className={`rounded-lg border px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase ${rb.badge}`}
                >
                  {rb.label}
                </span>
              ) : (
                "Isi data dan tentukan tingkat hak akses pengguna."
              )}
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-2 sm:px-8">
          {error && (
            <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="acc-name" className={LABEL_CLASS}>
              Nama Lengkap
            </label>
            <input
              id="acc-name"
              className="glass-input w-full rounded-xl px-4 py-2.5 text-xs transition focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
              maxLength={60}
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="acc-email" className={LABEL_CLASS}>
              Email Pengguna
            </label>
            <input
              id="acc-email"
              type="email"
              className="glass-input w-full rounded-xl px-4 py-2.5 text-xs transition focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@warung.id"
              maxLength={100}
              autoComplete="off"
            />
          </div>

          {!user && (
            <div>
              <label htmlFor="acc-password" className={LABEL_CLASS}>
                Kata Sandi Awal
              </label>
              <div className="mt-1.5">
                <PasswordInput
                  id="acc-password"
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                  showChecklist
                />
              </div>
              <span className="mt-1 block text-[10px] text-slate-500">
                Minimal 8 karakter — wajib ada huruf besar, angka, dan simbol.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="acc-role" className={LABEL_CLASS}>
                Peran / Hak Akses
              </label>
              <SelectInput
                id="acc-role"
                value={role}
                onChange={(e) =>
                  setRole(e.target.value === "OWNER" ? "OWNER" : "KASIR")
                }
              >
                <option value="KASIR">Kasir (Terbatas)</option>
                <option value="OWNER">Owner (Akses Penuh Warung)</option>
              </SelectInput>
              <p className="mt-1 text-[10px] text-slate-500">
                Akun DEVELOPER tidak bisa dibuat dari sini.
              </p>
            </div>
            <div>
              <label htmlFor="acc-outlet" className={LABEL_CLASS}>
                Penempatan Outlet {outletRequired ? "(wajib)" : ""}
              </label>
              <SelectInput
                id="acc-outlet"
                value={outletId}
                onChange={(e) => setOutletId(e.target.value)}
              >
                <option value="">
                  {outletRequired
                    ? "— pilih outlet —"
                    : "Akses Global (Semua Outlet)"}
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
              </SelectInput>
            </div>
          </div>

          {creatingOutlet && (
            <div className="space-y-2 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                <LuMapPin className="h-3.5 w-3.5" />
                Outlet baru
              </p>
              <input
                className="glass-input w-full rounded-xl px-4 py-2.5 text-xs transition focus:outline-none"
                value={newOutletName}
                onChange={(e) => setNewOutletName(e.target.value)}
                placeholder="Nama outlet (mis. Warung Bu Sari 2)"
                maxLength={60}
                autoComplete="off"
              />
              <input
                className="glass-input w-full rounded-xl px-4 py-2.5 text-xs transition focus:outline-none"
                value={newOutletAddress}
                onChange={(e) => setNewOutletAddress(e.target.value)}
                placeholder="Alamat (opsional)"
                maxLength={120}
                autoComplete="off"
              />
              <p className="text-[11px] leading-relaxed text-slate-500">
                Outlet dibuat lebih dulu saat menekan tombol simpan, lalu akun
                otomatis terikat ke outlet itu. Gagal bikin outlet = tidak ada
                yang dibuat, isian tetap aman di layar.
              </p>
            </div>
          )}

          {user && (
            <label className="flex items-center gap-2.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2.5">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 accent-blue-500"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Akun aktif (bisa login)
              </span>
            </label>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end space-x-3 border-t border-slate-200 dark:border-slate-800 px-6 pt-4 pb-6 sm:px-8">
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
            disabled={pending}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition-all hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending && <Spinner className="h-3.5 w-3.5" />}
            {user ? "Simpan Akun" : "Buat Akun"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}