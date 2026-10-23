"use server";
// Kelola akun oleh DEVELOPER (Task 34, Fase B).
//
// Rantai penciptaan akun ditegakkan DI SINI (server), bukan hanya di UI:
//   seed (.env) -> DEVELOPER -> OWNER (per outlet) -> KASIR (outlet sama).
// Konsol developer boleh membuat/mengubah OWNER & KASIR saja — akun
// DEVELOPER tidak pernah bisa dibuat atau diubah dari konsol, sehingga
// satu-satunya jalur ke peran tertinggi tetap environment variable yang
// dikendalikan pemilik deployment.
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

// Sama pola dengan ProductActionError: gagal validasi = pesan ramah,
// bukan stack trace ke pengguna.
class AccountActionError extends Error {}

export type AccountActionResult =
  | { ok: true }
  | { ok: false; error: string };

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

// Pintu masuk SEMUA aksi di file ini: hanya DEVELOPER. Tanpa ini, owner
// atau kasir yang memalsukan request masih bisa mengubah akun lintas
// outlet — guard UI hanya menyembunyikan tombol, bukan menutup pintu.
async function requireDeveloper(): Promise<{ userId: string }> {
  const session = await auth();
  if (!session?.user) {
    throw new AccountActionError("Sesi sudah berakhir. Silakan login ulang.");
  }
  if (session.user.role !== "DEVELOPER") {
    throw new AccountActionError(
      "Hanya developer yang boleh mengelola akun lewat konsol ini.",
    );
  }
  return { userId: session.user.id };
}

// Target yang sah untuk konsol: akun OWNER/KASIR milik outlet yang ada.
// Akun DEVELOPER ditolak dengan pesan eksplisit (jalurnya lewat seed).
async function loadManagedTarget(userId: string) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      outletId: true,
      isActive: true,
      deletedAt: true,
    },
  });
  if (!target) {
    throw new AccountActionError("Akun tidak ditemukan.");
  }
  if (target.role === "DEVELOPER") {
    throw new AccountActionError(
      "Akun developer hanya dikelola lewat DEV_SEED_* di .env — bukan konsol.",
    );
  }
  return target;
}

// ---- Validasi bersama -------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanName(raw: unknown): string {
  const name = String(raw ?? "").trim();
  if (name.length < 2) {
    throw new AccountActionError("Nama minimal 2 karakter.");
  }
  if (name.length > 60) {
    throw new AccountActionError("Nama maksimal 60 karakter.");
  }
  return name;
}

function cleanEmail(raw: unknown): string {
  const email = String(raw ?? "").trim().toLowerCase();
  if (email.length > 100 || !EMAIL_RE.test(email)) {
    throw new AccountActionError("Format email tidak valid.");
  }
  return email;
}

// bcrypt memotong input di 72 byte — divalidasi di depan supaya user
// tidak merasa password 90 karakternya "kuat" padahal terpotong.
function cleanPassword(raw: unknown): string {
  const password = String(raw ?? "");
  if (password.length < 8) {
    throw new AccountActionError("Password minimal 8 karakter.");
  }
  if (password.length > 72) {
    throw new AccountActionError("Password maksimal 72 karakter.");
  }
  return password;
}

async function assertEmailFree(email: string, exceptUserId?: string) {
  const clash = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (clash && clash.id !== exceptUserId) {
    throw new AccountActionError("Email sudah dipakai akun lain.");
  }
}

async function resolveOutlet(outletId: string | null, role: string) {
  if (role === "KASIR" && !outletId) {
    throw new AccountActionError("Kasir wajib terikat ke satu outlet.");
  }
  if (!outletId) return null; // OWNER tanpa outlet = akses semua outlet
  const outlet = await prisma.outlet.findUnique({
    where: { id: outletId },
    select: { id: true, name: true },
  });
  if (!outlet) {
    throw new AccountActionError("Outlet tidak ditemukan.");
  }
  return outlet;
}

function revalidateAccountSurfaces() {
  revalidatePath("/dev/users");
  revalidatePath("/dev");
}

