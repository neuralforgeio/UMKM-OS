"use client";

// Tombol Changelog di topbar shell UMKM OS v1.1.0.
//
// Permintaan pemilik: topbar tidak lagi memuat menu profil (pindah ke
// menu akun di sidebar), diganti fitur yang lebih berguna, salah
// satunya riwayat perubahan produk. Daftar versi datang dari
// lib/changelog.ts (murni data, teruji vitest); popover dirender lewat
// portal ke document.body dengan position:fixed (pola yang sama dengan
// menu profil lama) supaya kartu halaman tidak pernah menumpukinya.
// Menutup saat Escape, klik di luar, scroll, atau resize.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { History } from "lucide-react";
import {
  CHANGELOG,
  formatTanggalId,
  versiTerbaru,
} from "@/lib/changelog";

export function Changelog() {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const placeMenu = useCallback(() => {
    const btn = rootRef.current?.querySelector("button");
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setMenuPos({
      top: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 120)),
      right: Math.max(8, window.innerWidth - rect.right),
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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Riwayat perubahan UMKM OS"
        className="flex h-9 items-center gap-2 rounded-xl border border-shell-line bg-shell-card px-2.5 text-shell-ink-soft transition hover:border-shell-line-strong hover:text-shell-ink sm:px-3"
      >
        <History className="h-4 w-4 shrink-0" />
        <span className="hidden text-[11px] font-bold tracking-tight sm:inline">
          Changelog
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Riwayat perubahan"
            style={{
              position: "fixed",
              top: `${menuPos.top}px`,
              right: `${menuPos.right}px`,
            }}
            className="z-[100] max-h-[min(26rem,70vh)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-shell-line bg-shell-card shadow-xl shadow-shell-shadow"
          >
            <div className="sticky top-0 z-10 border-b border-shell-line bg-shell-card px-4 py-3.5">
              <p className="text-xs font-bold text-shell-ink">
                Riwayat Perubahan
              </p>
              <p className="mt-0.5 text-[10px] text-shell-muted">
                Versi terbaru: {versiTerbaru()}
              </p>
            </div>
            <ol className="grid gap-0 px-2 pb-2 pt-2">
              {CHANGELOG.map((entri) => (
                <li
                  key={entri.versi}
                  className="border-b border-shell-line px-2 py-3 last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-shell-primary/12 px-2 py-0.5 text-[10px] font-bold text-shell-primary-strong">
                      v{entri.versi}
                    </span>
                    <span className="text-[10px] text-shell-muted">
                      {formatTanggalId(entri.tanggal)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] font-bold leading-tight text-shell-ink">
                    {entri.judul}
                  </p>
                  <ul className="mt-1.5 grid gap-1.5">
                    {entri.butir.map((b, i) => (
                      <li
                        key={i}
                        className="flex gap-2 text-[11px] leading-relaxed text-shell-ink-soft"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-shell-primary/70"
                        />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>,
          document.body,
        )}
    </div>
  );
}
