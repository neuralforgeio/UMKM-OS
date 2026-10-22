import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OutletLogoForm, OutletProfileForm } from "./settings-forms";

export const instant = false;

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "OWNER") redirect("/cashier");

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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
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
