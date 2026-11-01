"use client";

// Saklar tema di topbar shell UMKM OS v1.0.0.
//
// Mengganti tema langsung (terang <-> gelap) memakai next-themes dengan
// kunci penyimpanan per pengguna yang sudah diatur ThemeProvider di
// layout akar. Ia hanya dirender setelah komponen terpasang supaya tema
// aktif tidak pernah membuat markup awal server dan klien berbeda.

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    setSiap(true);
  }, []);

  const gelap = resolvedTheme === "dark";
  const label = siap
    ? gelap
      ? "Aktifkan tema terang"
      : "Aktifkan tema gelap"
    : "Ganti tema tampilan";

  return (
    <button
      type="button"
      onClick={() => setTheme(gelap ? "light" : "dark")}
      aria-label={label}
      title={label}
      className="grid h-9 w-9 place-items-center rounded-xl border border-shell-line bg-shell-card text-shell-ink-soft transition hover:border-shell-line-strong hover:text-shell-ink"
    >
      {siap ? (
        gelap ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )
      ) : (
        <span aria-hidden="true" className="h-4 w-4" />
      )}
    </button>
  );
}
