// Penjaga konsistensi tema (v1.9.0) — mengunci hasil "semua halaman
// temanya sama": setiap shell halaman wajib memakai AuroraBackground,
// komponen inti wajib memakai kartu/input kaca (glass-card/glass-input),
// dan latar aurora wajib sembunyi saat mencetak struk. Bila ada halaman
// baru yang lupa ikut design language, test ini menyala sebelum user
// sempat melihatnya "beda tema".
// Standar: Bahasa Indonesia, stdlib Node saja, tanpa DB, tanpa jaringan.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");

const baca = (rel: string) => readFileSync(join(ROOT_FRONTEND, rel), "utf-8");

// Seluruh shell halaman (audit v1.8.0 + receipt v1.9.0).
const SHELL_HALAMAN = [
  "app/page.tsx",
  "app/login/login-client.tsx",
  "app/account/page.tsx",
  "app/cashier/pos-client.tsx",
  "app/cashier/receipt-view.tsx",
  "app/owner/page.tsx",
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

describe("konsistensi tema aurora — semua halaman satu bahasa desain", () => {
  it("setiap shell halaman merender AuroraBackground", () => {
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

  it("latar aurora tidak ikut tercetak (print:hidden)", () => {
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
