// Penjaga konsistensi tema (v1.9.0 → v3.1.0) — mengunci hasil "semua
// halaman temanya sama" kini untuk BAHASA DESAIN BARU "Indigo & Quiet
// Surfaces" (arahan desain atasan, Visual direction 02):
//   1. Setiap shell halaman tetap memakai komponen latar bersama
//      (AuroraBackground) — kini latar datar tenang, bukan aurora.
//   2. Komponen inti tetap memakai kartu/input dasar (glass-card /
//      glass-input) — kini permukaan solid + garis tepi, BUKAN kaca.
//   3. Token desain PDF wajib utuh di globals.css: Indigo #6658E8,
//      Midnight #171925, Cloud #F5F6FA, Amber #D9932E, Success #258C68,
//      radius kartu 12px, dan mode gelap yang DIRANCANG (#10121C).
//   4. Sisa-sisa "AI slop" v1.3.0 tidak boleh kembali: tanpa blur kaca,
//      tanpa animasi aurora/wave/float, login tanpa gradien dekoratif.
//   5. Latar tidak ikut tercetak (print:hidden) dan kertas struk tetap
//      putih di kedua tema (invariant cetak sejak v1.9.0).
// Standar: Bahasa Indonesia, stdlib Node saja, tanpa DB, tanpa jaringan.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");

const baca = (rel: string) => readFileSync(join(ROOT_FRONTEND, rel), "utf-8");
const bacaKecil = (rel: string) => baca(rel).toLowerCase();

// Seluruh shell halaman (audit v1.8.0 + receipt v1.9.0).
const SHELL_HALAMAN = [
  "app/page.tsx",
  "app/login/login-client.tsx",
  "app/account/page.tsx",
  "app/cashier/pos-client.tsx",
  "app/cashier/receipt-view.tsx",
  "app/owner/page.tsx",
  "app/owner/assistant/page.tsx",
  "app/owner/products/products-client.tsx",
  "app/owner/stock/page.tsx",
  "app/owner/transactions/transactions-client.tsx",
  "app/owner/settings/page.tsx",
  "app/owner/verify/page.tsx",
  "app/owner/verify/[id]/page.tsx",
  "app/dev/page.tsx",
  "app/dev/users/users-client.tsx",
  "app/dev/logs/page.tsx",
  "app/dev/outlets/[id]/page.tsx",
  "app/settings/appearance-client.tsx",
  "app/verify/[code]/page.tsx",
];

describe("konsistensi tema v3.1.0 — semua halaman satu bahasa desain", () => {
  it("setiap shell halaman merender latar bersama (AuroraBackground)", () => {
    const lupa = SHELL_HALAMAN.filter((rel) => {
      const isi = baca(rel);
      return !isi.includes("AuroraBackground");
    });
    expect(lupa).toEqual([]);
  });

  it("panel & input inti memakai glass-card / glass-input", () => {
    const wajibGlass: { file: string; kelas: string }[] = [
      { file: "app/cashier/product-grid.tsx", kelas: "glass-card" },
      { file: "app/cashier/product-grid.tsx", kelas: "glass-input" },
      { file: "app/cashier/receipt-view.tsx", kelas: "glass-card" },
      { file: "app/cashier/ui.tsx", kelas: "glass-input" },
      { file: "app/owner/settings/settings-forms.tsx", kelas: "glass-input" },
      { file: "components/password-input.tsx", kelas: "glass-input" },
    ];
    const lupa = wajibGlass.filter(
      ({ file, kelas }) => !baca(file).includes(kelas),
    );
    expect(lupa).toEqual([]);
  });

  it("latar tidak ikut tercetak (print:hidden)", () => {
    expect(baca("components/aurora-background.tsx")).toContain(
      "print:hidden",
    );
  });

  it("kertas struk TETAP PUTIH di kedua tema (invariant cetak)", () => {
    const isi = baca("app/cashier/receipt-view.tsx");
    const blok = isi.split('id="struk-paper"')[1] ?? "";
    const kelas = blok.slice(0, blok.indexOf(">"));
    expect(kelas).toContain("bg-white");
    // tidak boleh ada latar gelap di kertas: dark:bg- apapun dilarang
    expect(kelas.includes("dark:bg-")).toBe(false);
  });
});

describe("design system v3.1.0 — token arahan desain utuh", () => {
  it("lima warna kunci PDF hadir di globals.css", () => {
    const css = bacaKecil("app/globals.css");
    expect(css).toContain("#6658e8"); // Indigo — aksi utama
    expect(css).toContain("#171925"); // Midnight — teks utama
    expect(css).toContain("#f5f6fa"); // Cloud — latar aplikasi
    expect(css).toContain("#d9932e"); // Amber — perhatian
    expect(css).toContain("#258c68"); // Success — semantik saja
  });

  it("radius kartu 12 px sesuai aturan komponen PDF", () => {
    const css = baca("app/globals.css");
    expect(css).toContain("--radius-xl: 12px");
    expect(css).toContain("--radius-2xl: 12px");
  });

  it("mode gelap DIRANCANG, bukan sekadar kebalikan (latar #10121c)", () => {
    const css = baca("app/globals.css");
    expect(css).toContain(".dark");
    expect(css).toContain("--background: #10121c");
  });
});

describe("bebas 'AI slop' v1.3.0 — dekorasi lama tidak boleh kembali", () => {
  it("globals.css tanpa blur kaca (backdrop-filter hanya dimatikan)", () => {
    const css = baca("app/globals.css");
    expect(css).not.toContain("backdrop-filter: blur");
  });

  it("latar halaman tenang: tanpa animasi & tanpa gradien", () => {
    const isi = baca("components/aurora-background.tsx");
    expect(isi).not.toContain("animate-");
    expect(isi).not.toContain("aurora-1");
    expect(isi).not.toContain("bg-gradient");
  });

  it("login tanpa gradien dekoratif / gelombang / kartu mengambang", () => {
    const isi = baca("app/login/login-client.tsx");
    expect(isi).not.toContain("bg-gradient-to");
    expect(isi).not.toContain("animate-wave");
    expect(isi).not.toContain("animate-float");
    expect(isi).not.toContain("LuSparkles");
  });
});
