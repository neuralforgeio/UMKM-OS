import Link from "next/link";
import { redirect } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { buildLogQuery, logQueryString } from "@/lib/audit-query";
import {
  LEVEL_BADGE,
  actionLabel,
  actionLevel,
} from "@/lib/audit-labels";
import { buildAuditCommand } from "@/lib/audit-terminal";
import { AuditTerminal } from "@/components/audit-terminal";
import { WorkspaceShell } from "@/components/workspace-shell";
import { SelectInput } from "@/components/select-input";
import { userMenuUser } from "@/lib/session-user";
import { LogsPagination } from "./logs-pagination";

export const instant = false;

// Query jejak audit penuh (Task 34 Fase B, diperbarui Task 35) —
// khusus DEVELOPER. Pagination dan filter HIDUP DI URL (server-side):
// tabel audit tumbuh tanpa batas (setiap transaksi/stok/login menambah
// baris), jadi tidak seperti halaman produk yang memuat semua baris —
// di sini setiap halaman hanya membaca 20 baris dari database.
// Task 35: kolom aksi label manusiawi + kode mentah, tingkat
// SUKSES/PERINGATAN/GAGAL (filter-able), unduhan EXCEL ber-grafik.
// v2.1.0: data dari GET /audit-logs backend-go (ber-outlet sejak
// backend-go v1.6.0 — kolom Outlet hidup, bukan data beku Prisma).
// v2.2.1: (1) topbar FULL-WIDTH memanjang kanan-kiri seperti navbar
// kasir/owner; (2) DUA MODE TAMPILAN — "Tabel" (default, seperti
// sebelumnya) dan "Terminal" (?view=terminal, hidup di URL sehingga
// bisa di-bookmark): jendela terminal PowerShell penuh yang baris
// perintahnya MENCERMINKAN filter aktif (-Level/-Outlet/-Actor/-From/
// -To); filter, pagination, dan unduh Excel tetap berfungsi di kedua
// mode — pagination mempertahankan mode lewat query string.
const PAGE_SIZE = 20;

const ROLE_BADGE: Record<string, string> = {
  OWNER: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  KASIR: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  DEVELOPER: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};

// Bentuk baris audit dari backend-go (audit.go AuditLog).
type GoAuditRow = {
  id: number;
  user_id: number | null;
  user_name: string;
  user_role: string;
  outlet_id: number | null;
  outlet_name: string;
  action: string;
  entity: string;
  entity_id: string;
  detail: string;
  created_at: string;
};

type GoAuditResponse = {
  rows: GoAuditRow[];
  total: number;
  actions: string[];
};

type GoOutletOption = { id: number; name: string };
type GoUserOption = { id: number; name: string; role: string };

