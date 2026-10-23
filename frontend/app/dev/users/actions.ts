"use server";
// Kelola akun + outlet oleh DEVELOPER (Task 34 Fase B, diperbarui Task 35).
//
// Rantai penciptaan akun ditegakkan DI SINI (server), bukan hanya di UI:
//   seed (.env) -> DEVELOPER -> OWNER (per outlet) -> KASIR (outlet sama).
// Konsol developer boleh membuat/mengubah OWNER & KASIR saja — akun
// DEVELOPER tidak pernah bisa dibuat atau diubah dari konsol, sehingga
// satu-satunya jalur ke peran tertinggi tetap environment variable yang
// dikendalikan pemilik deployment.
//
// Task 35 menambah: pembuatan OUTLET dari konsol (untuk dipakai form
// akun), kebijakan password (8 karakter + huruf besar + simbol), dan
// audit kegagalan (ACCOUNT_*_FAILED) supaya jejak log menjawab "ada
// error atau tidak", bukan hanya aksi yang berhasil.
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import {
  failedPasswordRules,
  isPasswordValid,
} from "@/lib/password-policy";

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

export type CreateOutletResult =
  | { ok: true; outletId: string; outletName: string }
  | { ok: false; error: string };

// Pintu masuk SEMUA aksi di file ini: hanya DEVELOPER. Tanpa ini, owner
// atau kasir yang memalsukan request masih bisa mengubah akun lintas
// outlet — guard UI hanya menyembunyikan tombol, bukan menutup pintu.
async function devSession(): Promise<{ id: string; name: string } | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "DEVELOPER") {
    return null;
  }
  return { id: session.user.id, name: session.user.name ?? "Developer" };
}

const DEV_ONLY_ERROR =
  "Hanya developer yang boleh mengelola akun lewat konsol ini.";

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
      outlet: { select: { name: true } },
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

