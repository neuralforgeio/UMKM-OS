"use client";

// Chip profil di kanan navbar SEMUA halaman (v2.2.0).
//
// Permintaan pemilik: navbar tiap halaman memperkenalkan pengguna —
// avatar, nama lengkap, email — dan sekali klik membuka menu kecil di
// bawahnya: Profil (halaman /account) atau Keluar. Tombol ganti tema
// yang dulu menempel di sini DIHAPUS: tema hanya diatur di halaman
// /settings (link pintasnya ada di menu ini).
//
// Data masuk sebagai prop biasa dari server component pemanggil
// (lihat lib/session-user.ts) — token sesi tidak pernah melintas ke
// komponen client ini.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  LogOut,
  Palette,
  UserRound,
} from "lucide-react";
import {
  avatarGradientFor,
  initialsOf,
  roleLabelOf,
  userPhotoUrl,
} from "@/lib/avatar";
import { logoutAction } from "@/lib/logout-action";

export type UserMenuUser = {
  name: string | null;
  email: string | null;
  role: "OWNER" | "KASIR" | "DEVELOPER" | null;
  photoVersion: number;
};

/** Lingkaran avatar — foto unggahan bila ada, inisial di gradasi peran
 * bila belum. Ukuran diatur lewat className agar bisa dipakai navbar
 * (kecil) maupun halaman profil (besar). */
export function UserAvatar({
  user,
  className = "h-9 w-9 text-xs",
}: {
  user: UserMenuUser;
  className?: string;
}) {
  const [photoBroken, setPhotoBroken] = useState(false);
  const photoUrl = userPhotoUrl(user.photoVersion);

  if (photoUrl && !photoBroken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={`Foto ${user.name ?? "pengguna"}`}
        className={`${className} shrink-0 rounded-full object-cover ring-2 ring-white/70 dark:ring-slate-900/70`}
        // Foto dihapus tepat setelah navbar dirender? Jatuh ke inisial
        // tanpa merusak layout (bukan ikon gambar pecah).
        onError={() => setPhotoBroken(true)}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-tr ${avatarGradientFor(
        user.role,
      )} font-bold text-white shadow-sm`}
    >
      {initialsOf(user.name)}
    </div>
  );
}

export function UserMenu({
  user,
  className = "",
}: {
  user: UserMenuUser;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Tutup dropdown saat klik di luar chip/menu (listener passive pada
  // document — pasangan click-toggle di dalam komponen).
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const name = user.name?.trim() || "Pengguna";
  const email = user.email ?? "";

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Profil & sesi"
        className="flex max-w-[16rem] items-center gap-2.5 rounded-full border border-slate-200 bg-white/80 py-1 pl-1 pr-2.5 text-left backdrop-blur transition hover:border-blue-300 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-blue-700 sm:max-w-[20rem]"
      >
        <UserAvatar user={user} />
        <span className="hidden min-w-0 flex-col leading-tight sm:flex">
          <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {name}
          </span>
          <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            {email}
          </span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900"
        >
          {/* Kepala menu: identitas + peran — konteks sebelum aksi. */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
            <UserAvatar user={user} className="h-10 w-10 text-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                {name}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {email || roleLabelOf(user.role)}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                {roleLabelOf(user.role)}
              </p>
            </div>
          </div>

          <nav className="p-1.5">
            <Link
              href="/account"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <UserRound className="h-4 w-4 text-slate-400" />
              Profil Saya
            </Link>
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <Palette className="h-4 w-4 text-slate-400" />
              Pengaturan Tampilan
            </Link>
          </nav>

          <div className="border-t border-slate-100 p-1.5 dark:border-slate-800">
            {/* Server action (lib/logout-action) — cookie sesi dibuang di
                server lalu dilempar ke /login, sama dengan tombol Keluar
                lama, kini jadi satu pintu di semua halaman. */}
            <form action={logoutAction}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
              >
                <LogOut className="h-4 w-4" />
                Keluar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
