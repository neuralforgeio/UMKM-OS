// Navigasi halaman /settings (v1.6.0) — murni, tanpa React, supaya bisa
// diuji unit (tests/settings-nav.test.ts) tanpa menyalakan server Next.

export type SettingsRole = "DEVELOPER" | "OWNER" | "KASIR" | null | undefined;

// Halaman "rumah" tiap peran. Dipakai tombol "Kembali" di /settings:
// pengguna yang sudah login pulang ke areanya masing-masing (kasir ke
// POS, owner ke konsol, developer ke konsol dev), sedangkan pengunjung
// yang belum login kembali ke halaman login — bukan lagi selalu /login.
export function settingsBackHref(role: SettingsRole): string {
  switch (role) {
    case "DEVELOPER":
      return "/dev";
    case "OWNER":
      return "/owner";
    case "KASIR":
      return "/cashier";
    default:
      return "/login";
  }
}

// Label tombol kembali mengikuti tujuannya — "Kembali ke Kasir" lebih
// jelas daripada "Kembali" polos saat pengguna lupa dari mana datang.
export function settingsBackLabel(role: SettingsRole): string {
  switch (role) {
    case "DEVELOPER":
      return "Kembali ke Konsol Developer";
    case "OWNER":
      return "Kembali ke Konsol Owner";
    case "KASIR":
      return "Kembali ke Kasir";
    default:
      return "Kembali masuk";
  }
}