// ---- Aksi ---------------------------------------------------------------

export async function createAccount(
  input: CreateAccountInput,
): Promise<AccountActionResult> {
  try {
    const dev = await requireDeveloper();
    const name = cleanName(input.name);
    const email = cleanEmail(input.email);
    const password = cleanPassword(input.password);
    if (input.role !== "OWNER" && input.role !== "KASIR") {
      throw new AccountActionError("Peran harus OWNER atau KASIR.");
    }
    const outlet = await resolveOutlet(input.outletId, input.role);
    await assertEmailFree(email);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: await bcrypt.hash(password, 10),
        role: input.role,
        outletId: outlet?.id ?? null,
      },
      select: { id: true },
    });

    await audit({
      actorId: dev.userId,
      outletId: outlet?.id ?? null,
      action: "ACCOUNT_CREATE",
      entity: `user:${user.id}`,
      summary: `Akun ${name} (${input.role}) dibuat${outlet ? ` untuk ${outlet.name}` : ""}`,
      meta: { email, role: input.role, outlet: outlet?.name ?? null },
    });
    revalidateAccountSurfaces();
    return { ok: true };
  } catch (error) {
    if (error instanceof AccountActionError) {
      return { ok: false, error: error.message };
    }
    // P2002 = unique constraint email (race antara cek dan create).
    const msg = `${(error as { code?: string }).code ?? ""}`;
    if (msg.includes("P2002")) {
      return { ok: false, error: "Email sudah dipakai akun lain." };
    }
    console.error("createAccount:", error);
    return { ok: false, error: "Gagal membuat akun. Coba lagi." };
  }
}

export async function updateAccount(
  input: UpdateAccountInput,
): Promise<AccountActionResult> {
  try {
    const dev = await requireDeveloper();
    const target = await loadManagedTarget(input.userId);
    if (target.id === dev.userId) {
      // Tidak akan terjadi lewat UI (tombol self disabled), tapi pintu
      // server tetap ditutup: developer tidak menurunkan dirinya sendiri.
      throw new AccountActionError("Gunakan Akun Saya untuk akun Anda.");
    }
    const name = cleanName(input.name);
    const email = cleanEmail(input.email);
    if (input.role !== "OWNER" && input.role !== "KASIR") {
      throw new AccountActionError("Peran harus OWNER atau KASIR.");
    }
    const outlet = await resolveOutlet(input.outletId, input.role);
    await assertEmailFree(email, target.id);

    await prisma.user.update({
      where: { id: target.id },
      data: {
        name,
        email,
        role: input.role,
        outletId: outlet?.id ?? null,
        isActive: input.isActive,
      },
    });

    // jwt-recheck (Fase A) menyinkronkan peran/outlet ke sesi user ini
    // paling lama 5 menit — promosi/demosi berlaku tanpa login ulang.
    await audit({
      actorId: dev.userId,
      outletId: outlet?.id ?? null,
      action: "ACCOUNT_UPDATE",
      entity: `user:${target.id}`,
      summary: `Akun ${name} diperbarui — ${input.role}${outlet ? ` @ ${outlet.name}` : ""}, ${input.isActive ? "aktif" : "nonaktif"}`,
      meta: {
        email,
        role: input.role,
        outlet: outlet?.name ?? null,
        isActive: input.isActive,
      },
    });
    revalidateAccountSurfaces();
    return { ok: true };
  } catch (error) {
    if (error instanceof AccountActionError) {
      return { ok: false, error: error.message };
    }
    const msg = `${(error as { code?: string }).code ?? ""}`;
    if (msg.includes("P2002")) {
      return { ok: false, error: "Email sudah dipakai akun lain." };
    }
    console.error("updateAccount:", error);
    return { ok: false, error: "Gagal memperbarui akun. Coba lagi." };
  }
}

