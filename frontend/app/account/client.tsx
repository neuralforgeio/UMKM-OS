"use client";

// Formulir-formulir Profil Saya (v2.2.0; v3.3.0 restyle bahasa desain
// baru — kartu seksi & judul kini disediakan page.tsx, komponen ini murni
// isi formulir). Satu berkas tiga komponen:
//   1. ProfilePhotoCard — avatar besar, unggah/hapus foto (wajah);
//   2. IdentityForm    — nama lengkap & email;
//   3. AccountForm     — ganti password (tidak berubah sejak v1.0.3).
// Semuanya server action ke backend-go (lihat ./actions.ts) — komponen
// ini tidak pernah memegang token sesi di browser.

import { useActionState, useRef, useState } from "react";
import {
  Camera,
  Check,
  KeyRound,
  Loader2,
  Trash2,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { PasswordInput } from "@/components/password-input";
import { UserAvatar } from "@/components/user-menu";
import type { UserMenuUser } from "@/components/user-menu";
import {
  changePasswordAction,
  deleteProfilePhotoAction,
  updateProfileAction,
  uploadProfilePhotoAction,
  type AccountActionState,
} from "./actions";

const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300";

function StatusMessage({ state }: { state: AccountActionState }) {
  if (!state.message) return null;
  return (
    <p
      className={`flex items-start gap-1.5 text-sm font-medium ${
        state.ok ? "text-success-strong" : "text-destructive"
      }`}
    >
      {state.ok ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} />
      ) : (
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      {state.message}
    </p>
  );
}

// =====================================================================
// 1) Foto profil — avatar besar + unggah + hapus
// =====================================================================
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function ProfilePhotoCard({ user }: { user: UserMenuUser }) {
  const [uploadState, uploadFormAction, uploading] = useActionState(
    uploadProfilePhotoAction,
    { ok: false, message: "" } satisfies AccountActionState,
  );
  const [deleteState, deleteFormAction, deleting] = useActionState(
    deleteProfilePhotoAction,
    { ok: false, message: "" } satisfies AccountActionState,
  );

  // Pratinjau lokal SEBELUM unggah: URL objek dari berkas yang baru
  // dipilih — pengguna melihat dulu potongannya, tombol Simpan yang
  // mengirim byte ke Go. Dibebaskan saat ganti pilihan/batal.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPickFile = (file: File | undefined) => {
    setFileError(null);
    if (!file || file.size === 0) {
      setPreviewUrl(null);
      setFileName(null);
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPreviewUrl(null);
      setFileName(null);
      setFileError("Foto terlalu besar (maks. 3 MB).");
      return;
    }
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      setPreviewUrl(null);
      setFileName(null);
      setFileError("Tipe berkas harus JPEG, PNG, atau WebP.");
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
    setFileName(file.name);
  };

  const cancelPick = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFileName(null);
    setFileError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        {/* Avatar saat ini atau pratinjau berkas baru */}
        <div className="relative">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Pratinjau foto baru"
              className="h-24 w-24 rounded-full object-cover ring-4 ring-primary/25"
            />
          ) : (
            <UserAvatar
              user={user}
              className="h-24 w-24 text-2xl ring-4 ring-slate-200/60 dark:ring-slate-700/60"
            />
          )}
          <span className="pointer-events-none absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
            <Camera className="h-4 w-4" />
          </span>
        </div>

        <div className="w-full flex-1 space-y-3">
          {/* Unggah: input file disembunyikan, label jadi tombol.
              Form terkirim saat "Simpan Foto" (atau batal membatalkan). */}
          <form
            action={uploadFormAction}
            className="space-y-3"
            onSubmit={(e) => {
              // Tanpa berkas terpilih tidak ada yang bisa disimpan.
              if (!fileName) e.preventDefault();
            }}
          >
            <input
              ref={inputRef}
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0])}
            />

            <div className="flex flex-wrap items-center gap-2">
              {previewUrl ? (
                <>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover disabled:opacity-60"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Simpan Foto
                  </button>
                  <button
                    type="button"
                    onClick={cancelPick}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60"
                  >
                    Batal
                  </button>
                  <span className="w-full truncate text-xs text-slate-400 sm:w-auto">
                    {fileName}
                  </span>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60"
                >
                  <Camera className="h-4 w-4" />
                  {user.photoVersion > 0 ? "Ganti Foto" : "Unggah Foto"}
                </button>
              )}
            </div>

            {fileError && (
              <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                <TriangleAlert className="h-4 w-4 shrink-0" />
                {fileError}
              </p>
            )}
            <StatusMessage state={uploadState} />
          </form>

          {/* Hapus: hanya masuk akal bila foto sudah ada. */}
          {user.photoVersion > 0 && !previewUrl && (
            <form action={deleteFormAction}>
              <button
                type="submit"
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Hapus Foto
              </button>
              <StatusMessage state={deleteState} />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// 2) Identitas — nama lengkap & email
// =====================================================================
export function IdentityForm({
  initialName,
  initialEmail,
}: {
  initialName: string;
  initialEmail: string;
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, {
    ok: false,
    message: "",
  } satisfies AccountActionState);

  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const dirty = name !== initialName || email !== initialEmail;

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="name" className={labelClass}>
          Nama lengkap
        </label>
        <div className="mt-1.5">
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama yang tampil di navbar & struk"
            className="glass-input w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <div className="mt-1.5">
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={200}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@contoh.id"
            className="glass-input w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
          Email dipakai untuk login — pastikan Anda mengingatnya.
        </p>
      </div>

      <StatusMessage state={state} />

      <button
        type="submit"
        disabled={pending || !dirty || name.trim().length === 0}
        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UserRound className="h-4 w-4" />
        )}
        Simpan Profil
      </button>
    </form>
  );
}

