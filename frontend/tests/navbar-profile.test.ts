// Penjaga profil navbar UMKM OS v1.0.0, topbar shell + judul halaman.
//
// Yang dikunci: topbar AppShell menampilkan remah roti, JUDUL HALAMAN,
// dan SUBJUDUL (nama panjang OSCAR di halaman asisten, permintaan
// pemilik menggantikan sebutan lama), plus saklar tema nyata dan menu
// profil ber-portal (z-100, menutup saat scroll/Escape/klik-luar).
// Standar: Bahasa Indonesia, stdlib Node saja, tanpa DB/jaringan.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");

const baca = (rel: string) => readFileSync(join(ROOT_FRONTEND, rel), "utf-8");

describe("topbar shell, judul halaman + identitas pengguna", () => {
  it("topbar memuat remah roti, judul, subjudul, dan menu profil", () => {
    const topbar = baca("components/shell/topbar.tsx");
    expect(topbar).toContain('aria-label="Remah roti"');
    expect(topbar).toContain("{crumb}");
    expect(topbar).toContain("{title}");
    expect(topbar).toContain("{subtitle}");
    expect(topbar).toContain("<UserMenu user={user} />");
    expect(topbar).toContain("<ThemeToggleButton />");
  });

  it("saklar tema mengganti tema nyata lewat next-themes (terpasang dahulu)", () => {
    const saklar = baca("components/shell/theme-toggle-button.tsx");
    expect(saklar).toContain('useTheme()');
    expect(saklar).toContain('setTheme(gelap ? "light" : "dark")');
    expect(saklar).toContain("siap");
  });

  it("menu profil tetap ber-PORTAL di atas segalanya (regresi v2.2.1)", () => {
    const menu = baca("components/user-menu.tsx");
    expect(menu).toContain("createPortal");
    expect(menu).toContain("z-[100]");
    expect(menu).toContain('document.body');
    expect(menu).toContain("Escape");
  });

  it("avatar pengguna me-reset foto-rusak saat versi foto berubah", () => {
    const menu = baca("components/user-menu.tsx");
    expect(menu).toContain("user.photoVersion");
    expect(menu).toContain("setPhotoBroken(false)");
  });

  it("sidebar menampilkan pengguna dengan label perannya", () => {
    const user = baca("components/shell/sidebar-user.tsx");
    expect(user).toContain("<UserAvatar user={user}");
    expect(user).toContain("roleLabelOf(user.role)");
  });
});

describe("identitas OSCAR di navbar (permintaan pemilik)", () => {
  it("lib/oscar.ts memuat nama panjang resmi OSCAR", () => {
    const oscar = baca("lib/oscar.ts");
    expect(oscar).toContain(
      'export const OSCAR_LONG_NAME =\n  "Online Shop Center for Assistance & Response";');
    expect(oscar).toContain('export const OSCAR_NAME = "OSCAR";');
  });

  it("halaman OSCAR memakai nama panjang sebagai subjudul topbar", () => {
    const halaman = baca("app/owner/assistant/page.tsx");
    expect(halaman).toContain("title={OSCAR_NAME}");
    expect(halaman).toContain("subtitle={OSCAR_LONG_NAME}");
  });

  it("halaman OSCAR tidak lagi memakai sebutan lama kopilot bisnis", () => {
    const halaman = baca("app/owner/assistant/page.tsx");
    expect(halaman).not.toContain("kopilot bisnis");
    const panel = baca("components/assistant/assistant-panel.tsx");
    expect(panel).not.toContain("kopilot bisnis");
  });

  it("panel obrolan memperkenalkan OSCAR dengan nama panjangnya", () => {
    const panel = baca("components/assistant/assistant-panel.tsx");
    expect(panel).toContain("{OSCAR_NAME}");
    expect(panel).toContain("{OSCAR_LONG_NAME}");
  });

  it("kartu OSCAR di sidebar mengarahkan ke halaman asisten", () => {
    const kartu = baca("components/shell/oscar-card.tsx");
    expect(kartu).toContain('href="/owner/assistant"');
    expect(kartu).toContain("Tanya {OSCAR_NAME}");
  });
});

describe("halaman konsol mengoper data profil ke shell", () => {
  it("dashboard pemilik mengoper peran, pengguna, dan outlet", () => {
    const dash = baca("app/owner/page.tsx");
    expect(dash).toContain("user={userMenuUser(session)}");
    expect(dash).toContain('crumb="Menu Utama"');
    expect(dash).toContain('title="Ringkasan"');
  });

  it("halaman transaksi, stok, produk, pengaturan ter-shell bersama", () => {
    for (const rel of [
      "app/owner/transactions/page.tsx",
      "app/owner/stock/page.tsx",
      "app/owner/products/page.tsx",
      "app/owner/settings/page.tsx",
    ]) {
      expect(baca(rel)).toContain("user={userMenuUser(session)}");
    }
  });

  it("konsol developer juga memakai shell dengan perannya", () => {
    for (const rel of [
      "app/dev/page.tsx",
      "app/dev/users/page.tsx",
      "app/dev/logs/page.tsx",
      "app/dev/outlets/[id]/page.tsx",
    ]) {
      const isi = baca(rel);
      expect(isi).toContain("AppShell");
      expect(isi).toContain('role="DEVELOPER"');
    }
  });

  it("beranda menampilkan identitas pengguna di bilah atasnya", () => {
    const beranda = baca("app/page.tsx");
    expect(beranda).toContain("<UserMenu user={userMenuUser(session)} />");
    expect(beranda).toContain("<ThemeToggleButton />");
  });
});
