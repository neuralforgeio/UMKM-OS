// Pembangun filter query jejak audit (Task 34 Fase B, diperbarui Task 35).
//
// Satu sumber kebenaran untuk DUA konsumen: halaman /dev/logs (query
// penuh developer) dan route /api/logs/export (Excel owner + developer).
// Menyamakan perilaku di dua tempat = satu fungsi, bukan salin-tempel —
// filter yang berbeda antara layar dan file unduhan adalah bug klasik
// laporan keuangan/audit.
// Task 35: filter "level" (SUKSES / PERINGATAN / GAGAL) memakai
// definisi tingkat dari lib/audit-labels supaya UI, filter, dan file
// tidak pernah berbeda pendapat.
import { Prisma } from "@/lib/generated/prisma/client";
import { warnActions } from "@/lib/audit-labels";

// Batas aman satu export: menjaga respons tetap kecil dan memaksa
// rentang tanggal dipakai untuk penelusuran besar (bukan "unduh semua
// sejak awal zaman" dari tombol).
export const LOG_EXPORT_ROW_CAP = 10_000;

// Rentang tanggal filter ditafsirkan menurut WIB (UTC+7): pengguna
// memilih "23/10/2026" dan maksudnya adalah hari itu di warung, bukan
// hari itu di jam UTC. Offset eksplisit, bukan offset zona server.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function wibStartOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+07:00`);
}

export function wibEndOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999+07:00`);
}

export type LogFilterInput = {
  q?: string;
  action?: string;
  outlet?: string;
  actor?: string;
  from?: string;
  to?: string;
  // "SUKSES" | "PERINGATAN" | "GAGAL" — selain itu diabaikan.
  level?: string;
};

// Nilai kosong ("") atau "ALL" = filter tidak dipakai — datang dari
// <option value="">Semua</option> pada form GET. Type predicate
// ("value is string") supaya TypeScript ikut menyempitkan tipe.
const isSet = (value: string | undefined): value is string =>
  typeof value === "string" && value !== "" && value !== "ALL";

export function buildLogWhere(
  input: LogFilterInput,
): Prisma.AuditEventWhereInput {
  const filters: Prisma.AuditEventWhereInput[] = [];

  const q = input.q?.trim();
  if (q) {
    filters.push({
      OR: [
        { summary: { contains: q, mode: "insensitive" } },
        { entity: { contains: q, mode: "insensitive" } },
        { actor: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (isSet(input.action)) filters.push({ action: input.action });
  if (isSet(input.outlet)) filters.push({ outletId: input.outlet });
  if (isSet(input.actor)) filters.push({ actorId: input.actor });
  if (input.from && DATE_RE.test(input.from)) {
    filters.push({ createdAt: { gte: wibStartOfDay(input.from) } });
  }
  if (input.to && DATE_RE.test(input.to)) {
    filters.push({ createdAt: { lte: wibEndOfDay(input.to) } });
  }

  // Filter tingkat: turunkan jadi predikat kolom action — tidak ada
  // kolom baru di database, definisinya murni dari nama aksi
  // (berakhiran _FAILED = GAGAL; daftar warn = PERINGATAN).
  if (input.level === "GAGAL") {
    filters.push({ action: { endsWith: "_FAILED" } });
  } else if (input.level === "PERINGATAN") {
    filters.push({ action: { in: warnActions() } });
  } else if (input.level === "SUKSES") {
    filters.push({
      action: {
        not: { endsWith: "_FAILED" },
        notIn: warnActions(),
      },
    });
  }

  return filters.length > 0 ? { AND: filters } : {};
}

// Rangkai ulang filter menjadi query string untuk tautan (tombol export,
// pagination) — nilai kosong dibuang supaya URL tetap pendek dan enak dibaca.
export function logQueryString(input: LogFilterInput): string {
  const qs = new URLSearchParams();
  if (input.q?.trim()) qs.set("q", input.q.trim());
  if (isSet(input.action)) qs.set("action", input.action);
  if (isSet(input.outlet)) qs.set("outlet", input.outlet);
  if (isSet(input.actor)) qs.set("actor", input.actor);
  if (input.from && DATE_RE.test(input.from)) qs.set("from", input.from);
  if (input.to && DATE_RE.test(input.to)) qs.set("to", input.to);
  if (
    input.level === "SUKSES" ||
    input.level === "PERINGATAN" ||
    input.level === "GAGAL"
  ) {
    qs.set("level", input.level);
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}
