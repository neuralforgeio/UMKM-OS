"use client";

// Sidebar UMKM OS v1.0.0, komponen terpisah agar mudah dirawat.
//
// Perilaku:
//  * Layar lebar: kolom tetap 252px; tombol ringkas di dasar sidebar
//    memincutnya menjadi 76px berisi ikon saja (label tetap terbaca
//    lewat tooltip). Status diringkatkan diingat AppShell di penyimpanan
//    lokal sehingga preferensi pemilik bertahan antar halaman.
//  * Layar kecil: laci tetap penuh 260px yang meluncur dari kiri dengan
//    lapisan gelap; tombol tutup selalu terlihat di baris merek.
//  * Logo warung dirender StoreSwitcher (satu satunya pemilik logo di
//    seluruh aplikasi) sehingga tidak pernah ada halaman yang kehilangan
//    ikon warungnya lagi.

import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import type { UserMenuUser } from "@/components/user-menu";
import type { ShellRole } from "@/lib/shell-nav";
import { StoreSwitcher } from "./store-switcher";
import { SidebarNavSection } from "./sidebar-nav";
import { OscarCard } from "./oscar-card";
import { SidebarUser } from "./sidebar-user";
import type { AppShellOutlet } from "./app-shell";

function BrandMarkTile() {
  return (
    <div
      aria-hidden="true"
      className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#8a7cff] to-[#5a4be2] text-white shadow-md shadow-[#7060ff]/25"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[22px] w-[22px]"
      >
        <path d="M3 10.5 5 4h14l2 6.5" />
        <path d="M4 10.5v8.2c0 .7.6 1.3 1.3 1.3h13.4c.7 0 1.3-.6 1.3-1.3v-8.2" />
        <path d="M3 10.5c.4 1.5 1.4 2.3 2.7 2.3 1.4 0 2.3-.8 2.7-2.3.4 1.5 1.3 2.3 2.7 2.3s2.3-.8 2.7-2.3c.4 1.5 1.3 2.3 2.7 2.3s2.3-.8 2.7-2.3" />
        <path d="M9 20v-5h6v5" />
      </svg>
    </div>
  );
}

export function AppSidebar({
  role,
  user,
  outlet,
  pathname,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: {
  role: ShellRole;
  user: UserMenuUser;
  outlet: AppShellOutlet;
  pathname: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  // Teks hanya disembunyikan pada LAYAR LEBAR saat diringkatkan; laci
  // ponsel selalu memperlihatkan label penuh agar tetap mudah dibaca.
  const sembunyiText = collapsed ? "lg:hidden" : "";

  return (
    <aside
      aria-label="Navigasi utama"
      className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-shell-line bg-shell-sidebar transition-[width,transform] duration-200 ease-out lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 ${
        collapsed ? "lg:w-[76px]" : "lg:w-[252px]"
      } ${mobileOpen ? "w-[260px] translate-x-0" : "w-[260px] -translate-x-full"}`}
    >
      {/* Baris merek + tombol tutup laci (khusus layar kecil) */}
      <div className="flex items-center gap-2 px-4 pb-5 pt-5">
        <Link
          href={
            role === "KASIR" ? "/" : role === "DEVELOPER" ? "/dev" : "/owner"
          }
          className="flex min-w-0 flex-1 items-center gap-3"
          title="UMKM OS"
        >
          <BrandMarkTile />
          <span className={`min-w-0 ${sembunyiText}`}>
            <span className="block text-[15px] font-extrabold leading-none tracking-tight text-shell-ink">
              UMKM OS
            </span>
            <span className="mt-1 block text-[11px] leading-none text-shell-muted">
              Ruang kerja operasional
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Tutup menu navigasi"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-shell-muted transition hover:bg-shell-soft hover:text-shell-ink lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <StoreSwitcher
        name={outlet.name}
        logoUrl={outlet.logoUrl}
        address={outlet.address ?? null}
        collapsed={collapsed}
      />

      <SidebarNavSection role={role} pathname={pathname} collapsed={collapsed} />

      <div className="flex-1" />

      {role === "OWNER" && (
        <div className={sembunyiText}>
          <OscarCard />
        </div>
      )}

      {/* Tombol ringkaskan / bentangkan (khusus layar lebar) */}
      <div className="hidden lg:block">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={
            collapsed
              ? "Bentangkan panel navigasi"
              : "Ringkatkan panel navigasi"
          }
          title={
            collapsed
              ? "Bentangkan panel navigasi"
              : "Ringkatkan panel navigasi"
          }
          className={`flex w-full items-center gap-2.5 rounded-xl px-4 py-2.5 text-[11px] font-semibold text-shell-muted transition hover:bg-shell-soft hover:text-shell-ink ${
            collapsed ? "justify-center" : ""
          }`}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" />
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0" />
          )}
          <span className={collapsed ? "hidden" : ""}>
            {collapsed ? "" : "Ringkatkan panel"}
          </span>
        </button>
      </div>

      <SidebarUser user={user} collapsed={collapsed} />
    </aside>
  );
}