// =====================================================================
// 3) Ganti password (v1.0.3 — perilaku dipertahankan apa adanya)
// =====================================================================
export function AccountForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, {
    ok: false,
    message: "",
  } satisfies AccountActionState);

  // Nilai dikontrol manual supaya konfirmasi bisa divalidasi SEBELUM
  // submit (pesan instan, bukan bolak-balik ke server). Name pada input
  // membuat FormData terisi otomatis saat submit.
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const confirmMismatch =
    confirmPassword.length > 0 && confirmPassword !== newPassword;

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="current_password" className={labelClass}>
          Password saat ini
        </label>
        <div className="mt-1.5">
          <PasswordInput
            id="current_password"
            name="current_password"
            value={currentPassword}
            onChange={setCurrentPassword}
            placeholder="Password yang dipakai login sekarang"
            autoComplete="current-password"
          />
        </div>
      </div>

      <div>
        <label htmlFor="new_password" className={labelClass}>
          Password baru
        </label>
        <div className="mt-1.5">
          <PasswordInput
            id="new_password"
            name="new_password"
            value={newPassword}
            onChange={setNewPassword}
            placeholder="Minimal 8 karakter, huruf besar, simbol"
            autoComplete="new-password"
            showChecklist
          />
        </div>
      </div>

      <div>
        <label htmlFor="confirm_password" className={labelClass}>
          Ulangi password baru
        </label>
        <div className="mt-1.5">
          <PasswordInput
            id="confirm_password"
            name="confirm_password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Ketik ulang password baru"
            autoComplete="new-password"
          />
        </div>
        {confirmMismatch && (
          <p className="mt-1.5 text-xs font-medium text-destructive">
            Belum sama dengan password baru.
          </p>
        )}
      </div>

      <StatusMessage state={state} />

      <button
        type="submit"
        disabled={
          pending ||
          confirmMismatch ||
          newPassword.length === 0 ||
          currentPassword.length === 0
        }
        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <KeyRound className="h-4 w-4" />
        )}
        Ganti Password
      </button>
    </form>
  );
}