export async function resetAccountPassword(input: {
  userId: string;
  newPassword: string;
}): Promise<AccountActionResult> {
  try {
    const dev = await requireDeveloper();
    const target = await loadManagedTarget(input.userId);
    const password = cleanPassword(input.newPassword);

    await prisma.user.update({
      where: { id: target.id },
      data: { password: await bcrypt.hash(password, 10) },
    });

    // Catatan desain: sesi user TIDAK diputus — jwt-recheck hanya menghapus
    // sesi untuk akun nonaktif/terhapus. Password baru berlaku saat login
    // berikutnya; memutus semua sesi aktif menyusul ketika ada daftar sesi.
    await audit({
      actorId: dev.userId,
      outletId: target.outletId,
      action: "ACCOUNT_PASSWORD_RESET",
      entity: `user:${target.id}`,
      summary: `Password akun ${target.name} direset oleh developer`,
      meta: { email: target.email },
    });
    revalidateAccountSurfaces();
    return { ok: true };
  } catch (error) {
    if (error instanceof AccountActionError) {
      return { ok: false, error: error.message };
    }
    console.error("resetAccountPassword:", error);
    return { ok: false, error: "Gagal mereset password. Coba lagi." };
  }
}

export async function setAccountActive(input: {
  userId: string;
  isActive: boolean;
}): Promise<AccountActionResult> {
  try {
    const dev = await requireDeveloper();
    const target = await loadManagedTarget(input.userId);
    if (target.id === dev.userId) {
      throw new AccountActionError(
        "Anda tidak bisa menonaktifkan akun Anda sendiri.",
      );
    }
    if (target.deletedAt && input.isActive) {
      throw new AccountActionError(
        "Akun ini sudah dihapus (soft). Pulihkan lewat seed atau buat akun baru.",
      );
    }

    await prisma.user.update({
      where: { id: target.id },
      data: { isActive: input.isActive },
    });

    // Nonaktif = sesi diputus jwt-recheck dalam 5 menit; aktif kembali =
    // user login normal. Jeda ini jujur dan tercatat di audit.
    await audit({
      actorId: dev.userId,
      outletId: target.outletId,
      action: "ACCOUNT_SET_ACTIVE",
      entity: `user:${target.id}`,
      summary: `Akun ${target.name} ${input.isActive ? "diaktifkan" : "dinonaktifkan"}`,
      meta: { email: target.email, isActive: input.isActive },
    });
    revalidateAccountSurfaces();
    return { ok: true };
  } catch (error) {
    if (error instanceof AccountActionError) {
      return { ok: false, error: error.message };
    }
    console.error("setAccountActive:", error);
    return { ok: false, error: "Gagal mengubah status akun. Coba lagi." };
  }
}

export async function deleteAccountSoft(input: {
  userId: string;
}): Promise<AccountActionResult> {
  try {
    const dev = await requireDeveloper();
    const target = await loadManagedTarget(input.userId);
    if (target.id === dev.userId) {
      throw new AccountActionError(
        "Anda tidak bisa menghapus akun Anda sendiri.",
      );
    }
    if (target.deletedAt) {
      throw new AccountActionError("Akun ini sudah terhapus sebelumnya.");
    }

    // Soft delete: baris TETAP ADA — transaksi, gerakan stok, dan jejak
    // audit yang menunjuk akun ini tetap utuh dan bisa ditelusuri. Login
    // ditolak (authorize cek deletedAt) dan sesi diputus jwt-recheck.
    await prisma.user.update({
      where: { id: target.id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await audit({
      actorId: dev.userId,
      outletId: target.outletId,
      action: "ACCOUNT_DELETE",
      entity: `user:${target.id}`,
      summary: `Akun ${target.name} dihapus (soft) — riwayat tetap tercatat`,
      meta: { email: target.email, role: target.role },
    });
    revalidateAccountSurfaces();
    return { ok: true };
  } catch (error) {
    if (error instanceof AccountActionError) {
      return { ok: false, error: error.message };
    }
    console.error("deleteAccountSoft:", error);
    return { ok: false, error: "Gagal menghapus akun. Coba lagi." };
  }
}
