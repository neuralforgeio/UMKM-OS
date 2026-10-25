"use server";
// Kelola akun + outlet oleh DEVELOPER — kini SEPENUHNYA via backend-go
// (Tahap 6 redo, batch 2). Tidak ada lagi import prisma/bcrypt/audit di
// file ini: validasi, hash, dan pencatatan audit berjalan di Go, dan
// jejaknya dibaca lewat GET /audit-logs / export CSV.
//
// Rantai penciptaan akun tetap ditegakkan DI SANA (server Go):
//   seed (.env) -> DEVELOPER -> OWNER (per outlet) -> KASIR (outlet sama).
// Akun DEVELOPER tidak pernah bisa dibuat/diubah dari konsol.
//
// Kebijakan password frontend TETAP 8 karakter + huruf besar + simbol
// (lib/password-policy) — lantai Go hanya 6 karakter, jadi lapisan ini
// lebih ketat demi konsistensi UX dengan checklist PasswordInput.
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { isPasswordValid, failedPasswordRules } from "@/lib/password-policy";
import { toGoRole } from "./view-helpers";
import type { GoOutletDTO } from "./view-helpers";

// Sama bentuk dengan versi Prisma: gagal validasi = pesan ramah.
export type AccountActionResult = { ok: true } | { ok: false; error: string };

export type CreateAccountInput = {
  name: string;
  email: string;
  password: string;
  role: "OWNER" | "KASIR";
  // KASIR wajib; OWNER boleh kosong (= akses semua outlet).
  outletId: string | null;
};

export type UpdateAccountInput = {
  userId: string;
  name: string;
  email: string;
  role: "OWNER" | "KASIR";
  outletId: string | null;
  isActive: boolean;
};

export type CreateOutletResult =
  | { ok: true; outletId: string; outletName: string }
  | { ok: false; error: string };

const DEV_ONLY_ERROR =
  "Hanya developer yang boleh mengelola akun lewat konsol ini.";

// Sesi developer + token Go: tanpa keduanya aksi langsung ditolak tanpa
// menyentuh jaringan.
async function devSession(): Promise<{ id: string; goToken: string } | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "DEVELOPER") {
    return null;
  }
  const goToken = session.user.goToken ?? "";
  if (!goToken) return null;
  return { id: session.user.id, goToken };
}

// ---- Validasi klien (cermin cepat; Go memvalidasi ulang) ---------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanName(raw: unknown): string {
  const name = String(raw ?? "").trim();
  if (name.length < 2) throw new Error("Nama minimal 2 karakter.");
  if (name.length > 60) throw new Error("Nama maksimal 60 karakter.");
  return name;
}

function cleanEmail(raw: unknown): string {
  const email = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (email.length > 100 || !EMAIL_RE.test(email)) {
    throw new Error("Format email tidak valid.");
  }
  return email;
}

function cleanPassword(raw: unknown): string {
  const password = String(raw ?? "");
  if (password.length > 72) {
    throw new Error("Password maksimal 72 karakter.");
  }
  if (!isPasswordValid(password)) {
    const missing = failedPasswordRules(password).join(", ");
    throw new Error(`Password belum memenuhi syarat: ${missing}.`);
  }
  return password;
}

function revalidateAccountSurfaces() {
  revalidatePath("/dev/users");
  revalidatePath("/dev");
}

// ---- Buat outlet --------------------------------------------------------
// Dipakai form akun ("+ Outlet baru…") dan tombol "Outlet Baru" konsol.
// Endpoint: POST /api/v1/outlets (khusus DEVELOPER di sisi Go).

export async function createOutlet(input: {
  name: string;
  address?: string;
}): Promise<CreateOutletResult> {
  const dev = await devSession();
  if (!dev) return { ok: false, error: DEV_ONLY_ERROR };

  try {
    const name = cleanName(input.name);
    const address = String(input.address ?? "")
      .trim()
      .slice(0, 120);

    const res = await goFetch<GoOutletDTO>(dev.goToken, "/outlets", {
      method: "POST",
      body: JSON.stringify({ name, address, phone: "" }),
    });
    if (!res.ok) {
      // Pesan Go sudah ramah (mis. nama kembar, minimal 2 karakter).
      return { ok: false, error: res.message };
    }
    revalidateAccountSurfaces();
    return {
      ok: true,
      outletId: String(res.data.id),
      outletName: res.data.name,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Gagal membuat outlet.",
    };
  }
}

// ---- Buat akun -----------------------------------------------------------
// POST /api/v1/users {name,email,password,role,outlet_id}
// Go memakai CASHIER; UI memakai KASIR — konversi di view-helpers.

