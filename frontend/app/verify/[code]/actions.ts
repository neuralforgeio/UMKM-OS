"use server";
// Aksi dari HP PEMBELI (tanpa login) — kode verifikasi adalah kuncinya.
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isValidSignatureData } from "@/lib/handover";

export type PublicActionResult = { ok: true } | { ok: false; error: string };

function normalizeCode(raw: string) {
  return raw.trim().toUpperCase();
}

async function requestMeta() {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    undefined;
  return { userAgent: h.get("user-agent") ?? undefined, ip };
}

function revalidateAll(txId: string, code: string) {
  revalidatePath(`/verify/${code}`);
  revalidatePath("/owner/verify");
  revalidatePath(`/owner/verify/${txId}`);
}

/** Konfirmasi KUAT dari HP pembeli: tanda tangan + nama + waktu + perangkat. */
export async function confirmByCode(input: {
  code: string;
  buyerName?: string;
  signatureData: string;
}): Promise<PublicActionResult> {
  try {
    if (!isValidSignatureData(input.signatureData)) {
      return { ok: false, error: "Tanda tangan belum digambar." };
    }
    const code = normalizeCode(input.code);
    const tx = await prisma.transaction.findUnique({
      where: { claimCode: code },
      select: { id: true, handoverStatus: true },
    });
    if (!tx) return { ok: false, error: "Kode tidak dikenali." };
    if (tx.handoverStatus === "CONFIRMED") {
      return { ok: false, error: "Pesanan ini sudah terverifikasi sebelumnya." };
    }

    const buyerName = (input.buyerName ?? "").trim().slice(0, 40) || null;
    const meta = await requestMeta();

    await prisma.$transaction([
      prisma.handoverEvent.create({
        data: {
          transactionId: tx.id,
          kind: "BUYER_CONFIRM",
          method: "PUBLIC",
          actorRole: "BUYER",
          buyerName,
          signatureData: input.signatureData,
          userAgent: meta.userAgent,
          ip: meta.ip,
        },
      }),
      prisma.transaction.update({
        where: { id: tx.id },
        data: {
          handoverStatus: "CONFIRMED",
          handoverConfirmedAt: new Date(),
          handoverConfirmedBy: null, // konfirmasi publik — bukan oleh staf
        },
      }),
    ]);

    revalidateAll(tx.id, code);
    return { ok: true };
  } catch (e) {
    console.error("confirmByCode:", e);
    return { ok: false, error: "Gagal menyimpan konfirmasi. Coba lagi." };
  }
}

/** Pembeli membantah: "saya tidak pernah terima". Tercatat permanen. */
export async function disputeByCode(input: {
  code: string;
  reason?: string;
}): Promise<PublicActionResult> {
  try {
    const code = normalizeCode(input.code);
    const tx = await prisma.transaction.findUnique({
      where: { claimCode: code },
      select: { id: true, handoverStatus: true },
    });
    if (!tx) return { ok: false, error: "Kode tidak dikenali." };
    if (tx.handoverStatus === "DISPUTED") {
      return { ok: false, error: "Pembantahan ini sudah tercatat." };
    }
    if (tx.handoverStatus === "CONFIRMED") {
      return {
        ok: false,
        error: "Pesanan ini sudah terverifikasi diterima. Hubungi toko langsung.",
      };
    }

    const meta = await requestMeta();
    await prisma.$transaction([
      prisma.handoverEvent.create({
        data: {
          transactionId: tx.id,
          kind: "BUYER_DISPUTE",
          method: "PUBLIC",
          actorRole: "BUYER",
          note: (input.reason ?? "").trim().slice(0, 200) || null,
          userAgent: meta.userAgent,
          ip: meta.ip,
        },
      }),
      prisma.transaction.update({
        where: { id: tx.id },
        data: { handoverStatus: "DISPUTED" },
      }),
    ]);

    revalidateAll(tx.id, code);
    return { ok: true };
  } catch (e) {
    console.error("disputeByCode:", e);
    return { ok: false, error: "Gagal mencatat pembantahan. Coba lagi." };
  }
}
