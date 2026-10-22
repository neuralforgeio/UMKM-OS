"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// Public handover confirmation: the claim code is the only secret, and
// it lives on the customer's receipt. Five wrong codes lock the struk
// so nobody can brute-force the 6-digit space from the public form.
const MAX_CLAIM_ATTEMPTS = 5;

export type ConfirmClaimResult = { ok: true } | { ok: false; error: string };

export async function confirmClaim(input: {
  code: string;
  claimCode: string;
}): Promise<ConfirmClaimResult> {
  const code = (input.code ?? "").trim().toUpperCase();
  const claimCode = (input.claimCode ?? "").replace(/\D/g, "");
  if (!code) {
    return { ok: false, error: "Kode struk tidak valid." };
  }
  if (claimCode.length !== 6) {
    return { ok: false, error: "Kode klaim harus 6 digit angka." };
  }
  try {
    const existing = await prisma.transaction.findUnique({
      where: { code },
      select: {
        id: true,
        claimCode: true,
        claimedAt: true,
        claimAttempts: true,
      },
    });
    if (!existing) {
      return { ok: false, error: "Struk tidak ditemukan." };
    }
    if (!existing.claimCode) {
      return {
        ok: false,
        error:
          "Struk lama tanpa kode klaim — minta pemilik warung mengonfirmasi manual.",
      };
    }
    if (existing.claimedAt) {
      return { ok: false, error: "Struk ini sudah dikonfirmasi diterima." };
    }
    if (existing.claimAttempts >= MAX_CLAIM_ATTEMPTS) {
      return {
        ok: false,
        error:
          "Percobaan kode salah terlalu banyak — struk terkunci. Hubungi warung.",
      };
    }
    if (existing.claimCode !== claimCode) {
      const attempts = existing.claimAttempts + 1;
      await prisma.transaction.update({
        where: { id: existing.id },
        data: { claimAttempts: attempts },
      });
      const left = MAX_CLAIM_ATTEMPTS - attempts;
      return {
        ok: false,
        error:
          left > 0
            ? `Kode klaim salah. Sisa ${left} percobaan.`
            : "Kode klaim salah. Struk terkunci — hubungi warung.",
      };
    }
    await prisma.transaction.update({
      where: { id: existing.id },
      data: {
        claimedAt: new Date(),
        claimNote: "Dikonfirmasi oleh penerima",
        claimAttempts: 0,
      },
    });
    revalidatePath(`/verify/${code}`);
    revalidatePath("/owner/verify");
    revalidatePath("/owner");
    return { ok: true };
  } catch (error) {
    console.error("confirmClaim failed:", error);
    return { ok: false, error: "Gagal memproses konfirmasi. Coba lagi." };
  }
}
