"use server";

// Server action Akun Saya / Profil (v1.0.3 ganti password; v2.2.0
// identitas + foto profil). Semua aksi memanggil backend-go langsung —
// satu-satunya pihak yang mengenal hash password dan tabel users —
// sehingga sumber kebenaran tidak pernah berpisah (pelajaran era
// split-brain Prisma).
//
// Pembaruan identitas & foto lewat pintu /me milik Go: hanya bisa
// menyentuh baris akun PEMANGGIL sendiri. Role, status aktif, ikatan
// outlet, dan akun orang lain tidak tersentuh dari sini.

import { revalidatePath } from "next/cache";
import { auth, unstable_update } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { failedPasswordRules, isPasswordValid } from "@/lib/password-policy";

export type AccountActionState = { ok: boolean; message: string };

const NO_SESSION: AccountActionState = {
  ok: false,
  message: "Sesi tidak valid — silakan login ulang.",
};

const NO_TOKEN: AccountActionState = {
  ok: false,
  message: "Sesi tidak memiliki token backend — silakan login ulang.",
};

// Batas sama dengan Go (backend-go/internal/handler/image.go): 3 MB,
// JPEG/PNG/WebP. Dicek di sini SEBELUM byte diunggah supaya pengguna
// langsung tahu, dan tetap ditegakkan ulang di Go (UI bisa dipalsukan,
// server action tidak).
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

// =====================================================================
// Ganti password (v1.0.3 — tidak berubah)
// =====================================================================
export async function changePasswordAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const session = await auth();
  if (!session?.user) return NO_SESSION;
  if (!session.user.goToken) return NO_TOKEN;
  const token = session.user.goToken;

  const currentPassword = String(formData.get("current_password") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!currentPassword) {
    return { ok: false, message: "Password saat ini wajib diisi." };
  }
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

// =====================================================================
// Identitas: nama & email (v2.2.0 — PUT /me)
// =====================================================================
export async function updateProfileAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const session = await auth();
  if (!session?.user) return NO_SESSION;
  if (!session.user.goToken) return NO_TOKEN;
  const token = session.user.goToken;

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (name.length === 0) {
    return { ok: false, message: "Nama tidak boleh kosong." };
  }
  if (name.length > 100) {
    return { ok: false, message: "Nama maksimal 100 karakter." };
  }
  if (email.length === 0 || !email.includes("@") || email.length > 200) {
    return { ok: false, message: "Email tidak valid." };
  }

  const res = await goFetch<{ name: string; email: string }>(
    token,
    "/me",
    {
      method: "PUT",
      body: JSON.stringify({ name, email }),
    },
  );
  if (!res.ok) {
    // Pesan sudah ramah dari Go ("Email sudah dipakai akun lain", dst).
    return { ok: false, message: res.message };
  }

  // v2.4.1: nama & email baru langsung disuntik ke token sesi (cookie
  // JWT ditulis ulang lewat unstable_update) — navbar SEMUA halaman
  // mengikuti seketika; dulu harus menunggu jwt-recheck 5 menit atau
  // login ulang (akar bug "profil tidak terdeteksi di halaman lain").
  try {
    await unstable_update({
      user: {
        name: res.data?.name ?? name,
        email: res.data?.email ?? email,
      },
    });
  } catch {
    // Suntikan sesi gagal bukan berarti profil gagal tersimpan —
    // jwt-recheck 5 menit tetap menyinkronkan belakangan.
  }

  // Halaman profil ini membaca segar dari Go — render ulang sekarang.
  revalidatePath("/account");
  return {
    ok: true,
    message: "Profil tersimpan — nama & email di navbar langsung mengikuti.",
  };
}

// =====================================================================
// Foto profil (v2.2.0 — POST /me/photo multipart)
// =====================================================================
export async function uploadProfilePhotoAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const session = await auth();
  if (!session?.user) return NO_SESSION;
  if (!session.user.goToken) return NO_TOKEN;
  const token = session.user.goToken;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Pilih berkas foto terlebih dahulu." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, message: "Foto terlalu besar (maks. 3 MB)." };
  }
  if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
    return {
      ok: false,
      message: "Tipe berkas harus JPEG, PNG, atau WebP.",
    };
  }

  // goFetch membiarkan FormData tanpa Content-Type supaya boundary
  // multipart terpasang otomatis — sama dengan unggah foto produk.
  const body = new FormData();
  body.append("file", file);

  const res = await goFetch<{ photo_version: number }>(
    token,
    "/me/photo",
    { method: "POST", body },
  );
  if (!res.ok) {
    return { ok: false, message: res.message };
  }

  // v2.4.1: versi foto baru langsung disuntik ke token sesi — avatar
  // navbar SEMUA halaman memakai foto baru tanpa menunggu recheck
  // 5 menit / login ulang (akar bug "foto tidak terdeteksi di halaman
  // lain": photoVersion lama 0 di JWT membuat navbar tetap inisial).
  try {
    await unstable_update({
      user: {
        photoVersion:
          typeof res.data?.photo_version === "number"
            ? res.data.photo_version
            : 0,
      },
    });
  } catch {
    // Suntikan sesi gagal bukan kegagalan unggah — recheck 5 menit
    // tetap menyinkronkan belakangan.
  }

  revalidatePath("/account");
  return {
    ok: true,
    message: "Foto profil diperbarui — avatar navbar langsung mengikuti.",
  };
}

export async function deleteProfilePhotoAction(
  _prev: AccountActionState,
  _formData: FormData,
): Promise<AccountActionState> {
  const session = await auth();
  if (!session?.user) return NO_SESSION;
  if (!session.user.goToken) return NO_TOKEN;
  const token = session.user.goToken;

  // v2.4.1: Go tetap menaikkan photo_version saat hapus (cache-bust);
  // versi itu disuntik ke sesi — UserAvatar melihat 404 lalu jatuh ke
  // inisial nama (fallback yang sudah ada sejak v2.2.0).
  const res = await goFetch<{ message: string; photo_version?: number }>(
    token,
    "/me/photo",
    { method: "DELETE" },
  );
  if (!res.ok) {
    return { ok: false, message: res.message };
  }

  try {
    await unstable_update({
      user: {
        photoVersion:
          typeof res.data?.photo_version === "number"
            ? res.data.photo_version
            : 0,
      },
    });
  } catch {
    // Suntikan sesi gagal bukan kegagalan hapus — recheck 5 menit
    // tetap menyinkronkan belakangan.
  }

  revalidatePath("/account");
  return {
    ok: true,
    message: "Foto profil dihapus — avatar kembali ke inisial nama.",
  };
}
