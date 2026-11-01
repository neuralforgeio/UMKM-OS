"use client";

// Shell aplikasi UMKM OS v1.1.0, satu komponen untuk semua halaman konsol.
//
// Struktur: sidebar (bisa diringkatkan / minimize, statusnya diingat di
// penyimpanan lokal, kini juga lewat pintasan CTRL+B) + topbar (remah
// roti, judul halaman, jam WIB ringkas, Changelog) + area konten + kaki
// halaman. Semua halaman owner, kasir, dan developer memakai shell ini
// sehingga navigasi, logo warung, dan tema tidak pernah lagi berbeda
// antar halaman.
//
// v1.1.0: topbar tidak lagi menerima pengguna (menu profil pindah ke
// menu akun di dasar sidebar); pintasan Ctrl+B memindahkan panel
// navigasi tanpa mouse, kebiasaan aplikasi desktop modern. Browser
// tidak memakai Ctrl+B di dalam formulir sehingga pintasan aman tetap
// aktif saat pengguna sedang mengetik.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { UserMenuUser } from "@/components/user-menu";
import {
  SIDEBAR_STORAGE_KEY,
  sidebarCollapsedFromStorage,
  sidebarCollapsedToStorage,
  type ShellRole,
} from "@/lib/shell-nav";
import { log } from "@/lib/ui/log";
import { AppSidebar } from "./app-sidebar";
import { Topbar } from "./topbar";
import { AppFooter } from "./app-footer";

export type AppShellOutlet = {
  name: string;
  logoUrl: string | null;
  address?: string | null;
};

export function AppShell({
  role,
  user,
  outlet,
  crumb,
  title,
  subtitle,
  defaultCollapsed = false,
  children,
}: {
  role: ShellRole;
  user: UserMenuUser;
  outlet: AppShellOutlet;
  crumb: string;
  title: string;
  subtitle?: string;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/";
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Status diringkatkan dibaca SETELAH pasang supaya markup awal server
  // dan klien identik (tidak ada ketidakcocokan hidrasi).
  useEffect(() => {
    try {
      const simpan = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (simpan !== null) {
        setCollapsed(sidebarCollapsedFromStorage(simpan));
      }
    } catch {
      // Penyimpanan lokal diblokir, sidebar tetap memakai bawaan.
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function ubahRingkas(nomor: boolean) {
    setCollapsed(nomor);
    try {
      window.localStorage.setItem(
        SIDEBAR_STORAGE_KEY,
        sidebarCollapsedToStorage(nomor));
    } catch {
      // Gagal menyimpan preferensi, bukan hal fatal bagi navigasi.
    }
    log.debug("shell", nomor ? "sidebar diringkatkan" : "sidebar dibentangkan");
  }

  // Pintasan Ctrl+B (tanpa Alt/Meta) memindahkan panel navigasi; juga
  // berlaku saat fokus di kolom teks karena Ctrl+B tidak dipakai browser
  // untuk memformat teks di dalam input maupun textarea.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === "b" || e.key === "B")
      ) {
        e.preventDefault();
        ubahRingkas(!collapsed);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [collapsed]);

  return (
    <div className="flex min-h-dvh bg-shell">
      <AppSidebar
        role={role}
        user={user}
        outlet={outlet}
        pathname={pathname}
        collapsed={collapsed}
        onToggleCollapse={() => ubahRingkas(!collapsed)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {mobileOpen && (
        <button
          type="button"
          aria-label="Tutup menu navigasi"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          crumb={crumb}
          title={title}
          subtitle={subtitle}
          onOpenMobileMenu={() => setMobileOpen(true)}
        />
        <main className="relative z-0 mx-auto w-full max-w-[1680px] flex-1 px-4 pb-6 pt-6 sm:px-6 lg:px-8">
          {children}
          <AppFooter outletName={outlet.name} />
        </main>
      </div>
    </div>
  );
}
