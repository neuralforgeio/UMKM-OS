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

// Seluruh shell halaman (audit v1.8.0 + receipt v1.9.0). Sejak v3.2.0
// halaman yang memakai WorkspaceShell mewariskan latar & profil ke
// shell bersama itu — cukup salah satu dari keduanya hadir di file.
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

// Halaman yang sejak v3.2.0 dibungkus WorkspaceShell (sidebar
// WORKSPACE/MANAGE pola PDF) — latar & UserMenu datang dari shell.
const SHELL_WORKSPACE = [
  "app/owner/page.tsx",
  "app/owner/assistant/page.tsx",
  "app/owner/products/products-client.tsx",
  "app/owner/stock/page.tsx",
  "app/owner/transactions/transactions-client.tsx",
  "app/owner/settings/page.tsx",
  "app/dev/page.tsx",
  "app/dev/users/users-client.tsx",
  "app/dev/logs/page.tsx",
  "app/dev/outlets/[id]/page.tsx",
];

describe("konsistensi tema v3.1.0 — semua halaman satu bahasa desain", () => {
  it("setiap shell halaman merender latar bersama (AuroraBackground)", () => {
    const lupa = SHELL_HALAMAN.filter((rel) => {
      const isi = baca(rel);
      return !isi.includes("AuroraBackground") && !isi.includes("WorkspaceShell");
    });
    expect(lupa).toEqual([]);
  });

  it("WorkspaceShell sendiri memasang AuroraBackground (satu untuk semua)", () => {
    expect(baca("components/workspace-shell.tsx")).toContain("AuroraBackground");
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

describe("v3.2.0 — App Shell sidebar WORKSPACE/MANAGE (pola PDF)", () => {
  it("setiap halaman owner & konsol dev memakai WorkspaceShell", () => {
    const lupa = SHELL_WORKSPACE.filter(
      (rel) => !baca(rel).includes("WorkspaceShell"),
    );
    expect(lupa).toEqual([]);
  });

  it("sidebar bernavigasi dua seksi ber-label + blok pengguna", () => {
    const isi = baca("components/workspace-shell.tsx");
    expect(isi).toContain('label: "Workspace"');
    expect(isi).toContain('label: "Manage"');
    // seluruh tujuan navigasi header lama tetap terjangkau
    for (const href of [
      "/",
      "/owner",
      "/owner/transactions",
      "/owner/verify",
      "/owner/products",
      "/owner/stock",
      "/owner/assistant",
      "/owner/settings",
      "/dev",
      "/dev/users",
      "/dev/logs",
    ]) {
      expect(isi).toContain(`"${href}"`);
    }
    expect(isi).toContain('href="/account"');
  });

  it("navigasi mobile tetap terjangkau (chip bisa digeser)", () => {
    const isi = baca("components/workspace-shell.tsx");
    expect(isi).toContain("overflow-x-auto");
    expect(isi).toContain("lg:hidden");
  });

  it("login baru: panel merek Midnight + widget status jujur", () => {
    const isi = baca("app/login/login-client.tsx");
    // panel merek gelap penuh tinggi + pil jaminan + widget ringkasan
    expect(isi).toContain("bg-[#171925]");
    expect(isi).toContain("Satu ruang kerja · semua outlet");
    expect(isi).toContain("Ringkasan bisnis");
    // versi backend NYATA (prop dari GET /api/v1/version), bukan demo
    expect(isi).toContain("backendVersion");
    // tidak ada SSO palsu (NextAuth credentials — tanpa OAuth)
    expect(isi).not.toContain("Continue with Google");
  });
});

describe("v3.3.0 — halaman sempit & struk mengikuti bahasa shell yang sama", () => {
  it("/settings & /account: pita berbatas + kartu tenang, tanpa sisa slop lama", () => {
    const tampilan = baca("app/settings/appearance-client.tsx");
    expect(tampilan).toContain("AuroraBackground");
    expect(tampilan).toContain("glass-card");
    expect(tampilan).toContain("text-overline");
    // sisa "AI slop" era lama tidak boleh kembali ke halaman pengaturan
    expect(tampilan).not.toContain("LuSparkles");
    expect(tampilan).not.toContain("motion.");
    expect(tampilan).not.toContain("backdrop-blur");

    const akun = baca("app/account/page.tsx");
    expect(akun).toContain("AuroraBackground");
    expect(akun).toContain("UserMenu");
    expect(akun).toContain("glass-card");
    expect(akun).not.toContain("bg-gradient-to");
    expect(akun).not.toContain("backdrop-blur-xl");
  });

  it("konsol verifikasi staf: kode + QR + jejak kejadian tetap utuh", () => {
    const detail = baca("app/owner/verify/[id]/page.tsx");
    expect(detail).toContain("AuroraBackground");
    expect(detail).toContain("UserMenu");
    expect(detail).toContain("Kode verifikasi");
    expect(detail).toContain("Jejak kejadian");
    expect(detail).toContain("QRCode");
  });

  it("struk pembeli di HP: dua mode + kartu struk + latar bersama", () => {
    const publik = baca("app/verify/[code]/page.tsx");
    expect(publik).toContain("AuroraBackground");
    expect(publik).toContain("glass-card");
    // mode readonly (nomor struk) dan interactive (kode klaim) keduanya ada
    expect(publik).toContain("Status Pesanan");
    expect(publik).toContain("Bukti Serah Terima");
    expect(publik).toContain("BuyerConfirmForm");
    expect(publik).toContain("BuyerDisputeButton");
  });

  it("layar struk kasir fokus-mobile: aksi selalu terjangkau jempol", () => {
    const struk = baca("app/cashier/receipt-view.tsx");
    expect(struk).toContain("Cetak Struk");
    expect(struk).toContain("Kirim via WhatsApp");
    expect(struk).toContain("Transaksi Baru");
    // bilah aksi melekat di dasar layar HP (desktop memakai kolom kiri)
    expect(struk).toContain("sticky bottom-0");
    expect(struk).toContain("lg:hidden");
    // kertas struk tetap satu-satunya yang tercetak
    expect(struk).toContain('id="struk-paper"');
  });
});
