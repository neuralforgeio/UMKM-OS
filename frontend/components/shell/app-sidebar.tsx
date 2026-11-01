"use client";

// Sidebar UMKM OS v1.1.0, komponen terpisah agar mudah dirawat.
//
// Perubahan v1.1.0 (keluhan pemilik: "ada kotak besar menutupi bagian
// Pengelolaan, harus digulir dulu baru kelihatan menunya"):
//  * Kartu ajakan "Tanya OSCAR" DIHAPUS dari sidebar (halaman OSCAR
//    tetap bisa dibuka lewat menu OSCAR di bagian Pengelolaan). Bersama
//    tombol ringkatkan yang dipindah ke baris kepala, ruang vertikal
//    kartu itu kini dipakai menu navigasi sehingga seluruh menu terlihat
//    tanpa menggulir pada layar pendek sekalipun.
//  * Tombol ringkatkan panel kini IKON SAJA di POJOK KANAN ATAS
//    sidebar (teks "Ringkatkan panel" dihapus); pintasan Ctrl+B juga
//    bisa (dipasang di AppShell yang memegang statusnya).
//  * Dasar sidebar memuat menu akun (SidebarUser) yang membuka profil,
//    pengaturan tampilan, ganti tema, dan keluar.
//
// Perilaku lama yang dipertahankan: layar lebar 252px yang bisa
// dimincut menjadi 76px berisi ikon saja (tooltip tetap terbaca);
// status diringkatkan diingat AppShell di penyimpanan lokal; layar
// kecil memakai laci 260px ber-overlay; logo warung dirender
// StoreSwitcher sebagai satu-satunya pemilik tampilan identitas outlet.

import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import type { UserMenuUser } from "@/components/user-menu";
import type { ShellRole } from "@/lib/shell-nav";
import { StoreSwitcher } from "./store-switcher";
import { SidebarNavSection } from "./sidebar-nav";
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
      {/* Baris kepala: merek + tombol ringkatkan IKON di pojok kanan
          atas (khusus layar lebar) + tombol tutup laci (layar kecil).
          Saat diringkatkan hanya ikon tombolnya yang tersisa, tetap di
          pojok kanan, supaya mudah ditemukan tanpa teks. */}
      <div
        className={`flex items-center gap-2 px-3 pb-3 pt-4 ${
          collapsed ? "lg:justify-end" : ""
        }`}
      >
        <Link
          href={
            role === "KASIR" ? "/" : role === "DEVELOPER" ? "/dev" : "/owner"
          }
          className={`flex min-w-0 flex-1 items-center gap-3 ${
            collapsed ? "lg:hidden" : ""
          }`}
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
          onClick={onToggleCollapse}
          aria-label={
            collapsed
              ? "Bentangkan panel navigasi"
              : "Ringkatkan panel navigasi"
          }
          title={
            collapsed
              ? "Bentangkan panel navigasi (Ctrl+B)"
              : "Ringkatkan panel navigasi (Ctrl+B)"
          }
          className="hidden h-8 w-8 shrink-0 place-items-center rounded-lg text-shell-muted transition hover:bg-shell-soft hover:text-shell-ink lg:grid"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
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

      {/* Area menu: satu-satunya bagian yang menggulir bila layar pendek
          (sebelumnya kartu OSCAR + tombol dasar memaksa menu menggulir). */}
      <SidebarNavSection role={role} pathname={pathname} collapsed={collapsed} />

      {/* Menu akun: profil, pengaturan tampilan, ganti tema, keluar
          (menggantikan menu profil topbar yang dihapus v1.1.0). */}
      <SidebarUser user={user} collapsed={collapsed} />
    </aside>
  );
}
