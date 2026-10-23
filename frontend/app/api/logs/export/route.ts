import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import {
  LOG_EXPORT_ROW_CAP,
  buildLogWhere,
  type LogFilterInput,
} from "@/lib/audit-query";

// Export CSV jejak audit (Task 34, Fase B).
//
// Dua pintu dengan dua hak akses BERBEDA — dipaksa di server, bukan di UI:
//   DEVELOPER : semua outlet + semua filter (q, action, outlet, actor,
//               rentang tanggal from/to).
//   OWNER     : hanya outlet sendiri — parameter outlet diabaikan total
//               (Fase C menaruh tombol unduh di /owner/logs).
//   KASIR     : ditolak.
// Ini route handler GET biasa: tautan unduh bisa dibagikan/di-bookmark,
// dan tidak butuh server action.

const CSV_HEADERS = [
  "Waktu",
  "Aktor",
  "Peran",
  "Outlet",
  "Aksi",
  "Entitas",
  "Ringkasan",
] as const;

// Escape satu field CSV. Pemisah dipakai ";" (bukan ",") karena Excel
// Indonesia memakai koma sebagai desimal — koma sebagai pemisah membuat
// semua kolom menyatu jadi satu saat file dibuka dengan dobel-klik.
// Field dibungkus kutip ganda bila mengandung pemisah/kutip/baris baru,
// dan kutip ganda di dalamnya digandakan (aturan RFC 4180).
function csvField(value: string): string {
  if (/[;"\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const wibStamp = (date: Date) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(date);

// Nama file unik per unduhan (WIB) — memudahkan membandingkan beberapa
// unduhan berurutan tanpa timpa-timpunan.
function exportFileName(): string {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `log-aktivitas-${wib.getUTCFullYear()}${p(wib.getUTCMonth() + 1)}${p(wib.getUTCDate())}-${p(wib.getUTCHours())}${p(wib.getUTCMinutes())}${p(wib.getUTCSeconds())}.csv`;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: "Sesi sudah berakhir. Silakan login ulang." },
      { status: 401 },
    );
  }
  const role = session.user.role;
  if (role !== "DEVELOPER" && role !== "OWNER") {
    return Response.json(
      { error: "Hanya developer atau pemilik yang boleh mengunduh log." },
      { status: 403 },
    );
  }

  const params = new URL(request.url).searchParams;
  const input: LogFilterInput = {
    q: params.get("q") ?? undefined,
    action: params.get("action") ?? undefined,
    outlet: params.get("outlet") ?? undefined,
    actor: params.get("actor") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  };

  const where = buildLogWhere(input);

  // Scope owner: outlet sendiri, param outlet diabaikan (bukan sekadar
  // disembunyikan dari form — route ini bisa dipanggil langsung dengan
  // URL buatan tangan tanpa outlet sama sekali = kosong yang jujur).
  if (role === "OWNER") {
    const outletId =
      session.user.outletId ??
      (await prisma.outlet.findFirst({ select: { id: true } }))?.id;
    const scoped: Prisma.AuditEventWhereInput = outletId
      ? { AND: [where, { outletId }] }
      : { AND: [where, { outletId: "__tidak-ada__" }] };
    return respondCsv(scoped);
  }

  return respondCsv(where);
}

async function respondCsv(where: Prisma.AuditEventWhereInput) {
  const rows = await prisma.auditEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: LOG_EXPORT_ROW_CAP,
    select: {
      createdAt: true,
      action: true,
      entity: true,
      summary: true,
      actor: { select: { name: true, role: true } },
      outlet: { select: { name: true } },
    },
  });

  const lines = [CSV_HEADERS.join(";")];
  for (const row of rows) {
    lines.push(
      [
        wibStamp(row.createdAt),
        row.actor?.name ?? "Sistem",
        row.actor?.role ?? "",
        row.outlet?.name ?? "",
        row.action,
        row.entity ?? "",
        row.summary,
      ]
        .map(csvField)
        .join(";"),
    );
  }

  // BOM UTF-8 di depan: tanpa ini Excel menebak charset yang salah dan
  // ringkasan berbahasa Indonesia berubah jadi tanda tanya.
  const csv = `\uFEFF${lines.join("\r\n")}\r\n`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName()}"`,
      // Log bisa berangsur memuat data sensitif — jangan pernah dicache.
      "Cache-Control": "no-store",
    },
  });
}
