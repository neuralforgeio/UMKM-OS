// Penjaga font self-host v1.1.0 fix2 — akar kegagalan Gerbang D run-1.
//
// Docker build pengguna pada run-1 gagal karena next/font/google
// mengunduh berkas font dari fonts.gstatic.com saat build, sementara
// jaringan container tidak dapat menjangkau domain tersebut (CSS dari
// fonts.googleapis.com berhasil diambil, berkas woff2 tidak), sehingga
// Turbopack gagal dengan error modul font internal yang membingungkan.
// Sejak fix2 seluruh font dibundel di app/fonts dan dimuat lewat
// next/font/local: build produksi tidak lagi memerlukan jaringan
// eksternal sama sekali. Berikut mengunci itu supaya tidak ada regresi
// diam-diam kembali ke next/font/google. Standar: Bahasa Indonesia,
// stdlib Node saja, tanpa DOM.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { CHANGELOG } from "@/lib/changelog";

const akar = fileURLToPath(new URL("..", import.meta.url));

const NAMA_FONT = {
  geist: "Geist-Variable.woff2",
  mono: "GeistMono-Variable.woff2",
  jakarta: "PlusJakartaSans-Variable.woff2",
} as const;

const folderFont = path.join(akar, "app", "fonts");

function daftarBerkasTs(folder: string): string[] {
  const hasil: string[] = [];
  const tumpukan = [folder];
  while (tumpukan.length > 0) {
    const dir = tumpukan.pop() as string;
    for (const nama of readdirSync(dir)) {
      const penuh = path.join(dir, nama);
      if (statSync(penuh).isDirectory()) {
        tumpukan.push(penuh);
      } else if (/\.tsx?$/.test(nama)) {
        hasil.push(penuh);
      }
    }
  }
  return hasil;
}

describe("layout akar memakai font lokal, bukan next/font/google", () => {
  it("layout.tsx memuat next/font/local dan tidak lagi next/font/google", () => {
    const layout = readFileSync(path.join(akar, "app", "layout.tsx"), "utf8");
    expect(layout).not.toContain("next/font/google");
    expect(layout).toContain("next/font/local");
  });

  it("tidak ada satu pun berkas sumber app/components/lib yang memakai next/font/google", () => {
    for (const folder of ["app", "components", "lib"]) {
      const berkas2 = daftarBerkasTs(path.join(akar, folder));
      expect(berkas2.length).toBeGreaterThan(10);
      for (const berkas of berkas2) {
        const isi = readFileSync(berkas, "utf8");
        expect(isi, `${berkas} memakai next/font/google`).not.toContain(
          "next/font/google",
        );
      }
    }
  });

  it("layout merujuk tiga berkas font lokal dengan rentang bobot variable yang benar", () => {
    const layout = readFileSync(path.join(akar, "app", "layout.tsx"), "utf8");
    expect(layout).toContain(`./fonts/${NAMA_FONT.geist}`);
    expect(layout).toContain(`./fonts/${NAMA_FONT.mono}`);
    expect(layout).toContain(`./fonts/${NAMA_FONT.jakarta}`);
    // Geist & Geist Mono variable 100-900; Plus Jakarta Sans 200-800.
    expect(layout.match(/weight: "100 900"/g)?.length).toBe(2);
    expect(layout).toContain('weight: "200 800"');
  });
});

describe("berkas font woff2 dibundel utuh di app/fonts", () => {
  it("ketiga berkas woff2 ada", () => {
    for (const nama of Object.values(NAMA_FONT)) {
      expect(existsSync(path.join(folderFont, nama)), nama).toBe(true);
    }
  });

  it("ketiga berkas berformat woff2 sah (magic wOF2) dan berukuran wajar", () => {
    for (const nama of Object.values(NAMA_FONT)) {
      const isi = readFileSync(path.join(folderFont, nama));
      expect(isi.subarray(0, 4).toString("latin1")).toBe("wOF2");
      // Berkas variable subset latin resmi: belasan-puluhan ribu byte.
      expect(isi.length).toBeGreaterThan(10000);
      expect(isi.length).toBeLessThan(200000);
    }
  });
});

describe("kontrak variabel CSS font tetap utuh lintas perubahan", () => {
  it("globals.css tetap memakai --font-jakarta dan --font-geist-*", () => {
    const css = readFileSync(path.join(akar, "app", "globals.css"), "utf8");
    expect(css).toContain("var(--font-jakarta)");
    expect(css).toContain("var(--font-geist-sans)");
    expect(css).toContain("var(--font-geist-mono)");
  });

  it("changelog 1.1.0 mencatat perbaikan font self-host", () => {
    const entri = CHANGELOG.find((e) => e.versi === "1.1.0");
    expect(entri).toBeDefined();
    expect(entri!.butir.join(" ")).toContain("self-host");
  });
});
