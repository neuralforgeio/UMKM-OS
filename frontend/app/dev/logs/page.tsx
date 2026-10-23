import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download, ScrollText } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildLogWhere, logQueryString } from "@/lib/audit-query";
import { LogsPagination } from "./logs-pagination";

export const instant = false;

// Query jejak audit penuh (Task 34, Fase B) — khusus DEVELOPER.
// Pagination dan filter HIDUP DI URL (server-side): tabel audit tumbuh
// tanpa batas (setiap transaksi/stok/login menambah baris), jadi tidak
// seperti halaman produk yang memuat semua baris — di sini setiap halaman
// hanya membaca 20 baris dari database.
const PAGE_SIZE = 20;

const ROLE_BADGE: Record<string, string> = {
  OWNER: "bg-blue-100 text-blue-700",
  KASIR: "bg-emerald-100 text-emerald-700",
  DEVELOPER: "bg-violet-100 text-violet-700",
};

function formatWib(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100";

export default async function DevLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "DEVELOPER") redirect("/");

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
  const page = Math.max(1, parseInt(one("page") ?? "1", 10) || 1);

  const where = buildLogWhere({ q, action, outlet, actor, from, to });

  const [total, rows, actionOptions, outlets, actors] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: {
        id: true,
        createdAt: true,
        action: true,
        entity: true,
        summary: true,
        actor: { select: { name: true, role: true } },
        outlet: { select: { name: true } },
      },
    }),
    // Daftar aksi yang BENAR-BENAR pernah terjadi — dropdown filter tidak
    // pernah menawarkan aksi hantu yang tidak ada datanya.
    prisma.auditEvent.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    prisma.outlet.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);

  // Query string filter aktif — dipakai pagination (pertahankan filter)
  // dan tombol export (unduh hasil filter INI, bukan semua log).
  const qs = logQueryString({ q, action, outlet, actor, from, to });

  return (
    <div className="min-h-dvh bg-slate-100">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:py-8">
        <Link
          href="/dev"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-violet-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali ke konsol developer
        </Link>

        <header className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-sm font-bold leading-tight text-slate-900">
              <ScrollText className="h-4 w-4 text-violet-600" />
              Log Aktivitas — query penuh
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {total} baris cocok filter · maks 10.000 baris per unduhan
            </p>
          </div>
          {/* Tautan <a> biasa ke route export: filter sama persis dengan
              layar, jadi file yang terunduh = yang sedang dilihat. */}
          <a
            href={`/api/logs/export${qs}`}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700"
          >
            <Download className="h-4 w-4" />
            Unduh CSV
          </a>
        </header>

        <form
          method="get"
          className="mt-4 grid gap-2.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
        >
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Cari ringkasan / entitas / nama aktor…"
            className={`${INPUT_CLASS} lg:col-span-2`}
          />
          <select
            name="action"
            defaultValue={action}
            className={INPUT_CLASS}
            aria-label="Filter aksi"
          >
            <option value="">Semua aksi</option>
            {actionOptions.map((a) => (
              <option key={a.action} value={a.action}>
                {a.action}
              </option>
            ))}
          </select>
          <select
            name="outlet"
            defaultValue={outlet}
            className={INPUT_CLASS}
            aria-label="Filter outlet"
          >
            <option value="">Semua outlet</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select
            name="actor"
            defaultValue={actor}
            className={INPUT_CLASS}
            aria-label="Filter aktor"
          >
            <option value="">Semua aktor</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <input
                type="date"
                name="from"
                defaultValue={from}
                className={INPUT_CLASS}
                aria-label="Dari tanggal (WIB)"
              />
            </div>
            <div>
              <input
                type="date"
                name="to"
                defaultValue={to}
                className={INPUT_CLASS}
                aria-label="Sampai tanggal (WIB)"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
            >
              Terapkan Filter
            </button>
            <Link
              href="/dev/logs"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Reset
            </Link>
            <p className="hidden text-[11px] text-slate-400 sm:block">
              Rentang tanggal ditafsirkan menurut WIB.
            </p>
          </div>
        </form>

        <section className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 pb-2.5 font-semibold">Waktu (WIB)</th>
                  <th className="px-4 pb-2.5 font-semibold">Aktor</th>
                  <th className="px-4 pb-2.5 font-semibold">Outlet</th>
                  <th className="px-4 pb-2.5 font-semibold">Aksi</th>
                  <th className="px-4 pb-2.5 font-semibold">Entitas</th>
                  <th className="px-4 pb-2.5 font-semibold">Ringkasan</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 last:border-0 align-top"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">
                      {formatWib(row.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-slate-800">
                        {row.actor?.name ?? "Sistem"}
                      </span>
                      {row.actor && (
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${ROLE_BADGE[row.actor.role] ?? "bg-slate-100 text-slate-600"}`}
                        >
                          {row.actor.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {row.outlet?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                          row.action === "LOGIN_FAILED" ||
                          row.action === "ACCOUNT_DELETE"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {row.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400">
                      {row.entity ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {row.summary}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-slate-400"
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
