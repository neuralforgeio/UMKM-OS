"use client";

// ThemeProvider tingkat akar (v1.7.0): tema kini PER PENGGUNA.
// app/layout.tsx (server component) membaca sesi lewat auth(), lalu
// meneruskan storageKey "theme-<idUser>" ke sini. next-themes lalu
// membaca/menulis localStorage dengan kunci itu â€” dua orang yang
// berbagi satu browser tetap membawa tema masing-masing.
//
// Halaman TANPA sesi (/login, /verify/[code]) tetap memakai kunci
// generik "theme". Supaya pengalaman tidak "melomcat" (gelap di
// konsol, tiba-tiba terang di halaman masuk), komponen cermin di
// bawah menyalin pilihan tema aktif ke kunci generik setiap kali
// tema diganti saat sedang login.
import { useEffect, useRef } from "react";
import {
  ThemeProvider as NextThemesProvider,
  useTheme,
} from "next-themes";
import {
  ANONYMOUS_THEME_KEY,
  isPerUserThemeKey,
} from "@/lib/theme-storage";

/**
 * Menyalin pilihan tema (bukan hasil resolusinya â€” "system" tetap
 * "system") ke kunci anonim selama kunci aktif adalah kunci
 * per-pengguna. Halaman publik /login & /verify membaca kunci itu,
 * jadi mesin menampilkan tema yang terakhir DIPILIH orang yang
 * memakainya â€” bukan kembali ke tema sistem begitu keluar sesi.
 *
 * Hanya perubahan SESUDAH mount yang dicerminkan: efek ini sengaja
 * melewati nilai awal (useRef penanda), supaya sekadar membuka
 * halaman sebagai pengguna baru (temanya masih default "system")
 * TIDAK menimpa pilihan anonim yang sudah tersimpan di mesin itu.
 */
function AnonymousThemeMirror({ enabled }: { enabled: boolean }) {
  const { theme } = useTheme();
  const lewatiNilaiAwal = useRef(true);
  useEffect(() => {
    if (!enabled || typeof theme !== "string") return;
    if (lewatiNilaiAwal.current) {
      lewatiNilaiAwal.current = false;
      return;
    }
    try {
      window.localStorage.setItem(ANONYMOUS_THEME_KEY, theme);
    } catch {
      // Penyimpanan pribat browser penuh/diblokir â€” cermin gagal
      // bukan masalah fatal; tema per-pengguna tetap tersimpan.
    }
  }, [theme, enabled]);
  return null;
}

export function ThemeProvider({
  children,
  storageKey,
}: {
  children: React.ReactNode;
  /** Undefined = kunci generik "theme" (halaman tanpa sesi). */
  storageKey?: string;
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey={storageKey}
    >
      <AnonymousThemeMirror enabled={isPerUserThemeKey(storageKey)} />
      {children}
    </NextThemesProvider>
  );
}