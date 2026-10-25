import { describe, expect, it } from "vitest";

// Unit test kebijakan password (lib/password-policy.ts) — modul yang
// diandalkan form akun & reset password. Syarat: minimal 8 karakter,
// ada huruf besar, ada simbol; spasi TIDAK dihitung sebagai simbol.

import {
  PASSWORD_RULES,
  failedPasswordRules,
  isPasswordValid,
} from "@/lib/password-policy";

describe("isPasswordValid", () => {
  it("password yang memenuhi semua syarat lolos", () => {
    expect(isPasswordValid("Sandi#Kuat1")).toBe(true);
    expect(isPasswordValid("Rahasia-Warung")).toBe(true);
  });

  it("terlalu pendek ditolak walau ada huruf besar + simbol", () => {
    expect(isPasswordValid("Sandi#1")).toBe(false); // 7 karakter
  });

  it("tanpa huruf besar ditolak", () => {
    expect(isPasswordValid("sandi#kuat1")).toBe(false);
  });

  it("tanpa simbol ditolak", () => {
    expect(isPasswordValid("SandiKuat123")).toBe(false);
  });

  it("spasi bukan simbol — tidak boleh dianggap kuat", () => {
    // permintaan pemilik: "a b c" tidak boleh lolos sebagai "ada simbol".
    expect(isPasswordValid("Sandi Kuat 123")).toBe(false);
  });

  it("string kosong ditolak", () => {
    expect(isPasswordValid("")).toBe(false);
  });
});

describe("failedPasswordRules", () => {
  it("menyebutkan syarat yang belum terpenuhi (huruf besar, simbol)", () => {
    const gagal = failedPasswordRules("sandikuat1");
    expect(gagal).toHaveLength(2);
    expect(gagal.join("; ")).toMatch(/huruf besar/i);
    expect(gagal.join("; ")).toMatch(/simbol/i);
  });

  it("password kuat tidak menghasilkan daftar gagal", () => {
    expect(failedPasswordRules("Sandi#Kuat1")).toEqual([]);
  });

  it("jumlah aturan tetap tiga — lantai validasi frontend tidak berubah diam-diam", () => {
    expect(PASSWORD_RULES).toHaveLength(3);
  });
});
