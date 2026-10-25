// Penjaga encoding (v1.9.0) — akar masalah "teks aneh" yang pemilik lihat
// setelah delivery v1.8.0: script .ps1 ditulis UTF-8 tanpa BOM, dibaca
// PowerShell 5.1 sebagai Windows-1252, lalu karakter asli (em dash, titik
// tengah, ellipsis, centang, tanda kali) rusak menjadi rangkaian Latin
// aneh sebelum ditulis ke file.
// Test ini memindai BYTE file source: bila satu saja pola rusak itu
// kembali masuk, suite langsung gagal dengan nama file & polanya.
// Standar: Bahasa Indonesia, stdlib Node saja, tanpa DB, tanpa jaringan.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR_PINDAI = ["app", "components", "lib", "tests"];
const EKSTENSI = [".ts", ".tsx", ".css"];

// Pola byte = UTF-8 dari STRING mojibake (bukan karakter aslinya):
// mojibake em-dash tersimpan sebagai byte C3 A2 E2 82 AC E2 80 9D.
const POLA_MOJIBAKE: { nama: string; byte: number[] }[] = [
  { nama: "em dash —", byte: [0xc3, 0xa2, 0xe2, 0x82, 0xac, 0xe2, 0x80, 0x9d] },
  { nama: "en dash –", byte: [0xc3, 0xa2, 0xe2, 0x82, 0xac, 0xe2, 0x80, 0x9c] },
  { nama: "ellipsis …", byte: [0xc3, 0xa2, 0xe2, 0x82, 0xac, 0xc2, 0xa6] },
  { nama: "bullet •", byte: [0xc3, 0xa2, 0xe2, 0x82, 0xac, 0xc2, 0xa2] },
  { nama: "titik tengah ·", byte: [0xc3, 0x82, 0xc2, 0xb7] },
  { nama: "tanda kali ×", byte: [0xc3, 0x83, 0xe2, 0x80, 0x94] },
  { nama: "plus-minus ±", byte: [0xc3, 0x82, 0xc2, 0xb1] },
  { nama: "centang tebal ✔", byte: [0xc3, 0xa2, 0xc5, 0x93, 0xe2, 0x80, 0x9d] },
  { nama: "centang ringan ✓", byte: [0xc3, 0xa2, 0xc5, 0x93, 0xe2, 0x80, 0x9c] },
  { nama: "panah kanan →", byte: [0xc3, 0xa2, 0xe2, 0x80, 0xa0, 0xe2, 0x80, 0x99] },
  { nama: "panah kiri ←", byte: [0xc3, 0xa2, 0xe2, 0x80, 0xa0, 0xc2, 0x90] },
  { nama: "minus −", byte: [0xc3, 0xa2, 0xcc, 0x86, 0xe2, 0x80, 0x99] },
];

function daftarFile(dir: string): string[] {
  const hasil: string[] = [];
  for (const nama of readdirSync(dir)) {
    const path = join(dir, nama);
    if (statSync(path).isDirectory()) {
      hasil.push(...daftarFile(path));
    } else if (EKSTENSI.some((e) => nama.endsWith(e))) {
      hasil.push(path);
    }
  }
  return hasil;
}

function semuaFileSource(): string[] {
  return DIR_PINDAI.flatMap((d) => {
    const dir = join(ROOT_FRONTEND, d);
    return statSync(dir).isDirectory() ? daftarFile(dir) : [];
  });
}

describe("penjaga encoding — anti mojibake di source frontend", () => {
  it("tidak ada satu pun pola mojibake UTF-8/CP1252 yang tersisa", () => {
    const pelanggar: string[] = [];
    for (const path of semuaFileSource()) {
      const isi = readFileSync(path);
      for (const { nama, byte } of POLA_MOJIBAKE) {
        if (isi.indexOf(Buffer.from(byte)) !== -1) {
          pelanggar.push(`${path} mengandung mojibake ${nama}`);
        }
      }
    }
    expect(pelanggar).toEqual([]);
  });

  it("karakter asli yang pernah rusak kini hadir dengan benar", () => {
    // Sampel dari file yang dibersihkan v1.9.0: kalau pola benar hilang,
    // karakter aslinya harus ada di tempat yang sama.
    const keranjang = readFileSync(
      join(ROOT_FRONTEND, "app/cashier/cart-panel.tsx"),
      "utf-8",
    );
    expect(keranjang).toContain("·"); // "Keranjang · N item"
    const struk = readFileSync(
      join(ROOT_FRONTEND, "app/cashier/receipt-view.tsx"),
      "utf-8",
    );
    expect(struk).toContain("—"); // komentar panah/sejarah v1.3.0
    const versi = readFileSync(join(ROOT_FRONTEND, "VERSIONS.csv"), "utf-8");
    expect(versi).toContain("—"); // catatan CSV v1.9.0
  });
});
