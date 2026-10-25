import { describe, expect, it } from "vitest";

// Unit test untuk kunci penyimpanan tema per pengguna
// (lib/theme-storage.ts) â€” murni, tanpa React/window, hasilnya pasti
// sama di mesin mana pun. Yang dijaga: permintaan pemilik "setiap
// orang punya tema masing-masing yang tersimpan di local machine
// mereka" â€” dua akun berbeda TIDAK boleh berbagi satu kunci
// localStorage, dan halaman tanpa sesi tetap punya kunci generik.

import {
  ANONYMOUS_THEME_KEY,
  isPerUserThemeKey,
  themeKeyForUser,
} from "@/lib/theme-storage";

describe("themeKeyForUser", () => {
  it("membuat kunci unik per id pengguna", () => {
    expect(themeKeyForUser("7")).toBe("theme-7");
    expect(themeKeyForUser("92")).toBe("theme-92");
  });

  it("dua orang berbeda tidak berbagi kunci â€” inti permintaan per-user", () => {
    const owner = themeKeyForUser("1");
    const kasir = themeKeyForUser("2");
    expect(owner).not.toBe(kasir);
  });

  it("id yang sama menghasilkan kunci yang sama (idempoten)", () => {
    expect(themeKeyForUser("15")).toBe(themeKeyForUser("15"));
  });

  it("id kosong jatuh kembali ke kunci anonim, bukan kunci rusak", () => {
    expect(themeKeyForUser("")).toBe(ANONYMOUS_THEME_KEY);
  });

  it("id spasi saja dianggap kosong (tidak menghasilkan 'theme-')", () => {
    expect(themeKeyForUser("   ")).toBe(ANONYMOUS_THEME_KEY);
  });

  it("spasi di kiri-kanan id dipangkas agar kunci konsisten", () => {
    expect(themeKeyForUser(" 42 ")).toBe("theme-42");
  });
});

describe("isPerUserThemeKey", () => {
  it("kunci per-pengguna dianggap per-pengguna", () => {
    expect(isPerUserThemeKey("theme-7")).toBe(true);
  });

  it("kunci generik anonim BUKAN per-pengguna", () => {
    expect(isPerUserThemeKey(ANONYMOUS_THEME_KEY)).toBe(false);
  });

  it("undefined (halaman tanpa sesi, next-themes pakai default) aman", () => {
    expect(isPerUserThemeKey(undefined)).toBe(false);
  });

  it("cermin hanya menyala untuk kunci per-pengguna â€” anonim tak bercermin ke dirinya sendiri", () => {
    // Jika kunci aktif = "theme-<id>", cermin menyala; jika kunci
    // aktif = "theme" (anonim), cermin mati supaya tidak menimpa
    // nilai anonim dengan dirinya sendiri secara sia-sia.
    expect(isPerUserThemeKey(themeKeyForUser("5"))).toBe(true);
    expect(isPerUserThemeKey(themeKeyForUser(""))).toBe(false);
  });
});

describe("kontrak kunci dengan next-themes", () => {
  it("kunci anonim persis default next-themes ('theme')", () => {
    // next-themes memakai "theme" bila storageKey tidak diberikan â€”
    // nilai ini HARUS tetap sama agar halaman /login & /verify
    // (tanpa sesi) dan cermin ThemeProvider bicara bahasa yang sama.
    expect(ANONYMOUS_THEME_KEY).toBe("theme");
  });

  it("kunci per-pengguna selalu diawali nama kunci anonim", () => {
    // "theme-<id>" â€” mudah dibersihkan/di-inspeksi manual lewat
    // DevTools dengan filter awalan yang sama.
    expect(themeKeyForUser("3").startsWith(`${ANONYMOUS_THEME_KEY}-`)).toBe(
      true,
    );
  });
});