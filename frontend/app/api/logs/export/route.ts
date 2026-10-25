import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { getOutletContext } from "@/lib/outlet-context";
import {
  LOG_EXPORT_ROW_CAP,
  buildLogQuery,
  type LogFilterInput,
} from "@/lib/audit-query";
import { buildLogWorkbook, type LogRow } from "@/lib/log-xlsx";

// Export EXCEL jejak audit (Task 35, menggantikan CSV Fase B; v2.1.0:
// data dari GET /audit-logs backend-go — bukan tabel Prisma beku).
//
// Dua pintu dengan dua hak akses BERBEDA — dipaksa di server, bukan di UI:
//   DEVELOPER : semua outlet + semua filter (q, action, outlet, actor,
//               rentang tanggal from/to, tingkat level).
//   OWNER     : hanya outlet sendiri — scope ditegakkan BACKEND-GO dari
//               ikatan akun (param outlet diabaikan total di sisi Go,
//               jadi URL buatan tangan tanpa outlet sama sekali tetap
//               jujur). Tombol unduh untuk owner ada di /owner/settings.
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

// Bentuk baris audit dari backend-go (audit.go AuditLog).
type GoAuditRow = {
  id: number;
  user_name: string;
  user_role: string;
  outlet_name: string;
  action: string;
  entity: string;
  entity_id: string;
  detail: string;
  created_at: string;
};

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
  if (!session.user.goToken) {
    return Response.json(
      { error: "Sesi tanpa token backend — login ulang." },
      { status: 401 },
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

  // Scope owner: Go mengunci ke outlet konteks akun (ikatan segar);
  // developer bebas. Label sheet Ringkasan menyesuaikan supaya pemilik
  // file tahu lensa mana yang dipakai.
  let scopeLabel = "Semua outlet — akses developer";
  if (role === "OWNER") {
    const outlet = await getOutletContext();
    scopeLabel = outlet ? `Outlet: ${outlet.name}` : "Outlet belum ada";
  }

  // Satu panggilan utuh (limit = cap export); filter identik dengan
  // layar /dev/logs karena dibangun fungsi yang sama.
  const query = buildLogQuery(input);
  query.set("limit", String(LOG_EXPORT_ROW_CAP));
  const res = await goFetch<{ rows: GoAuditRow[]; total: number }>(
    session.user.goToken,
    `/audit-logs?${query.toString()}`,
  );
  if (!res.ok) {
    return Response.json({ error: res.message }, { status: 502 });
  }
  const rows = res.data.rows ?? [];

  // Periode aktual dari baris (WIB), bukan asumsi.
  let periode = "belum ada aktivitas";
  if (rows.length > 0) {
    const newest = new Date(rows[0].created_at);
    const oldest = new Date(rows[rows.length - 1].created_at);
    const shift = (d: Date) => new Date(d.getTime() + 7 * 60 * 60 * 1000);
    const fmt = (d: Date) =>
      `${shift(d).getUTCDate()}/${shift(d).getUTCMonth() + 1}/${shift(d).getUTCFullYear()}`;
    periode = rows.length === 1 ? fmt(newest) : `${fmt(oldest)} – ${fmt(newest)}`;
  }

  const logRows: LogRow[] = rows.map((row) => ({
    createdAt: new Date(row.created_at),
    actorName: row.user_name || null,
    actorRole: row.user_role || null,
    outletName: row.outlet_name || null,
    action: row.action,
    entity: row.entity_id ? `${row.entity}:${row.entity_id}` : row.entity,
    summary: row.detail,
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
