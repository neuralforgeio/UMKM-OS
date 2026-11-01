"use client";

// Menu akun di dasar sidebar UMKM OS v1.1.0.
//
// Permintaan pemilik: menu profil di topbar DIHAPUS; orang yang ingin
// mengakses profil, mengganti tema, atau keluar cukup menekan baris
// akun di dasar sidebar (berlaku di semua role). Menu terbuka ke ATAS
// (posisi pemicu memang di dasar layar) dan dirender lewat portal ke
// document.body dengan position:fixed + z-[100] (pola menu profil lama
// v2.2.1) supaya kartu halaman tidak pernah menumpukinya. Menutup saat
// Escape, klik di luar, scroll, atau resize.
//
// Isi menu: Profil Akun (/account), Pengaturan Tampilan (/settings),
// Ganti Tema (saklar nyata next-themes, terang <-> gelap), dan Keluar
// (server action logoutAction yang membuang cookie sesi lalu lompat ke
// /login). Saat sidebar diringkatkan hanya avatar yang tampil pada layar
// lebar; laci ponsel selalu menampilkan nama lengkap.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import {
  ChevronUp,
  LogOut,
  Moon,
  Palette,
  Sun,
  UserRound,
} from "lucide-react";
import { UserAvatar, type UserMenuUser } from "@/components/user-menu";
import { roleLabelOf } from "@/lib/avatar";
import { logoutAction } from "@/lib/logout-action";

// Perkiraan tinggi menu (dipakai menempatkan popover DI ATAS pemicu).
const TINGGI_MENU = 330;

export function SidebarUser({
  user,
  collapsed,
}: {
  user: UserMenuUser;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    setSiap(true);
  }, []);

  const placeMenu = useCallback(() => {
    const btn = rootRef.current?.querySelector("button");
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setMenuPos({
      // Menu dibuka ke ATAS dari pemicu (pemicu ada di dasar sidebar);
      // dibatasi minimal 8px dari tepi atas viewport.
      top: Math.max(8, rect.top - TINGGI_MENU),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 272)),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    placeMenu();
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onViewportChange = () => setOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
    };
  }, [open, placeMenu]);

  const sembunyiText = collapsed ? "lg:hidden" : "";
  const gelap = resolvedTheme === "dark";
  const nama = user.name?.trim() || "Pengguna";
  const surel = user.email ?? "";

  return (
    <div
      ref={rootRef}
      className={`border-t border-shell-line px-3 py-3 ${
        collapsed ? "lg:px-0" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Menu akun: profil, tampilan, tema, keluar"
        className={`flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-shell-soft ${
          collapsed ? "lg:justify-center lg:px-0" : ""
        }`}
      >
        <UserAvatar user={user} className="h-9 w-9 text-xs" />
        <span className={`min-w-0 flex-1 ${sembunyiText}`}>
          <span className="block truncate text-[11px] font-bold leading-tight text-shell-ink">
            {nama}
          </span>
          <span className="mt-0.5 block truncate text-[10px] leading-tight text-shell-muted">
            {roleLabelOf(user.role)}
          </span>
        </span>
        <ChevronUp
          className={`h-4 w-4 shrink-0 text-shell-muted transition-transform ${
            open ? "rotate-180" : ""
          } ${sembunyiText}`}
        />
      </button>

      {/* PORTAL: keluar dari stacking context halaman, menu selalu
          tampil paling depan (pola v2.2.1). */}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Menu akun"
            style={{
              position: "fixed",
              top: `${menuPos.top}px`,
              left: `${menuPos.left}px`,
            }}
            className="z-[100] w-64 overflow-hidden rounded-2xl border border-shell-line bg-shell-card shadow-xl shadow-shell-shadow"
          >
            {/* Kepala menu: identitas + peran, konteks sebelum aksi. */}
            <div className="flex items-center gap-3 border-b border-shell-line px-4 py-3.5">
              <UserAvatar user={user} className="h-10 w-10 text-sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-shell-ink">
                  {nama}
                </p>
                <p className="truncate text-xs text-shell-muted">
                  {surel || roleLabelOf(user.role)}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-shell-primary-strong">
                  {roleLabelOf(user.role)}
                </p>
              </div>
            </div>

            <nav className="p-1.5">
              <Link
                href="/account"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-shell-ink-soft transition hover:bg-shell-soft hover:text-shell-ink"
              >
                <UserRound className="h-4 w-4 text-shell-muted" />
                Profil Akun
              </Link>
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-shell-ink-soft transition hover:bg-shell-soft hover:text-shell-ink"
              >
                <Palette className="h-4 w-4 text-shell-muted" />
                Pengaturan Tampilan
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => setTheme(gelap ? "light" : "dark")}
                title={
                  siap
                    ? gelap
                      ? "Aktifkan tema terang"
                      : "Aktifkan tema gelap"
                    : "Ganti tema tampilan"
                }
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-shell-ink-soft transition hover:bg-shell-soft hover:text-shell-ink"
              >
                {siap && gelap ? (
                  <Sun className="h-4 w-4 text-shell-muted" />
                ) : (
                  <Moon className="h-4 w-4 text-shell-muted" />
                )}
                {siap && gelap ? "Ganti ke Tema Terang" : "Ganti ke Tema Gelap"}
              </button>
            </nav>

            <div className="border-t border-shell-line p-1.5">
              {/* Server action (lib/logout-action): cookie sesi dibuang di
                  server lalu dilempar ke /login, sama dengan tombol Keluar
                  lama di topbar. */}
              <form action={logoutAction}>
                <button
                  type="submit"
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-shell-bad transition hover:bg-shell-bad/10"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar
                </button>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
