// Test kartu kategori kasir (v1.8.0) â€” memastikan chip kategori
// bersifat DUAL-THEME: setiap chip terang wajib membawa padanan gelap
// (dark:bg-... dan dark:text-...), sehingga halaman kasir ikut tema
// pengguna seperti halaman owner dan dev.
// Standar: Bahasa Indonesia, tanpa DB, tanpa jaringan, murni fungsi murni.
import { describe, expect, it } from "vitest";
import {
  categoryAvatarClass,
  categoryChipClass,
  initialsOf,
} from "../app/cashier/ui";

const KATEGORI_KNOWN = [
  "Minuman",
  "Makanan",
  "Sembako",
  "Snack",
  "Perawatan",
];

describe("categoryChipClass â€” chip dual-theme", () => {
  it("setiap kategori bawaan punya warna terang DAN padanan gelap", () => {
    for (const nama of KATEGORI_KNOWN) {
      const chip = categoryChipClass(nama);
      // sisi terang: latar 100 + teks 700 (mis. bg-amber-100 text-amber-700)
      expect(chip).toMatch(/^bg-\w+-100\s/);
      expect(chip).toMatch(/\stext-\w+-700\s/);
      // sisi gelap (v1.8.0): wajib ada padawannya, bukan terang saja
      expect(chip).toMatch(/dark:bg-\w+-500\/15\b/);
      expect(chip).toMatch(/dark:text-\w+-300\b/);
    }
  });

  it("kategori tak dikenal jatuh ke fallback dual-theme", () => {
    const chip = categoryChipClass("Kategori Aneh");
    expect(chip).toContain("bg-slate-100");
    expect(chip).toContain("dark:bg-slate-900");
    expect(chip).toContain("text-slate-600");
    expect(chip).toContain("dark:text-slate-400");
  });

  it("null dan string kosong juga jatuh ke fallback, bukan melempar", () => {
    expect(categoryChipClass(null)).toBe(categoryChipClass("Apapun"));
    expect(categoryChipClass("")).toBe(categoryChipClass("Apapun"));
  });
});

describe("categoryAvatarClass â€” avatar kategori", () => {
  it("kategori dikenal memakai warna avatar solid (aman dua tema)", () => {
    for (const nama of KATEGORI_KNOWN) {
      const avatar = categoryAvatarClass(nama);
      expect(avatar).toMatch(/^bg-\w+-500$|^bg-\w+-600$/);
      // avatar solid TIDAK boleh membawa varian gelap â€” warnanya memang
      // dipakai di kedua tema (kontras dijamin oleh teks putih di atasnya).
      expect(avatar).not.toContain("dark:");
    }
  });

  it("kategori tak dikenal memakai fallback abu-abu", () => {
    expect(categoryAvatarClass("Tidak Ada")).toBe("bg-slate-400");
    expect(categoryAvatarClass(null)).toBe("bg-slate-400");
  });
});

describe("initialsOf â€” inisial dua huruf untuk avatar keranjang", () => {
  it("dua kata pertama diambil KARAKTER awalnya, kapital", () => {
    // Perilaku riil lama: karakter pertama tiap kata â€” "600ml" menyumbang
    // "6" (komentar lama di ui.tsx menulis "AQ", tapi kode selalu "A6";
    // test mengunci perilaku riil agar tidak berubah tanpa sengaja).
    expect(initialsOf("Aqua 600ml")).toBe("A6");
    expect(initialsOf("beras merah premium")).toBe("BM");
    expect(initialsOf("Indomie Goreng")).toBe("IG");
  });

  it("satu kata hanya menghasilkan satu huruf", () => {
    expect(initialsOf("Gula")).toBe("G");
  });

  it("string kosong / spasi saja menghasilkan tanda tanya, bukan crash", () => {
    expect(initialsOf("")).toBe("?");
    expect(initialsOf("   ")).toBe("?");
  });
});