// Kebijakan password (Task 35): 8 karakter + huruf besar + simbol.
// bcrypt memotong input di 72 byte — batas atas tetap dijaga.
function cleanPassword(raw: unknown): string {
  const password = String(raw ?? "");
  if (password.length > 72) {
    throw new AccountActionError("Password maksimal 72 karakter.");
  }
  if (!isPasswordValid(password)) {
    const missing = failedPasswordRules(password).join(", ");
    throw new AccountActionError(
      `Password belum memenuhi syarat: ${missing}.`,
    );
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

// ---- Buat outlet (Task 35) ---------------------------------------------
// Dipakai form akun ("+ Outlet baru…", pola yang sama dengan kategori di
// form produk) dan tombol "Outlet Baru" di konsol developer.

export async function createOutlet(input: {
  name: string;
  address?: string;
}): Promise<CreateOutletResult> {
  const dev = await devSession();
  if (!dev) return { ok: false, error: DEV_ONLY_ERROR };

  try {
    const name = String(input.name ?? "").trim();
    if (name.length < 2) {
      throw new AccountActionError("Nama outlet minimal 2 karakter.");
    }
    if (name.length > 60) {
      throw new AccountActionError("Nama outlet maksimal 60 karakter.");
    }
    const address = String(input.address ?? "").trim();
    if (address.length > 120) {
      throw new AccountActionError("Alamat maksimal 120 karakter.");
    }

    // Nama unik case-insensitive: dua "Warung Bu Ira" di daftar outlet
    // adalah resep kebingungan pemilihan outlet di form akun.
    const clash = await prisma.outlet.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (clash) {
      throw new AccountActionError(
        `Outlet "${clash.name}" sudah ada — nama tidak boleh kembar.`,
      );
    }

    const outlet = await prisma.outlet.create({
      data: { name, address: address || null },
      select: { id: true, name: true },
    });

    await audit({
      actorId: dev.id,
      outletId: outlet.id,
      action: "OUTLET_CREATE",
      entity: `outlet:${outlet.id}`,
      summary: `${dev.name} membuat outlet baru "${outlet.name}"${address ? ` — ${address}` : ""}`,
      meta: { name, address: address || null },
    });
    revalidatePath("/dev");
    revalidatePath("/dev/users");
    revalidatePath("/dev/outlets/" + outlet.id);
    return { ok: true, outletId: outlet.id, outletName: outlet.name };
  } catch (error) {
    if (error instanceof AccountActionError) {
      await audit({
        actorId: dev.id,
        action: "OUTLET_CREATE_FAILED",
        summary: `Gagal membuat outlet: ${error.message}`,
        meta: {
          reason: error.message,
          attemptedName: String(input.name ?? ""),
        },
      });
      return { ok: false, error: error.message };
    }
    console.error("createOutlet:", error);
    return { ok: false, error: "Gagal membuat outlet. Coba lagi." };
  }
}

// ---- Aksi akun ----------------------------------------------------------

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
      actorId: dev.id,
      outletId: outlet?.id ?? null,
      action: "ACCOUNT_CREATE",
      entity: `user:${user.id}`,
      summary: `${dev.name} membuat akun ${name} (${input.role})${outlet ? ` di outlet ${outlet.name}` : " — akses semua outlet"}`,
      meta: { email, role: input.role, outlet: outlet?.name ?? null },
    });
    revalidateAccountSurfaces();
    return { ok: true };
  } catch (error) {
    if (error instanceof AccountActionError) {
      // Permintaan pemilik: log harus tahu error juga. Percobaan gagal
      // dicatat dengan alasan supaya pola (mis. email nyasar terus)
      // kelihatan di /dev/logs dan di export Excel.
      await audit({
        actorId: dev.id,
        action: "ACCOUNT_CREATE_FAILED",
        summary: `Gagal membuat akun: ${error.message}`,
        meta: {
          reason: error.message,
          attemptedEmail: String(input.email ?? ""),
          attemptedName: String(input.name ?? ""),
        },
      });
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
  const dev = await devSession();
  if (!dev) return { ok: false, error: DEV_ONLY_ERROR };

  try {
    const target = await loadManagedTarget(input.userId);
    if (target.id === dev.id) {
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

    // Ringkasan diff — dibaca manusia: langsung terlihat APA yang
    // berubah, bukan sekadar "akun diperbarui".
    const changes: string[] = [];
    if (name !== target.name) changes.push(`nama "${target.name}" → "${name}"`);
    if (email !== target.email) changes.push("email diganti");
    if (input.role !== target.role) {
      changes.push(`peran ${target.role} → ${input.role}`);
    }
    if ((outlet?.id ?? null) !== (target.outletId ?? null)) {
      changes.push(`outlet → ${outlet?.name ?? "(semua outlet)"}`);
    }
    if (input.isActive !== target.isActive) {
      changes.push(input.isActive ? "diaktifkan" : "dinonaktifkan");
    }

    await audit({
      actorId: dev.id,
      outletId: outlet?.id ?? null,
      action: "ACCOUNT_UPDATE",
      entity: `user:${target.id}`,
      summary: `${dev.name} mengubah akun ${name} (${target.role}): ${changes.length > 0 ? changes.join(", ") : "tanpa perubahan"}`,
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
      await audit({
        actorId: dev.id,
        action: "ACCOUNT_UPDATE_FAILED",
        summary: `Gagal mengubah akun: ${error.message}`,
        meta: {
          reason: error.message,
          targetId: input.userId,
          attemptedName: String(input.name ?? ""),
        },
      });
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
  const dev = await devSession();
  if (!dev) return { ok: false, error: DEV_ONLY_ERROR };

  try {
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
      actorId: dev.id,
      outletId: target.outletId,
      action: "ACCOUNT_PASSWORD_RESET",
      entity: `user:${target.id}`,
      summary: `${dev.name} mereset password akun ${target.name} (${target.role})${target.outlet ? `, outlet ${target.outlet.name}` : ""} — berlaku untuk login berikutnya`,
      meta: { email: target.email },
    });
    revalidateAccountSurfaces();
    return { ok: true };
  } catch (error) {
    if (error instanceof AccountActionError) {
      await audit({
        actorId: dev.id,
        action: "ACCOUNT_PASSWORD_RESET_FAILED",
        summary: `Gagal mereset password akun: ${error.message}`,
        meta: { reason: error.message, targetId: input.userId },
      });
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
  const dev = await devSession();
  if (!dev) return { ok: false, error: DEV_ONLY_ERROR };

  try {
    const target = await loadManagedTarget(input.userId);
    if (target.id === dev.id) {
      throw new AccountActionError(
        "Anda tidak bisa menonaktifkan akun Anda sendiri.",
      );
    }
    if (target.deletedAt && input.isActive) {
      throw new AccountActionError(
        "Akun ini sudah dihapus permanen. Buat akun baru bila diperlukan.",
      );
    }

    await prisma.user.update({
      where: { id: target.id },
      data: { isActive: input.isActive },
    });

    // Nonaktif = sesi diputus jwt-recheck dalam 5 menit; aktif kembali =
    // user login normal. Jeda ini jujur dan tercatat di audit.
    await audit({
      actorId: dev.id,
      outletId: target.outletId,
      action: "ACCOUNT_SET_ACTIVE",
      entity: `user:${target.id}`,
      summary: `${dev.name} ${input.isActive ? "MENGAKTIFKAN" : "MENONAKTIFKAN (blokir login)"} akun ${target.name} (${target.role}${target.outlet ? `, outlet ${target.outlet.name}` : ""})${input.isActive ? "" : " — sesi aktif diputus otomatis maks 5 menit"}`,
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
  const dev = await devSession();
  if (!dev) return { ok: false, error: DEV_ONLY_ERROR };

  try {
    const target = await loadManagedTarget(input.userId);
    if (target.id === dev.id) {
      throw new AccountActionError(
        "Anda tidak bisa menghapus akun Anda sendiri.",
      );
    }
    if (target.deletedAt) {
      throw new AccountActionError("Akun ini sudah terhapus sebelumnya.");
    }

    // Soft delete permanen dari sudut pandang daftar (Task 35):
    //   - baris TETAP ADA supaya FK transaksi/stok/audit tetap valid;
    //   - EMAIL DIGANTI menjadi alamat sampah supaya email aslinya bisa
    //     dipakai akun baru (kolom email bersifat unik di database);
    //   - daftar akun tidak pernah menampilkan baris deletedAt != null,
    //     jadi sekali dihapus = hilang selamanya dari UI konsol.
    await prisma.user.update({
      where: { id: target.id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        email: `deleted+${target.id.slice(0, 8)}+${Date.now()}@umkm-os.invalid`,
      },
    });

    await audit({
      actorId: dev.id,
      outletId: target.outletId,
      action: "ACCOUNT_DELETE",
      entity: `user:${target.id}`,
      summary: `${dev.name} MENGHAPUS akun ${target.name} (${target.role}${target.outlet ? `, outlet ${target.outlet.name}` : ""}) — hilang dari daftar selamanya, email ${target.email} dibebaskan, jejak log & transaksi tetap tersimpan`,
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
