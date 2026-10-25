"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { getOutletContext } from "@/lib/outlet-context";

export type SettingsActionState = { ok: boolean; message: string };

const ALLOWED_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
// Batas frontend 3 MB — sama dengan validasi backend-go (maxImageBytes).
const MAX_LOGO_BYTES = 3 * 1024 * 1024;

// Settings are OWNER-only; the guard runs again inside every action so
// a spoofed form post can never touch the branding.
// v2.0.0: seluruh mutasi menulis ke backend-go (audit tercatat di sana);
// tabel Prisma tidak pernah disentuh lagi.
async function ownerActor(): Promise<{
  outletId: number;
  goToken: string;
} | null> {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "OWNER" && session.user.role !== "DEVELOPER") ||
    !session.user.goToken
  ) {
    return null;
  }
  // Outlet konteks: ikatan akun (owner) atau cookie dev_outlet (developer
  // mode maintenance — ditempelkan goFetch secara otomatis).
  const outlet = await getOutletContext();
  if (!outlet) return null;
  return { outletId: outlet.id, goToken: session.user.goToken };
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
  const actor = await ownerActor();
  if (!actor) {
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
  if (phone.length > 32)
    return { ok: false, message: "Nomor telepon maksimal 32 karakter." };

  const res = await goFetch(actor.goToken, `/outlets/${actor.outletId}`, {
    method: "PUT",
    body: JSON.stringify({ name, address, phone }),
  });
  if (!res.ok) {
    return { ok: false, message: res.message };
  }
  revalidateBranding();
  return { ok: true, message: "Profil warung tersimpan." };
}

export async function uploadOutletLogo(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const actor = await ownerActor();
  if (!actor) {
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
    return { ok: false, message: "Ukuran logo maksimal 3 MB." };
  }

  // Teruskan sebagai multipart ke backend-go — batas tipe/ukuran divalidasi
  // ulang di sana dan versi logo naik otomatis (cache-bust ?v= semua URL).
  const payload = new FormData();
  payload.set("file", file);
  const res = await goFetch(actor.goToken, `/outlets/${actor.outletId}/logo`, {
    method: "POST",
    body: payload,
  });
  if (!res.ok) {
    return { ok: false, message: res.message };
  }
  revalidateBranding();
  return { ok: true, message: "Logo tersimpan." };
}

export async function removeOutletLogo(
  _prev: SettingsActionState,
  _formData: FormData,
): Promise<SettingsActionState> {
  const actor = await ownerActor();
  if (!actor) {
    return {
      ok: false,
      message: "Hanya pemilik yang boleh mengubah pengaturan.",
    };
  }
  const res = await goFetch(actor.goToken, `/outlets/${actor.outletId}/logo`, {
    method: "DELETE",
  });
  if (!res.ok) {
    return { ok: false, message: res.message };
  }
  revalidateBranding();
  return { ok: true, message: "Logo dihapus." };
}
