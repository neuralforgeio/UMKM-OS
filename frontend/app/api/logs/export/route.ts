import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import {
  LOG_EXPORT_ROW_CAP,
  buildLogWhere,
  type LogFilterInput,
} from "@/lib/audit-query";
import { buildLogWorkbook, type LogRow } from "@/lib/log-xlsx";

// Export EXCEL jejak audit (Task 35, menggantikan CSV Fase B).
//
// Dua pintu dengan dua hak akses BERBEDA — dipaksa di server, bukan di UI:
//   DEVELOPER : semua outlet + semua filter (q, action, outlet, actor,
//               rentang tanggal from/to, tingkat level).
//   OWNER     : hanya outlet sendiri — parameter outlet diabaikan total.
//               (Tombol unduh untuk owner ada di /owner/settings.)
//   KASIR     : ditolak.
// Route handler GET biasa: tautan unduh bisa dibagikan/di-bookmark, dan
// tidak butuh server action. Hasilnya workbook .xlsx bergambar:
// Ringkasan (KPI + 4 grafik), Log (rapi, beku header, autofilter),
// dan Pivot Harian.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function wibDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// Ringkasan filter aktif untuk baris keterangan di sheet Ringkasan —
// pemilik file harus tahu persis apa yang sedang dia lihat.
function describeFilters(input: LogFilterInput): string {
  const parts: string[] = [];
  if (input.q?.trim()) parts.push(`cari="${input.q.trim()}"`);
  if (input.action) parts.push(`aksi=${input.action}`);
  if (input.level) parts.push(`tingkat=${input.level}`);
  if (input.outlet) parts.push("outlet difilter");
  if (input.actor) parts.push("aktor difilter");
  if (input.from && DATE_RE.test(input.from)) {
    parts.push(`dari ${wibDayLabel(input.from)}`);
  }
  if (input.to && DATE_RE.test(input.to)) {
    parts.push(`sampai ${wibDayLabel(input.to)}`);
  }
  return parts.length > 0 ? `Filter: ${parts.join(" · ")}` : "Tanpa filter (semua waktu)";
}

// Nama file unik per unduhan (WIB) — memudahkan membandingkan beberapa
// unduhan berurutan tanpa timpa-timpunan.
function exportFileName(): string {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `log-aktivitas-${wib.getUTCFullYear()}${p(wib.getUTCMonth() + 1)}${p(wib.getUTCDate())}-${p(wib.getUTCHours())}${p(wib.getUTCMinutes())}${p(wib.getUTCSeconds())}.xlsx`;
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
    level: params.get("level") ?? undefined,
  };

  const where = buildLogWhere(input);

  // Scope owner: outlet sendiri, param outlet diabaikan (bukan sekadar
  // disembunyikan dari form — route ini bisa dipanggil langsung dengan
  // URL buatan tangan tanpa outlet sama sekali = kosong yang jujur).
  let scopeWhere: Prisma.AuditEventWhereInput = where;
  let scopeLabel = "Semua outlet — akses developer";
  if (role === "OWNER") {
    const outlet = session.user.outletId
      ? await prisma.outlet.findUnique({
          where: { id: session.user.outletId },
          select: { id: true, name: true },
        })
      : await prisma.outlet.findFirst({ select: { id: true, name: true } });
    scopeWhere = outlet
      ? { AND: [where, { outletId: outlet.id }] }
      : { AND: [where, { outletId: "__tidak-ada__" }] };
    scopeLabel = outlet ? `Outlet: ${outlet.name}` : "Outlet belum ada";
  }

  const rows = await prisma.auditEvent.findMany({
    where: scopeWhere,
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

  // Periode aktual dari baris (WIB), bukan asumsi.
  let periode = "belum ada aktivitas";
  if (rows.length > 0) {
    const newest = rows[0].createdAt;
    const oldest = rows[rows.length - 1].createdAt;
    const shift = (d: Date) => new Date(d.getTime() + 7 * 60 * 60 * 1000);
    const fmt = (d: Date) =>
      `${shift(d).getUTCDate()}/${shift(d).getUTCMonth() + 1}/${shift(d).getUTCFullYear()}`;
    periode = rows.length === 1 ? fmt(newest) : `${fmt(oldest)} – ${fmt(newest)}`;
  }

  const logRows: LogRow[] = rows.map((row) => ({
    createdAt: row.createdAt,
    actorName: row.actor?.name ?? null,
    actorRole: row.actor?.role ?? null,
    outletName: row.outlet?.name ?? null,
    action: row.action,
    entity: row.entity ?? null,
    summary: row.summary,
  }));

  const buffer = await buildLogWorkbook(logRows, {
    scope: scopeLabel,
    periode,
    filterNote: describeFilters(input),
    generatedAt: new Date(),
  });

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${exportFileName()}"`,
      // Log bisa berangsur memuat data sensitif — jangan pernah dicache.
      "Cache-Control": "no-store",
    },
  });
}
