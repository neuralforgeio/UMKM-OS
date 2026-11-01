"use client";

// Topbar shell UMKM OS v1.1.0: remah roti + JUDUL HALAMAN + subjudul.
//
// Perubahan besar v1.1.0 (permintaan pemilik, berlaku untuk semua peran):
// menu profil pengguna dan saklar tema DIHAPUS dari topbar. Sebagai
// gantinya, sisi kanan kini memuat dua hal yang lebih sering dipakai
// saat bekerja: jam WIB hidup (ringkas) dan tombol Changelog (riwayat
// perubahan produk). Profil, ganti tema, dan keluar berpindah ke menu
// akun di dasar sidebar. Pengecualian: beranda "/" tetap memakai navbar
// lamanya lengkap dengan profil (tidak memakai komponen ini).

import { Menu } from "lucide-react";
import { LocalClock } from "@/components/ui/local-clock";
import { Changelog } from "./changelog";

export function Topbar({
  crumb,
  title,
  subtitle,
  onOpenMobileMenu,
}: {
  crumb: string;
  title: string;
  subtitle?: string;
  onOpenMobileMenu: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-shell-line bg-shell/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1680px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Buka menu navigasi"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-shell-line bg-shell-card text-shell-ink-soft transition hover:border-shell-line-strong hover:text-shell-ink lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <nav
            aria-label="Remah roti"
            className="flex items-center gap-1.5 text-[11px] text-shell-muted"
          >
            <span>Ruang Kerja</span>
            <span aria-hidden="true">/</span>
            <span>{crumb}</span>
          </nav>
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h1 className="truncate text-[15px] font-bold leading-tight tracking-tight text-shell-ink">
              {title}
            </h1>
            {subtitle && (
              <p className="hidden truncate text-[11px] text-shell-muted sm:block">
                {subtitle}
              </p>
            )}
          </div>
          {subtitle && (
            <p className="truncate text-[11px] text-shell-muted sm:hidden">
              {subtitle}
            </p>
          )}
        </div>

        {/* Jam WIB ringkas + Changelog menggantikan menu profil (v1.1.0);
            profil/tema/keluar ada di menu akun dasar sidebar. */}
        <div className="flex shrink-0 items-center gap-2">
          <LocalClock ringkas />
          <Changelog />
        </div>
      </div>
    </header>
  );
}
