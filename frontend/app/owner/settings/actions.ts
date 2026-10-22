"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type SettingsActionState = { ok: boolean; message: string };

const ALLOWED_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_LOGO_BYTES = 900 * 1024;

// Settings are OWNER-only; the guard runs again inside every action so
// a spoofed form post can never touch the branding.
async function ownerOutletId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") return null;
  const outlet = session.user.outletId
    ? await prisma.outlet.findUnique({
        where: { id: session.user.outletId },
        select: { id: true },
      })
    : await prisma.outlet.findFirst({ select: { id: true } });
  return outlet?.id ?? null;
}

function revalidateBranding() {
  // The name/address/phone/logo appear on receipts, the POS header,
  // and the dashboard — refresh all surfaces that render them.
  revalidatePath("/owner/settings");
  revalidatePath("/cashier");
  revalidatePath("/owner");
}

export async function updateOutletProfile(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const outletId = await ownerOutletId();
  if (!outletId) {
    return {
      ok: false,
      message: "Hanya pemilik yang boleh mengubah pengaturan.",
    };
  }
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (name.length < 2)
    return { ok: false, message: "Nama warung minimal 2 karakter." };
  if (name.length > 60)
    return { ok: false, message: "Nama warung maksimal 60 karakter." };
  if (address.length > 120)
    return { ok: false, message: "Alamat maksimal 120 karakter." };
  if (phone.length > 30)
    return { ok: false, message: "Nomor telepon maksimal 30 karakter." };
  await prisma.outlet.update({
    where: { id: outletId },
    data: { name, address: address || null, phone: phone || null },
  });
  revalidateBranding();
  return { ok: true, message: "Profil warung tersimpan." };
}

export async function uploadOutletLogo(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const outletId = await ownerOutletId();
  if (!outletId) {
    return {
      ok: false,
      message: "Hanya pemilik yang boleh mengubah pengaturan.",
    };
  }
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Pilih file gambar terlebih dahulu." };
  }
  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    return { ok: false, message: "Format harus PNG, JPEG, atau WebP." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { ok: false, message: "Ukuran logo maksimal 900 KB." };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  await prisma.outlet.update({
    where: { id: outletId },
    data: {
      logoData: bytes,
      logoMimeType: file.type,
      // New version -> new ?v= in every URL -> zero stale caches.
      logoVersion: { increment: 1 },
    },
  });
  revalidateBranding();
  return { ok: true, message: "Logo tersimpan." };
}

export async function removeOutletLogo(
  _prev: SettingsActionState,
  _formData: FormData,
): Promise<SettingsActionState> {
  const outletId = await ownerOutletId();
  if (!outletId) {
    return {
      ok: false,
      message: "Hanya pemilik yang boleh mengubah pengaturan.",
    };
  }
  await prisma.outlet.update({
    where: { id: outletId },
    data: {
      logoData: null,
      logoMimeType: null,
      logoVersion: { increment: 1 },
    },
  });
  revalidateBranding();
  return { ok: true, message: "Logo dihapus." };
}
