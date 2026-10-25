// Kunci penyimpanan tema (next-themes) â€” PER PENGGUNA, bukan per mesin.
// Permintaan pemilik: "setiap orang punya tema masing-masing yang
// tersimpan di local machine mereka". localStorage memang sudah
// terisolasi per browser/perangkat, tapi bila dua orang berbagi satu
// browser (mis. owner dan kasir di komputer kasir yang sama), kunci
// generik "theme" akan saling menimpa. Dengan kunci "theme-<idUser>",
// tiap akun membawa temanya sendiri di mesin itu.
//
// Modul ini sengaja MURNI (tanpa React, tanpa window) supaya bisa
// diuji unit test tanpa DOM â€” komponen client yang memakai nilainya
// lewat props dari server (app/layout.tsx membaca auth()).

/** Kunci yang dipakai next-themes bila storageKey tidak diberikan. */
export const ANONYMOUS_THEME_KEY = "theme";

/**
 * Kunci tema milik satu pengguna.
 * Id kosong / spasi saja dianggap anonim supaya tidak pernah
 * menghasilkan kunci rusak seperti "theme-".
 */
export function themeKeyForUser(userId: string): string {
  const bersih = userId.trim();
  return bersih.length > 0 ? `theme-${bersih}` : ANONYMOUS_THEME_KEY;
}

/**
 * Apakah kunci aktif adalah kunci per-pengguna?
 * Dipakai ThemeProvider untuk memutuskan perlu tidaknya "cermin"
 * ke kunci anonim â€” lihat components/theme-provider.tsx.
 */
export function isPerUserThemeKey(storageKey: string | undefined): boolean {
  return typeof storageKey === "string" && storageKey !== ANONYMOUS_THEME_KEY;
}