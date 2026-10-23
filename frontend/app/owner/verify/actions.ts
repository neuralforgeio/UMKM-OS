"use server";
// Aksi verifikasi struk v3 untuk staf yang LOGIN (owner / kasir).
// Dine-in: inti = MARK SERVED — status penyajian dicatat satu arah,
// berjejak (siapa + kapan + perangkat) di HandoverEvent (append-only).
// Alat v2 (tanda tangan pembeli / klaim kurir) tetap tersedia sebagai
// bukti kuat untuk skenario online / takeaway.
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidSignatureData, startOfTodayWIB } from "@/lib/handover";
import { audit } from "@/lib/audit";

export type HandoverActionResult = { ok: true } | { ok: false; error: string };

// Satu baris Antrean Penyajian — transaksi hari ini yang belum
// ditandai SERVED. Serial murni supaya bisa melewati server/client
// boundary tanpa transformasi.
export type ServeQueueRow = {
  id: string;
  code: string;
  createdAtIso: string;
  itemCount: number;
  totalRupiah: number;
  paymentMethod: string;
};

async function requireStaff() {
  const session = await auth();
  const u = session?.user;
  if (!u || (u.role !== "OWNER" && u.role !== "KASIR" && u.role !== "DEVELOPER")) return null;
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
 * ANTREAN PENYAJIAN (anti-lupa): transaksi HARI INI (WIB) outlet staf
 * yang masih COMPLETED dan belum punya aktivitas serah terima apa pun.
 * Dipanggil dari server render halaman kasir/konsol DAN di-poll ringan
 * oleh komponen klien tiap 30 detik.
 */
export async function getServeQueue(): Promise<ServeQueueRow[]> {
  try {
    const staff = await requireStaff();
    if (!staff) return [];
    const outletId =
      staff.outletId ??
      (
        await prisma.outlet.findFirst({
          select: { id: true },
        })
      )?.id;
    if (!outletId) return [];

    const rows = await prisma.transaction.findMany({
      where: {
        outletId,
        status: "COMPLETED",
        createdAt: { gte: startOfTodayWIB() },
        handoverStatus: null,
      },
      orderBy: { createdAt: "asc" },
      take: 30,
      select: {
        id: true,
        code: true,
        createdAt: true,
        total: true,
        paymentMethod: true,
        items: { select: { quantity: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      createdAtIso: r.createdAt.toISOString(),
      itemCount: r.items.reduce((sum, i) => sum + i.quantity, 0),
      totalRupiah: Math.round(Number(r.total)),
      paymentMethod: r.paymentMethod,
    }));
  } catch (e) {
    console.error("getServeQueue:", e);
    return [];
  }
}

/**
 * MARK SERVED (pintu utama v3 dine-in): pesanan diserahkan/disajikan.
 * SATU ARAH — tidak ada tombol batal; jejak HandoverEvent STAFF_SERVE
 * berisi siapa, kapan, dan perangkat apa. Hanya berlaku dari status
 * kosong (belum ada aktivitas serah terima).
 */
export async function markServed(input: {
  transactionId: string;
  note?: string;
}): Promise<HandoverActionResult> {
  try {
    const staff = await requireStaff();
    if (!staff)
      return { ok: false, error: "Harus login sebagai owner atau kasir." };
    if (typeof input.transactionId !== "string" || !input.transactionId) {
      return { ok: false, error: "ID transaksi tidak valid." };
    }

    const tx = await prisma.transaction.findUnique({
      where: { id: input.transactionId },
      select: {
        id: true,
        code: true,
        outletId: true,
        claimCode: true,
        status: true,
        handoverStatus: true,
      },
    });
    if (!tx) return { ok: false, error: "Transaksi tidak ditemukan." };
    if (staff.outletId && tx.outletId !== staff.outletId) {
      return { ok: false, error: "Transaksi ini bukan milik outlet Anda." };
    }
    if (tx.status === "REFUNDED") {
      return { ok: false, error: "Transaksi ini sudah direfund." };
    }
    if (tx.handoverStatus === "SERVED") {
      return { ok: false, error: "Pesanan ini sudah tercatat disajikan." };
    }
    if (tx.handoverStatus === "CONFIRMED") {
      return {
        ok: false,
        error: "Sudah terverifikasi diterima pembeli — tidak perlu ditandai.",
      };
    }
    if (tx.handoverStatus === "COURIER_CLAIMED") {
      return {
        ok: false,
        error: "Status: diklaim kurir. Buka detail transaksi untuk mengelola.",
      };
    }
    if (tx.handoverStatus === "DISPUTED") {
      return {
        ok: false,
        error: "Ada pembantahan pembeli — selesaikan dulu sengketanya.",
      };
    }

    const note = (input.note ?? "").trim().slice(0, 200) || null;
    const meta = await requestMeta();

    await prisma.$transaction([
      prisma.handoverEvent.create({
        data: {
          transactionId: tx.id,
          kind: "STAFF_SERVE",
          method: "IN_APP",
          actorRole: staff.role,
          actorId: staff.id,
          note,
          userAgent: meta.userAgent,
          ip: meta.ip,
        },
      }),
      prisma.transaction.update({
        where: { id: tx.id },
        data: {
          handoverStatus: "SERVED",
          handoverConfirmedAt: new Date(),
          handoverConfirmedBy: staff.id,
        },
      }),
    ]);

    // Jejak ganda: HandoverEvent = bukti detail per struk, AuditEvent =
    // aliran aktivitas lintas aksi untuk konsol developer & CSV owner.
    await audit({
      actorId: staff.id,
      outletId: tx.outletId,
      action: "HANDOVER_SERVE",
      entity: `transaction:${tx.id}`,
      summary: `Struk ${tx.code} ditandai sudah disajikan`,
      meta: { code: tx.code },
    });

    revalidateAll(tx.id, tx.claimCode);
    revalidatePath(`/verify/${tx.code}`);
    revalidatePath("/cashier");
    revalidatePath("/owner");
    revalidatePath("/owner/transactions");
    return { ok: true };
  } catch (e) {
    console.error("markServed:", e);
    return { ok: false, error: "Gagal menandai penyajian. Coba lagi." };
  }
}

/**
 * KONFIRMASI KUAT (opsi v2/v3): pembeli tanda tangan LANGSUNG di layar
 * staf yang sedang login — misal untuk takeaway/online, atau menambah
 * bukti kuat setelah pesanan disajikan.
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
        // code dipakai ringkasan audit di bawah — Prisma select menentukan
        // bentuk hasil query, jadi kolom harus ikut di-select agar tx.code
        // ada (markServed sudah benar; dua fungsi ini sebelumnya lupa).
        code: true,
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

    await audit({
      actorId: staff.id,
      outletId: tx.outletId,
      action: "HANDOVER_CONFIRM",
      entity: `transaction:${tx.id}`,
      summary: `Struk ${tx.code} dikonfirmasi diterima pembeli${buyerName ? ` (${buyerName})` : ""} — tanda tangan digital`,
      meta: { code: tx.code },
    });

    revalidateAll(tx.id, tx.claimCode);
    return { ok: true };
  } catch (e) {
    console.error("confirmHandoverInApp:", e);
    return { ok: false, error: "Gagal menyimpan konfirmasi. Coba lagi." };
  }
}

/**
 * KONFIRMASI LEMAH (fallback): staf menandai "sudah diantar" TANPA
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
        // code dipakai ringkasan audit di bawah — Prisma select menentukan
        // bentuk hasil query, jadi kolom harus ikut di-select agar tx.code
        // ada (markServed sudah benar; dua fungsi ini sebelumnya lupa).
        code: true,
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

    await audit({
      actorId: staff.id,
      outletId: tx.outletId,
      action: "HANDOVER_CLAIM",
      entity: `transaction:${tx.id}`,
      summary: `Struk ${tx.code} diklaim sudah diantar (tanpa tanda tangan pembeli)`,
      meta: { code: tx.code },
    });

    revalidateAll(tx.id, tx.claimCode);
    return { ok: true };
  } catch (e) {
    console.error("claimDelivered:", e);
    return { ok: false, error: "Gagal menyimpan klaim. Coba lagi." };
  }
}