export async function createAccount(
  input: CreateAccountInput,
): Promise<AccountActionResult> {
  const dev = await devSession();
  if (!dev) return { ok: false, error: DEV_ONLY_ERROR };

  try {
    const name = cleanName(input.name);
    const email = cleanEmail(input.email);
    const password = cleanPassword(input.password);
    if (input.role !== "OWNER" && input.role !== "KASIR") {
      throw new Error("Peran harus OWNER atau KASIR.");
    }
    if (input.role === "KASIR" && !input.outletId) {
      throw new Error("Kasir wajib terikat ke satu outlet.");
    }

    const res = await goFetch(dev.goToken, "/users", {
      method: "POST",
      body: JSON.stringify({
        name,
        email,
        password,
        role: toGoRole(input.role),
        outlet_id: input.outletId ? Number(input.outletId) : null,
      }),
    });
    if (!res.ok) {
      return { ok: false, error: res.message };
    }
    revalidateAccountSurfaces();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Gagal membuat akun.",
    };
  }
}

// ---- Ubah akun ------------------------------------------------------------
// PUT /api/v1/users/{id} — patch parsial. Konvensi outlet_id di sisi Go:
//   null = JANGAN sentuh; 0 = LEPAS ikatan; >0 = ikat ke outlet itu.
// Form selalu mengirim nilai final pilihan user, jadi "tanpa outlet"
// dikirim sebagai 0 (lepas), bukan null (biarkan).

export async function updateAccount(
  input: UpdateAccountInput,
): Promise<AccountActionResult> {
  const dev = await devSession();
  if (!dev) return { ok: false, error: DEV_ONLY_ERROR };

  try {
    const userId = Number(input.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error("ID akun tidak valid.");
    }
    if (input.userId === dev.id) {
      throw new Error("Gunakan Akun Saya untuk akun Anda.");
    }
    const name = cleanName(input.name);
    const email = cleanEmail(input.email);
    if (input.role !== "OWNER" && input.role !== "KASIR") {
      throw new Error("Peran harus OWNER atau KASIR.");
    }
    if (input.role === "KASIR" && !input.outletId) {
      throw new Error("Kasir wajib terikat ke satu outlet.");
    }

    const res = await goFetch(dev.goToken, `/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify({
        name,
        email,
        role: toGoRole(input.role),
        outlet_id: input.outletId ? Number(input.outletId) : 0,
        is_active: input.isActive,
      }),
    });
    if (!res.ok) {
      return { ok: false, error: res.message };
    }
    // jwt-recheck di lib/auth.ts menyinkronkan peran/outlet sesi user
    // paling lama 5 menit — promosi/demosi berlaku tanpa login ulang.
    revalidateAccountSurfaces();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Gagal memperbarui akun.",
    };
  }
}

// ---- Reset password -------------------------------------------------------
// PUT /api/v1/users/{id} {"password": "..."} — patch satu field.
// Password lama tidak perlu diketahui; sesi berjalan tidak diputus
// (kecuali akun dinonaktifkan — itu jwt-recheck).

export async function resetAccountPassword(input: {
  userId: string;
  newPassword: string;
}): Promise<AccountActionResult> {
  const dev = await devSession();
  if (!dev) return { ok: false, error: DEV_ONLY_ERROR };

  try {
    const userId = Number(input.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error("ID akun tidak valid.");
    }
    const password = cleanPassword(input.newPassword);

    const res = await goFetch(dev.goToken, `/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      return { ok: false, error: res.message };
    }
    revalidateAccountSurfaces();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Gagal mereset password.",
    };
  }
}

// ---- Aktif / nonaktif -----------------------------------------------------

export async function setAccountActive(input: {
  userId: string;
  isActive: boolean;
}): Promise<AccountActionResult> {
  const dev = await devSession();
  if (!dev) return { ok: false, error: DEV_ONLY_ERROR };

  try {
    const userId = Number(input.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error("ID akun tidak valid.");
    }
    if (input.userId === dev.id && !input.isActive) {
      throw new Error("Anda tidak bisa menonaktifkan akun Anda sendiri.");
    }

    const res = await goFetch(dev.goToken, `/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ is_active: input.isActive }),
    });
    if (!res.ok) {
      return { ok: false, error: res.message };
    }
    // Nonaktif = sesi diputus jwt-recheck maks 5 menit; aktif kembali =
    // login normal. Jeda ini jujur dan jejaknya ada di audit Go.
    revalidateAccountSurfaces();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Gagal mengubah status akun.",
    };
  }
}

// ---- Hapus lembut ---------------------------------------------------------
// DELETE /api/v1/users/{id}: baris tetap ada (FK transaksi/stok/audit
// valid), email ditukar jadi alamat sampah supaya bebas dipakai ulang,
// dan daftar tidak pernah menampilkan akun terhapus lagi.

export async function deleteAccountSoft(input: {
  userId: string;
}): Promise<AccountActionResult> {
  const dev = await devSession();
  if (!dev) return { ok: false, error: DEV_ONLY_ERROR };

  try {
    const userId = Number(input.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error("ID akun tidak valid.");
    }
    if (input.userId === dev.id) {
      throw new Error("Anda tidak bisa menghapus akun Anda sendiri.");
    }

    const res = await goFetch(dev.goToken, `/users/${userId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      return { ok: false, error: res.message };
    }
    revalidateAccountSurfaces();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Gagal menghapus akun.",
    };
  }
}
