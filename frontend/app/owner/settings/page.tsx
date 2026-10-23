import Link from "next/link";
import { redirect } from "next/navigation";
import { FileSpreadsheet, Settings } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OutletLogoForm, OutletProfileForm } from "./settings-forms";

export const instant = false;

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "OWNER" && session.user.role !== "DEVELOPER") {
    redirect("/cashier");
  }

  // Select only identity fields — the logo BYTES never leave the
  // server; the client gets a cache-busted URL instead.
  const outletSelect = {
    name: true,
    address: true,
    phone: true,
    logoMimeType: true,
    logoVersion: true,
  } as const;
  const outlet = session.user.outletId
    ? await prisma.outlet.findUnique({
        where: { id: session.user.outletId },
        select: outletSelect,
      })
    : await prisma.outlet.findFirst({ select: outletSelect });
  if (!outlet) redirect("/");

  const logoUrl = outlet.logoMimeType
    ? `/api/outlet/logo?v=${outlet.logoVersion}`
    : null;

  const INPUT_CLASS =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <div className="flex min-h-dvh flex-col bg-slate-100">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={`Logo ${outlet.name}`}
                className="h-10 w-10 shrink-0 rounded-xl object-contain"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Settings className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight text-slate-900">
                Pengaturan — {outlet.name}
              </h1>
              <p className="truncate text-xs text-slate-500">
                {session.user.name ?? "Pemilik"} · Pemilik
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/owner"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Laporan
            </Link>
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Beranda
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Profil Warung</h2>
          <p className="mt-1 mb-5 text-sm text-slate-500">
            Identitas yang tercetak di setiap struk dan tampil di aplikasi.
          </p>
          <OutletProfileForm
            outlet={{
              name: outlet.name,
              address: outlet.address,
              phone: outlet.phone,
            }}
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Logo UMKM</h2>
          <p className="mt-1 mb-5 text-sm text-slate-500">
            Logo warungmu — muncul di struk, header kasir, dan ikon browser.
          </p>
          <OutletLogoForm logoUrl={logoUrl} />
        </section>

        {/* Unduh log outlet (Task 35): GET form biasa ke route export —
            owner otomatis di-scope ke outletnya sendiri di server, jadi
            tidak ada parameter outlet yang bisa (perlu) diutak-atik. */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Log Aktivitas &amp; Analisa
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Unduh jejak audit outlet ini sebagai Excel: tabel log yang rapi
            (bisa difilter), grafik tren periodik, aktivitas per jam, top
            aksi, dan pivot harian — siap untuk analisa.
          </p>
          <form
            method="get"
            action="/api/logs/export"
            className="mt-4 flex flex-wrap items-end gap-3"
          >
            <div>
              <label
                htmlFor="log-from"
                className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Dari tanggal (WIB)
              </label>
              <input
                id="log-from"
                type="date"
                name="from"
                className={`${INPUT_CLASS} mt-1.5`}
              />
            </div>
            <div>
              <label
                htmlFor="log-to"
                className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Sampai tanggal (WIB)
              </label>
              <input
                id="log-to"
                type="date"
                name="to"
                className={`${INPUT_CLASS} mt-1.5`}
              />
            </div>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Unduh Excel (.xlsx)
            </button>
          </form>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            Rentang kosong = semua waktu. Maksimal 10.000 baris per unduhan —
            untuk penelusuran panjang, unduh per rentang bulan. Hanya event
            outlet {outlet.name} yang ikut.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Pratinjau Kop Struk
          </h2>
          <p className="mt-1 mb-5 text-sm text-slate-500">
            Beginilah bagian atas strukmu akan tercetak.
          </p>
          <div className="mx-auto w-full max-w-[280px] bg-white px-4 py-4 font-mono text-[11px] text-slate-900 ring-1 ring-slate-200">
            {logoUrl ? (
              <div className="flex items-start gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt={`Logo ${outlet.name}`}
                  className="h-10 w-10 shrink-0 rounded-md object-contain"
                />
                <div className="min-w-0">
                  <p className="text-[12px] font-bold uppercase leading-tight tracking-wide">
                    {outlet.name}
                  </p>
                  {outlet.address && (
                    <p className="mt-0.5 text-[9px] leading-snug">
                      {outlet.address}
                    </p>
                  )}
                  {outlet.phone && (
                    <p className="text-[9px] leading-snug">
                      Telp {outlet.phone}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-[12px] font-bold uppercase leading-tight tracking-wide">
                  {outlet.name}
                </p>
                {outlet.address && (
                  <p className="mt-0.5 text-[9px] leading-snug">
                    {outlet.address}
                  </p>
                )}
                {outlet.phone && (
                  <p className="text-[9px] leading-snug">Telp {outlet.phone}</p>
                )}
              </div>
            )}
            <div className="my-2 border-t border-dashed border-neutral-400" />
            <p className="text-center text-[9px] text-slate-400">
              … sisa struk menyusul di halaman kasir
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
