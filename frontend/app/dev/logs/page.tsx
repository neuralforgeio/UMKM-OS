import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileSpreadsheet, ScrollText } from "lucide-react";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { buildLogQuery, logQueryString } from "@/lib/audit-query";
import {
  LEVEL_BADGE,
  actionLabel,
  actionLevel,
} from "@/lib/audit-labels";
import { AuroraBackground } from "@/components/aurora-background";
import { SelectInput } from "@/components/select-input";
import { UserMenu } from "@/components/user-menu";
import { userMenuUser } from "@/lib/session-user";
import { LogsPagination } from "./logs-pagination";

export const instant = false;

// Query jejak audit penuh (Task 34 Fase B, diperbarui Task 35) —
// khusus DEVELOPER. Pagination dan filter HIDUP DI URL (server-side):
// tabel audit tumbuh tanpa batas (setiap transaksi/stok/login menambah
// baris), jadi tidak seperti halaman produk yang memuat semua baris —
// di sini setiap halaman hanya membaca 20 baris dari database.
// Task 35: kolom aksi kini label manusiawi + kode mentah, dengan
// tingkat SUKSES/PERINGATAN/GAGAL (filter-able), dan unduhan berupa
// EXCEL ber-grafik (bukan CSV polos).
// v1.6.0: design aurora + glass sadar tema (terang/gelap/sistem) —
// logika query & pagination tidak berubah sama sekali.
// v2.1.0: data dari GET /audit-logs backend-go (ber-outlet sejak
// backend-go v1.6.0 — kolom Outlet kini hidup, bukan data beku Prisma).
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

  return (
    <div className="relative min-h-dvh bg-slate-100 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        {/* ===== Topbar: brand + breadcrumb + tema ===== */}
        <header className="sticky top-0 z-40 -mx-4 mb-5 border-b border-slate-200/80 bg-slate-100/70 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6 dark:border-slate-800/80 dark:bg-slate-950/70">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Link href="/dev" className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 p-[1px] shadow-md shadow-blue-500/20">
                  <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-white dark:bg-slate-950">
                    <ScrollText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div>
                  <span className="block text-base leading-none font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Log Aktivitas
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    {total.toLocaleString("id-ID")} baris cocok filter
                  </span>
                </div>
              </Link>

              <div className="hidden items-center space-x-2 border-l border-slate-200 pl-4 text-xs font-medium text-slate-500 md:flex dark:border-slate-800 dark:text-slate-400">
                <Link
                  href="/dev"
                  className="text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  Konsol
                </Link>
                <span className="text-slate-400 dark:text-slate-600">/</span>
                <span className="truncate font-semibold text-slate-700 dark:text-slate-300">
                  {actionTitle}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <UserMenu user={userMenuUser(session)} />

              {/* Tautan <a> biasa ke route export: filter sama persis dengan
                  layar, jadi file yang terunduh = yang sedang dilihat. Kini
                  berupa .xlsx: tabel rapi + grafik tren/periodik + pivot. */}
              <a
                href={`/api/logs/export${qs}`}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98]"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="hidden sm:inline">Unduh Excel (+ Grafik)</span>
                <span className="sm:hidden">Excel</span>
              </a>
            </div>
          </div>
        </header>

        <Link
          href="/dev"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali ke konsol developer
        </Link>

        <div className="mt-4 mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
              Jejak Audit Sistem
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500 sm:text-sm dark:text-slate-400">
              Setiap aksi tercatat: login, transaksi, stok, akun, hingga
              percobaan yang gagal. Filter hidup di URL — hasilnya bisa
              di-bookmark dan dibagikan; maksimum 10.000 baris per unduhan.
            </p>
          </div>
        </div>

        <form
          method="get"
          className="glass-card grid gap-2.5 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
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
            queryString={qs}
          />
        </section>
      </div>
    </div>
  );
}
