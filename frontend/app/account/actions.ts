"use server";

// Server action Akun Saya (v1.0.3): ganti password mandiri untuk SEMUA
// peran (OWNER / CASHIER / DEVELOPER). Memanggil backend-go langsung —
// tidak menyentuh Prisma sama sekali — supaya password yang dipakai saat
// LOGIN (backend-go) dan password yang diubah di sini tidak pernah
// berpisah sumber kebenaran lagi (pelajaran bug reset password konsol
// dev era split-brain).

import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { failedPasswordRules, isPasswordValid } from "@/lib/password-policy";

export type AccountActionState = { ok: boolean; message: string };

export async function changePasswordAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, message: "Sesi tidak valid — silakan login ulang." };
  }
  if (!session.user.goToken) {
    return {
      ok: false,
      message: "Sesi tidak memiliki token backend — silakan login ulang.",
    };
  }
  const token = session.user.goToken;

  const currentPassword = String(formData.get("current_password") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!currentPassword) {
    return { ok: false, message: "Password saat ini wajib diisi." };
  }
  // Kebijakan password UMKM OS dipakai di SEMUA pintu ganti password —
  // UI bisa dipalsukan, validasi server action tidak.
  if (!isPasswordValid(newPassword)) {
    const failed = failedPasswordRules(newPassword);
    return {
      ok: false,
      message: `Password baru belum memenuhi: ${failed.join(", ")}.`,
    };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, message: "Konfirmasi password tidak sama." };
  }

  const res = await goFetch<{ message: string }>(
    token,
    "/auth/change-password",
    {
      method: "POST",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    },
  );
  if (!res.ok) {
    // Pesan sudah ramah dari backend, mis. "Password saat ini salah".
    return { ok: false, message: res.message };
  }

  return {
    ok: true,
    message:
      "Password berhasil diganti. Sesi ini tetap aktif — login berikutnya memakai password baru.",
  };
}
