// Penjaga profil & tata letak navbar UMKM OS v1.1.0.
//
// Perubahan v1.1.0 (permintaan pemilik, berlaku di semua role):
//  * Topbar AppShell TIDAK lagi memuat menu profil dan saklar tema;
//    keduanya diganti jam WIB ringkas + tombol Changelog.
//  * Menu akun berpindah ke dasar sidebar (SidebarUser): profil akun,
//    pengaturan tampilan, ganti tema, dan keluar, ber-portal z-100.
//  * Kartu "Tanya OSCAR" dihapus dari sidebar (halaman OSCAR tetap
//    bisa dibuka lewat menu OSCAR di bagian Pengelolaan).
//  * Pengecualian: beranda "/" tetap memakai navbar lamanya lengkap
//    dengan menu profil (tidak memakai Topbar shell).
//
// Standar: Bahasa Indonesia, stdlib Node saja, tanpa DB/jaringan.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");

const baca = (rel: string) => readFileSync(join(ROOT_FRONTEND, rel), "utf-8");

describe("topbar shell v1.1.0: judul halaman + Changelog + jam WIB", () => {
  it("topbar memuat remah roti, judul, subjudul, Changelog, dan jam WIB", () => {
    const topbar = baca("components/shell/topbar.tsx");
    expect(topbar).toContain('aria-label="Remah roti"');
    expect(topbar).toContain("{crumb}");
    expect(topbar).toContain("{title}");
    expect(topbar).toContain("{subtitle}");
    expect(topbar).toContain("<Changelog />");
    expect(topbar).toContain("<LocalClock ringkas />");
  });

  it("topbar tidak lagi memuat menu profil dan saklar tema (pindah ke sidebar)", () => {
    const topbar = baca("components/shell/topbar.tsx");
    expect(topbar).not.toContain("<UserMenu");
    expect(topbar).not.toContain("<ThemeToggleButton");
    expect(topbar).not.toContain("user:");
  });

  it("tombol Changelog ber-portal dengan daftar versi dari lib/changelog", () => {
    const changelog = baca("components/shell/changelog.tsx");
    expect(changelog).toContain("createPortal");
    expect(changelog).toContain("z-[100]");
    expect(changelog).toContain("document.body");
    expect(changelog).toContain("Escape");
    expect(changelog).toContain("CHANGELOG");
    expect(changelog).toContain('from "@/lib/changelog"');
  });

  it("jam WIB ringkas hidup tiap detik untuk dua wajah (panel + topbar)", () => {
    const jam = baca("components/ui/local-clock.tsx");
    expect(jam).toContain("Asia/Jakarta");
    expect(jam).toContain("setInterval");
    expect(jam).toContain("ringkas");
  });
});

describe("menu akun sidebar menggantikan menu profil topbar", () => {
  it("menu akun memuat avatar, nama, peran, dan pintasan lengkap", () => {
    const user = baca("components/shell/sidebar-user.tsx");
    expect(user).toContain("<UserAvatar user={user}");
    expect(user).toContain("roleLabelOf(user.role)");
    expect(user).toContain('href="/account"');
    expect(user).toContain('href="/settings"');
    expect(user).toContain("Profil Akun");
    expect(user).toContain("Pengaturan Tampilan");
    expect(user).toContain("Ganti ke Tema");
  });

  it("ganti tema di menu akun memakai next-themes sungguhan", () => {
    const user = baca("components/shell/sidebar-user.tsx");
    expect(user).toContain("useTheme");
    expect(user).toContain('setTheme(gelap ? "light" : "dark")');
  });

  it("keluar lewat server action logoutAction, menu ber-portal z-100", () => {
    const user = baca("components/shell/sidebar-user.tsx");
    expect(user).toContain("logoutAction");
    expect(user).toContain("createPortal");
    expect(user).toContain("z-[100]");
    expect(user).toContain("document.body");
    expect(user).toContain("Escape");
  });

  it("menu profil lama (user-menu) tetap hidup untuk beranda", () => {
    const menu = baca("components/user-menu.tsx");
    expect(menu).toContain("createPortal");
    expect(menu).toContain("z-[100]");
    expect(menu).toContain("user.photoVersion");
    expect(menu).toContain("setPhotoBroken(false)");
  });
});

describe("kartu Tanya OSCAR dihapus dari sidebar (v1.1.0)", () => {
  it("berkas oscar-card.tsx sudah tidak ada", () => {
    expect(existsSync(join(ROOT_FRONTEND, "components/shell/oscar-card.tsx"))).toBe(false);
  });

  it("sidebar tidak lagi merender OscarCard", () => {
    const sidebar = baca("components/shell/app-sidebar.tsx");
    expect(sidebar).not.toContain("OscarCard");
    expect(sidebar).not.toContain("oscar-card");
  });

  it("menu OSCAR tetap bisa dibuka lewat menu navigasi Pengelolaan", () => {
    const nav = baca("lib/shell-nav.ts");
    expect(nav).toContain('{ href: "/owner/assistant", label: "OSCAR", icon: "sparkles" }');
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

  it("beranda menampilkan identitas pengguna di bilah atasnya (pengecualian)", () => {
    const beranda = baca("app/page.tsx");
    expect(beranda).toContain("<UserMenu user={userMenuUser(session)} />");
    expect(beranda).toContain("<ThemeToggleButton />");
  });
});