function formatWib(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export default async function DevLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "DEVELOPER") redirect("/");
  if (!session.user.goToken) redirect("/login");
  const token = session.user.goToken;

  const sp = await searchParams;
  const one = (key: string): string | undefined => {
    const value = sp[key];
    return typeof value === "string" ? value : undefined;
  };

  const q = one("q") ?? "";
  const action = one("action") ?? "";
  const outlet = one("outlet") ?? "";
  const actor = one("actor") ?? "";
  const from = one("from") ?? "";
  const to = one("to") ?? "";
  const level = one("level") ?? "";
  const page = Math.max(1, parseInt(one("page") ?? "1", 10) || 1);
  // v2.2.1: mode tampilan — "table" (default) atau "terminal", hidup
  // di URL supaya bisa di-bookmark & dibagikan seperti filter lainnya.
  const view = one("view") === "terminal" ? "terminal" : "table";

  const actionTitle = action
    ? `${actionLabel(action)} (${action})`
    : "Semua Aksi";

  // Filter + paginasi diteruskan ke backend-go dalam satu panggilan;
  // total untuk jumlah halaman, actions untuk dropdown filter.
  const filterInput = { q, action, outlet, actor, from, to, level };
  const query = buildLogQuery(filterInput);
  query.set("limit", String(PAGE_SIZE));
  query.set("offset", String((page - 1) * PAGE_SIZE));

  // Daftar aksi yang BENAR-BENAR pernah terjadi + daftar outlet & aktor
  // untuk dropdown — semuanya dari Go, bukan tabel beku era Prisma.
  const [logsRes, outletsRes, usersRes] = await Promise.all([
    goFetch<GoAuditResponse>(token, `/audit-logs?${query.toString()}`),
    goFetch<GoOutletOption[]>(token, "/outlets"),
    goFetch<GoUserOption[]>(token, "/users"),
  ]);
  if (!logsRes.ok) throw new Error(logsRes.message);

  const total = logsRes.data.total;
  const rows = logsRes.data.rows ?? [];
  const actionOptions = logsRes.data.actions ?? [];
  const outlets = outletsRes.ok
    ? [...(outletsRes.data ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, "id-ID"),
      )
    : [];
  const actors = usersRes.ok
    ? [...(usersRes.data ?? [])]
        .filter((u) => u.name)
        .sort((a, b) => a.name.localeCompare(b.name, "id-ID"))
    : [];

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);

  // Query string filter aktif — dipakai pagination (pertahankan filter)
  // dan tombol export (unduh hasil filter INI, bukan semua log).
  const qs = logQueryString(filterInput);

  // v2.2.1: alamat mode (filter dipertahankan) + query string untuk
  // pagination yang juga MEMPERTAHANKAN mode terminal saat berpindah
  // halaman — tanpa ini, klik halaman 2 diam-diam melempar balik ke
  // mode tabel.
  const tableHref = qs ? `/dev/logs${qs}` : "/dev/logs";
  const terminalHref = qs
    ? `/dev/logs${qs}&view=terminal`
    : "/dev/logs?view=terminal";
  const qsNav =
    view === "terminal" ? (qs ? `${qs}&view=terminal` : "?view=terminal") : qs;

  // Nama outlet/aktor untuk baris perintah PowerShell di kepala
  // terminal — id mentah (#3) dipakai bila namanya tak ketemu.
  const outletName = outlet
    ? outlets.find((o) => String(o.id) === outlet)?.name
    : undefined;
  const actorName = actor
    ? actors.find((a) => String(a.id) === actor)?.name
    : undefined;
  const command = buildAuditCommand(
    { q, action, level, outletId: outlet, outletName, actorId: actor, actorName, from, to },
    PAGE_SIZE,
  );

  return (
    // Shell v3.2.0: sidebar WORKSPACE/MANAGE varian konsol developer
    // (pola PDF "Audit log") — tombol Unduh Excel jadi SATU aksi utama.
    <WorkspaceShell
      variant="dev"
      active="log"
      user={userMenuUser(session)}
      overline="Konsol Developer"
      title="Jejak audit sistem"
      desc={`Setiap aksi tercatat: login, transaksi, stok, akun, hingga percobaan yang gagal — ${total.toLocaleString("id-ID")} baris cocok filter. Filter hidup di URL; maksimum 10.000 baris per unduhan.`}
      actions={
        <a
          href={`/api/logs/export${qs}`}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover"
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span className="hidden sm:inline">Unduh Excel (+ Grafik)</span>
          <span className="sm:hidden">Excel</span>
        </a>
      }
      mainClassName="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8"
    >
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">

          {/* v2.2.1: saklar mode Tabel / Terminal — filter aktif
              dipertahankan saat berpindah mode. */}
          <div
            className="flex rounded-xl border border-slate-300 bg-white p-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-900"
            role="tablist"
            aria-label="Mode tampilan log"
          >
            <Link
              href={tableHref}
              role="tab"
              aria-selected={view === "table"}
              className={
                view === "table"
                  ? "rounded-lg bg-blue-600 px-3.5 py-1.5 text-white"
                  : "rounded-lg px-3.5 py-1.5 text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }
            >
              Tabel
            </Link>
            <Link
              href={terminalHref}
              role="tab"
              aria-selected={view === "terminal"}
              className={
                view === "terminal"
                  ? "rounded-lg bg-slate-900 px-3.5 py-1.5 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "rounded-lg px-3.5 py-1.5 text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }
            >
              Terminal
            </Link>
          </div>
        </div>

        <form
          method="get"
          className="glass-card grid gap-2.5 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {/* Mode tampilan ikut terkirim saat filter diterapkan — tanpa
              ini, menekan "Terapkan Filter" diam-diam kembali ke tabel. */}
          <input type="hidden" name="view" defaultValue={view} />
          <div className="relative lg:col-span-2">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Cari ringkasan / entitas / nama aktor…"
              aria-label="Cari teks"
              className="glass-input w-full rounded-xl px-4 py-2.5 text-xs transition-all focus:outline-none"
            />
          </div>
          <SelectInput name="action" defaultValue={action} aria-label="Filter aksi">
            <option value="">Semua aksi</option>
            {actionOptions.map((a) => (
              <option key={a} value={a}>
                {actionLabel(a)} ({a})
              </option>
            ))}
          </SelectInput>
          <SelectInput name="level" defaultValue={level} aria-label="Filter tingkat">
            <option value="">Semua tingkat</option>
            <option value="SUKSES">SUKSES — selesai normal</option>
            <option value="PERINGATAN">PERINGATAN — aksi sensitif</option>
            <option value="GAGAL">GAGAL — ada error</option>
          </SelectInput>
          <SelectInput name="outlet" defaultValue={outlet} aria-label="Filter outlet">
            <option value="">Semua outlet</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </SelectInput>
          <SelectInput name="actor" defaultValue={actor} aria-label="Filter aktor">
            <option value="">Semua aktor</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </SelectInput>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <input
                type="date"
                name="from"
                defaultValue={from}
                aria-label="Dari tanggal (WIB)"
                className="glass-input w-full rounded-xl px-3 py-2.5 text-xs transition-all focus:outline-none"
              />
            </div>
            <div>
              <input
                type="date"
                name="to"
                defaultValue={to}
                aria-label="Sampai tanggal (WIB)"
                className="glass-input w-full rounded-xl px-3 py-2.5 text-xs transition-all focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98]"
            >
              Terapkan Filter
            </button>
            <Link
              href="/dev/logs"
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              Reset
            </Link>
            <p className="hidden text-[11px] text-slate-500 sm:block dark:text-slate-400">
              Rentang tanggal ditafsirkan menurut WIB.
            </p>
          </div>
        </form>

        {view === "terminal" ? (
          /* ===== MODE TERMINAL (v2.2.1): jendela PowerShell penuh —
              perintah di kepala = filter aktif, baris log padat
              berwarna, pagination di bawah tetap berbasis URL. ===== */
          <section className="mt-3">
            <AuditTerminal
              title={`umkm-os — jejak audit — ${total.toLocaleString("id-ID")} baris cocok filter`}
              command={command}
              note="filter & unduhan Excel tetap berlaku di mode ini"
              rows={rows}
              variant="full"
              footerRight={
                <Link
                  href={tableHref}
                  className="text-[11px] font-semibold text-violet-400 transition hover:text-violet-300 hover:underline"
                >
                  mode tabel →
                </Link>
              }
            />
            <div className="mt-3">
              <LogsPagination
                page={safePage}
                pageCount={pageCount}
                pageSize={PAGE_SIZE}
                total={total}
                basePath="/dev/logs"
                queryString={qsNav}
              />
            </div>
          </section>
        ) : (
          /* ===== MODE TABEL (default): tampilan lama yang sudah
              dikenal — lebih renggang, cocok dibaca pelan-pelan. ===== */
          <section className="glass-card mt-3 overflow-hidden rounded-2xl border-slate-200/80 dark:border-slate-800/80">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-100/70 text-left text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-400">
                    <th className="px-4 py-3 font-semibold">Waktu (WIB)</th>
                    <th className="px-4 py-3 font-semibold">Aktor</th>
                    <th className="px-4 py-3 font-semibold">Outlet</th>
                    <th className="px-4 py-3 font-semibold">Aksi</th>
                    <th className="px-4 py-3 font-semibold">Entitas</th>
                    <th className="px-4 py-3 font-semibold">Ringkasan</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const lvl = actionLevel(row.action);
                    const entityLabel = row.entity_id
                      ? `${row.entity}:${row.entity_id}`
                      : row.entity;
                    return (
                      <tr
                        key={row.id}
                        className={`border-b border-slate-200/60 align-top last:border-0 dark:border-slate-800/50 ${
                          lvl === "GAGAL"
                            ? "bg-red-50/40 dark:bg-red-950/20"
                            : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">
                          {formatWib(new Date(row.created_at))}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {row.user_name || "Sistem"}
                          </span>
                          {row.user_role && (
                            <span
                              className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${ROLE_BADGE[row.user_role] ?? "bg-slate-400/10 text-slate-600 dark:text-slate-300"}`}
                            >
                              {row.user_role}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {row.outlet_name || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {/* Label manusiawi berwarna tingkat + kode mentah:
                              "Owner menonaktifkan kasir" terbaca sekali
                              lihat, method aslinya tetap ada untuk pencarian. */}
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${LEVEL_BADGE[lvl]}`}
                          >
                            {actionLabel(row.action)}
                          </span>
                          <p className="mt-0.5 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                            {row.action}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400 dark:text-slate-500">
                          {entityLabel || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {row.detail}
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                      >
                        Tidak ada log yang cocok — longgarkan filter atau
                        perlebar rentang tanggal.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <LogsPagination
              page={safePage}
              pageCount={pageCount}
              pageSize={PAGE_SIZE}
              total={total}
              basePath="/dev/logs"
              queryString={qsNav}
            />
          </section>
        )}
    </WorkspaceShell>
  );
}
