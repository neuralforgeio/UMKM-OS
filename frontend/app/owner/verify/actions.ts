"use server";
// Aksi verifikasi serah terima untuk staf yang LOGIN (owner / kasir
// kurir). Semua aksi tercatat permanen di HandoverEvent (append-only).
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidSignatureData } from "@/lib/handover";

export type HandoverActionResult = { ok: true } | { ok: false; error: string };

async function requireStaff() {
  const session = await auth();
  const u = session?.user;
  if (!u || (u.role !== "OWNER" && u.role !== "KASIR")) return null;
  return u;
}

async function requestMeta() {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    undefined;
  return { userAgent: h.get("user-agent") ?? undefined, ip };
}

function revalidateAll(txId: string, claimCode: string | null) {
  revalidatePath("/owner/verify");
  revalidatePath(`/owner/verify/${txId}`);
  if (claimCode) revalidatePath(`/verify/${claimCode}`);
}

/**
 * KONFIRMASI KUAT (pintu utama): pembeli tanda tangan LANGSUNG di layar
 * kurir yang sedang login. Kurir tidak perlu mengingat kode apa pun —
 * cukup pilih transaksi dari daftar hari ini.
 */
export async function confirmHandoverInApp(input: {
  transactionId: string;
  buyerName?: string;
  signatureData: string;
}): Promise<HandoverActionResult> {
  try {
    const staff = await requireStaff();
    if (!staff)
      return { ok: false, error: "Harus login sebagai owner atau kasir." };

    if (!isValidSignatureData(input.signatureData)) {
      return { ok: false, error: "Tanda tangan pembeli belum digambar." };
    }

    const tx = await prisma.transaction.findUnique({
      where: { id: input.transactionId },
      select: {
        id: true,
        outletId: true,
        claimCode: true,
        handoverStatus: true,
      },
    });
    if (!tx) return { ok: false, error: "Transaksi tidak ditemukan." };
    if (staff.outletId && tx.outletId !== staff.outletId) {
      return { ok: false, error: "Transaksi ini bukan milik outlet Anda." };
    }
    if (tx.handoverStatus === "CONFIRMED") {
      return {
        ok: false,
        error: "Transaksi ini sudah terverifikasi sebelumnya.",
      };
    }

    const buyerName = (input.buyerName ?? "").trim().slice(0, 40) || null;
    const meta = await requestMeta();

    await prisma.$transaction([
      prisma.handoverEvent.create({
        data: {
          transactionId: tx.id,
          kind: "BUYER_CONFIRM",
          method: "IN_APP",
          actorRole: staff.role,
          actorId: staff.id,
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
          handoverConfirmedBy: staff.id,
        },
      }),
    ]);

    revalidateAll(tx.id, tx.claimCode);
    return { ok: true };
  } catch (e) {
    console.error("confirmHandoverInApp:", e);
    return { ok: false, error: "Gagal menyimpan konfirmasi. Coba lagi." };
  }
}

/**
 * KONFIRMASI LEMAH (fallback): kurir menandai "sudah diantar" TANPA
 * tanda tangan pembeli. Tercatat siapa + kapan + perangkat. Kalau
 * pembeli kemudian membantah dari HP-nya, status jadi DISPUTED.
 */
export async function claimDelivered(input: {
  transactionId: string;
  note?: string;
}): Promise<HandoverActionResult> {
  try {
    const staff = await requireStaff();
    if (!staff)
      return { ok: false, error: "Harus login sebagai owner atau kasir." };

    const tx = await prisma.transaction.findUnique({
      where: { id: input.transactionId },
      select: {
        id: true,
        outletId: true,
        claimCode: true,
        handoverStatus: true,
      },
    });
    if (!tx) return { ok: false, error: "Transaksi tidak ditemukan." };
    if (staff.outletId && tx.outletId !== staff.outletId) {
      return { ok: false, error: "Transaksi ini bukan milik outlet Anda." };
    }
    if (tx.handoverStatus === "CONFIRMED") {
      return {
        ok: false,
        error: "Sudah terverifikasi pembeli — tidak perlu klaim kurir.",
      };
    }
    if (tx.handoverStatus === "COURIER_CLAIMED") {
      return { ok: false, error: "Sudah pernah diklaim kurir sebelumnya." };
    }
    if (tx.handoverStatus === "DISPUTED") {
      return {
        ok: false,
        error:
          "Pembeli sedang membantah pesanan ini — selesaikan dulu dengan pembeli.",
      };
    }

    const meta = await requestMeta();
    await prisma.$transaction([
      prisma.handoverEvent.create({
        data: {
          transactionId: tx.id,
          kind: "COURIER_CLAIM",
          method: "IN_APP",
          actorRole: staff.role,
          actorId: staff.id,
          note: (input.note ?? "").trim().slice(0, 200) || null,
          userAgent: meta.userAgent,
          ip: meta.ip,
        },
      }),
      prisma.transaction.update({
        where: { id: tx.id },
        data: { handoverStatus: "COURIER_CLAIMED" },
      }),
    ]);

    revalidateAll(tx.id, tx.claimCode);
    return { ok: true };
  } catch (e) {
    console.error("claimDelivered:", e);
    return { ok: false, error: "Gagal menyimpan klaim. Coba lagi." };
  }
}
