"use client";

// Formulir ganti password Akun Saya. Satu komponen dipakai semua peran —
// perbedaan peran hanya soal dari halaman mana pintasannya ditempel
// (header kasir, pengaturan owner, konsol developer).
import { useActionState, useState } from "react";
import { Check, KeyRound, Loader2, TriangleAlert } from "lucide-react";
import { PasswordInput } from "@/components/password-input";
import { changePasswordAction, type AccountActionState } from "./actions";

const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300";

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
          <p className="mt-1.5 text-xs font-medium text-rose-600">
            Belum sama dengan password baru.
          </p>
        )}
      </div>

      {state.message && (
        <p
          className={`flex items-center gap-1.5 text-sm font-medium ${
            state.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"
          }`}
        >
          {state.ok ? (
            <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
          ) : (
            <TriangleAlert className="h-4 w-4 shrink-0" />
          )}
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={
          pending ||
          confirmMismatch ||
          newPassword.length === 0 ||
          currentPassword.length === 0
        }
        className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
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