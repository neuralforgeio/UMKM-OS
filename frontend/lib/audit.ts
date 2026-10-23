// Penulis jejak audit (Task 34, Fase A).
//
// Satu helper untuk SEMUA aksi yang wajib tercatat: transaksi, refund,
// penyajian struk, gerakan stok, produk, pengaturan, akun, dan login.
// Fail-safe: kegagalan menulis audit tidak boleh membatalkan aksi bisnis
// yang sudah sah (kecuali ketika dipanggil DI DALAM prisma.$transaction —
// di sana audit dan mutasi menjadi satu nasib: all-or-nothing).
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";

// Menerima baik client penuh maupun client transaksi ($transaction) —
// keduanya punya auditEvent dengan bentuk yang sama.
type AuditDb = Pick<typeof prisma, "auditEvent">;

// Nilai meta dibatasi tipe primitif agar selalu lolos validasi JSONB
// Prisma tanpa perlu import tipe dari generated client.
export type AuditMeta = Record<string, string | number | boolean | null>;

export type AuditInput = {
  // Siapa yang melakukan aksi. null = sistem / percobaan login tanpa akun.
  actorId: string | null;
  // Outlet tempat aksi terjadi. null = aksi global dev / login.
  outletId?: string | null;
  // Nama aksi stabil, mis. TRANSACTION_CREATE, STOCK_IN, LOGIN_FAILED.
  action: string;
  // Penunjuk entitas, format "jenis:id", mis. "transaction:<uuid>".
  entity?: string | null;
  // Satu kalimat manusiawi untuk dibaca di konsol & CSV.
  summary: string;
  // Detail tambahan (nilai primitif saja).
  meta?: AuditMeta;
  // Isi bila dipanggil di dalam prisma.$transaction(async (tx) => ...).
  db?: AuditDb;
};

export async function audit(input: AuditInput): Promise<void> {
  const db = input.db ?? prisma;
  try {
    await db.auditEvent.create({
      data: {
        actorId: input.actorId,
        outletId: input.outletId ?? null,
        action: input.action,
        entity: input.entity ?? null,
        summary: input.summary,
        // Kolom JSONB nullable menolak `null` JavaScript biasa — Prisma
        // minta sentinel eksplisit agar tidak ambigu: DbNull = kolom
        // benar-benar NULL di database, JsonNull = nilai JSON null yang
        // tersimpan sebagai data. Tanpa meta kita mau yang pertama.
        meta: input.meta ?? Prisma.DbNull,
      },
    });
  } catch (error) {
    // Jangan pernah menjatuhkan aksi bisnis hanya karena audit gagal —
    // kecuali di dalam $transaction, di sana Postgres sendiri yang akan
    // membatalkan commit bila baris audit gagal tertulis.
    console.error(`[audit] gagal menulis ${input.action}:`, error);
  }
}
