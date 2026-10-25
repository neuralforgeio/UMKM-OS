import Link from "next/link";
import { redirect } from "next/navigation";
import { FileSpreadsheet, Settings } from "lucide-react";
import { AuroraBackground } from "@/components/aurora-background";
import { ThemeHeaderActions } from "@/components/theme-header-actions";
import { auth } from "@/lib/auth";
import { getOutletContext, outletLogoUrl } from "@/lib/outlet-context";
import { OutletLogoForm, OutletProfileForm } from "./settings-forms";

export const instant = false;

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "OWNER" && session.user.role !== "DEVELOPER") {
    redirect("/cashier");
  }

  // v2.0.0: identitas outlet dari backend-go — pengaturan mengedit outlet
  // IKATAN akun pemanggil, bukan lagi baris pertama tabel Prisma yang
  // diam-diam dipakai bersama semua outlet.
  const outlet = await getOutletContext();
  if (!outlet) {
    throw new Error(
      "Identitas outlet tidak terbaca dari backend — pastikan backend-go berjalan, lalu muat ulang halaman ini.",
    );
  }

  const logoUrl = outletLogoUrl(outlet);

  const INPUT_CLASS =
    "w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20";

  return (
    // Shell aurora (v1.8.0): header kaca + latar ambient, ikut tema pengguna.
    <div className="relative flex min-h-dvh flex-col bg-slate-100 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <AuroraBackground />
      <header className="relative z-10 shrink-0 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/70">
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
              <h1 className="truncate text-base font-bold leading-tight text-slate-900 dark:text-slate-100">
                Pengaturan — {outlet.name}
              </h1>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {session.user.name ?? "Pemilik"} · Pemilik
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeHeaderActions />
            <Link
              href="/owner"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              Laporan
            </Link>
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              Beranda
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6">
        <section className="rounded-2xl glass-card p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Profil Warung</h2>
          <p className="mt-1 mb-5 text-sm text-slate-500 dark:text-slate-400">
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

        <section className="rounded-2xl glass-card p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Logo UMKM</h2>
          <p className="mt-1 mb-5 text-sm text-slate-500 dark:text-slate-400">
            Logo warungmu — muncul di struk, header kasir, dan ikon browser.
          </p>
          <OutletLogoForm logoUrl={logoUrl} />
        </section>

        {/* Unduh log outlet (Task 35): GET form biasa ke route export —
            owner otomatis di-scope ke outletnya sendiri di server, jadi
            tidak ada parameter outlet yang bisa (perlu) diutak-atik. */}
        <section className="rounded-2xl glass-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Log Aktivitas &amp; Analisa
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
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
                className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
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
                className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
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
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
            Rentang kosong = semua waktu. Maksimal 10.000 baris per unduhan —
            untuk penelusuran panjang, unduh per rentang bulan. Hanya event
            outlet {outlet.name} yang ikut.
          </p>
        </section>

        <section className="rounded-2xl glass-card p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Pratinjau Kop Struk
          </h2>
          <p className="mt-1 mb-5 text-sm text-slate-500 dark:text-slate-400">
            Beginilah bagian atas strukmu akan tercetak.
          </p>
          {/* Kertas struk fisik: TETAP PUTIH di kedua tema (v1.8.0). */}
          <div className="mx-auto w-full max-w-[280px] bg-white px-4 py-4 font-mono text-[11px] text-slate-900 ring-1 ring-slate-200 dark:shadow-black/40">
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
            <p className="text-center text-[9px] text-slate-400 dark:text-slate-500">
              … sisa struk menyusul di halaman kasir
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}