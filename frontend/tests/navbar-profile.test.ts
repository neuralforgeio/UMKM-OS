// Test penjaga navbar & profil v2.2.0 + v2.2.1.
//
// Keluarga invariant yang dikunci di sini:
//   1. TEMA hanya diatur di /settings (dan /login pra-autentikasi) —
//      toggle tema TIDAK boleh kembali menempel di navbar halaman mana
//      pun. components/theme-header-actions.tsx sudah dihapus total.
//   2. Chip profil UserMenu (avatar + nama + email -> menu
//      Profil / Pengaturan / Keluar) wajib ada di SETIAP shell
//      halaman ber-autentikasi.
//   3. (v2.2.1) Dropdown menu dirender lewat PORTAL ke document.body
//      dengan z-[100] — tidak lagi terkurung stacking context header,
//      sehingga tidak mungkin tertindih kartu konten halaman.
//   4. (v2.2.1) Tidak ada chip profil kedua yang tertinggal; navbar
//      area developer full-width ala kasir/owner; terminal jejak
//      audit hidup di konsol dev & mode terminal /dev/logs.
// Standar: Bahasa Indonesia, stdlib Node saja, tanpa DB, tanpa jaringan.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  avatarGradientFor,
  initialsOf,
  roleLabelOf,
  userPhotoUrl,
} from "../lib/avatar";
import { userMenuUser } from "../lib/session-user";

const ROOT_FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");

const baca = (rel: string) => readFileSync(join(ROOT_FRONTEND, rel), "utf-8");

// Seluruh shell halaman ber-autentikasi (audit v2.2.0) — halaman baru
// yang lupa memasang chip profil akan menyala di sini.
const SHELL_TERAUTENTIKASI = [
  "app/page.tsx",
  "app/account/page.tsx",
  "app/cashier/pos-client.tsx",
  "app/owner/page.tsx",
  "app/owner/products/products-client.tsx",
  "app/owner/stock/page.tsx",
  "app/owner/transactions/transactions-client.tsx",
  "app/owner/settings/page.tsx",
  "app/owner/verify/page.tsx",
  "app/owner/assistant/page.tsx",
  "app/owner/verify/[id]/page.tsx",
  "app/dev/page.tsx",
  "app/dev/users/users-client.tsx",
  "app/dev/logs/page.tsx",
  "app/dev/outlets/[id]/page.tsx",
];

describe("tema hanya di /settings — navbar bebas pergantian tema", () => {
  it("components/theme-header-actions.tsx sudah dihapus total", () => {
    expect(existsSync(join(ROOT_FRONTEND, "components/theme-header-actions.tsx"))).toBe(
      false,
    );
  });

  it("tidak ada lagi impor ThemeHeaderActions di mana pun", () => {
    const sisa = SHELL_TERAUTENTIKASI.filter(
      (rel) => baca(rel).includes("ThemeHeaderActions") === true,
    );
    expect(sisa).toEqual([]);
  });

  it("ThemeToggle hanya boleh hidup di halaman login (pra-autentikasi)", () => {
    const pemakai = [
      ...SHELL_TERAUTENTIKASI,
      "app/settings/appearance-client.tsx",
    ].filter((rel) => baca(rel).includes("theme-toggle"));
    // Halaman ber-autentikasi mana pun tidak boleh mengimpor toggle tema;
    // pengaturan tampilan memakai kartu pilihannya sendiri, bukan pil kecil.
    expect(pemakai).toEqual([]);
  });

  it("pintu /settings tetap terjangkau dari semua halaman (menu profil)", () => {
    // UserMenu membawa tautan "Pengaturan Tampilan" — pengguna tidak
    // kehilangan akses tema setelah toggle dihapus dari navbar.
    const isi = baca("components/user-menu.tsx");
    expect(isi).toContain('href="/settings"');
    expect(isi).toContain('href="/account"');
    expect(isi).toContain("logoutAction");
  });
});

describe("chip profil UserMenu wajib di semua halaman ber-autentikasi", () => {
  it("setiap shell merender UserMenu", () => {
    const lupa = SHELL_TERAUTENTIKASI.filter(
      (rel) => !baca(rel).includes("UserMenu"),
    );
    expect(lupa).toEqual([]);
  });

  it("server action Keluar tunggal dipakai menu profil", () => {
    const isi = baca("lib/logout-action.ts");
    expect(isi).toContain("signOut");
    expect(isi).toContain('redirectTo: "/login"');
  });

  it("prop identitas selalu lewat penyaring session-user (tanpa goToken)", () => {
    // Uji PERILAKU fungsi, bukan teks berkas: identitas yang dikirim ke
    // komponen client hanya name/email/role/photoVersion — token sesi
    // backend-go tidak pernah ikut melintas.
    const hasil = userMenuUser({
      user: {
        id: "7",
        name: "Dear Dor",
        email: "dear@warung.id",
        role: "OWNER",
        outletId: "2",
        goToken: "jwt-rahasia-jangan-bocor",
        photoVersion: 4,
      },
    } as Parameters<typeof userMenuUser>[0]);

    expect(hasil).toEqual({
      name: "Dear Dor",
      email: "dear@warung.id",
      role: "OWNER",
      photoVersion: 4,
    });

    // Sesi kosong/anonim jatuh ke default aman.
    expect(userMenuUser(null)).toEqual({
      name: null,
      email: null,
      role: null,
      photoVersion: 0,
    });
  });
});

describe("helper avatar (lib/avatar.ts) — murni dan konsisten", () => {
  it("initialsOf: dua kata -> dua huruf depan, satu kata -> dua huruf", () => {
    expect(initialsOf("Dear Dor")).toBe("DD");
    expect(initialsOf("Developer")).toBe("DE");
    expect(initialsOf("kasir satu")).toBe("KS");
    expect(initialsOf("  spaced   name  ")).toBe("SN");
  });

  it("initialsOf: nama kosong tidak pernah menghasilkan string kosong", () => {
    expect(initialsOf("")).toBe("?");
    expect(initialsOf("   ")).toBe("?");
    expect(initialsOf(null)).toBe("?");
    expect(initialsOf(undefined)).toBe("?");
  });

  it("avatarGradientFor: gradasi berbeda per peran", () => {
    expect(avatarGradientFor("KASIR")).toContain("emerald");
    expect(avatarGradientFor("DEVELOPER")).toContain("violet");
    expect(avatarGradientFor("OWNER")).toContain("blue");
    expect(avatarGradientFor(null)).toContain("blue");
  });

  it("roleLabelOf: label bahasa Indonesia per peran", () => {
    expect(roleLabelOf("OWNER")).toBe("Pemilik");
    expect(roleLabelOf("KASIR")).toBe("Kasir");
    expect(roleLabelOf("DEVELOPER")).toBe("Developer");
    expect(roleLabelOf("")).toBe("Pengguna");
  });

  it("userPhotoUrl: null saat belum ada foto, berversi saat sudah", () => {
    expect(userPhotoUrl(0)).toBeNull();
    expect(userPhotoUrl(null)).toBeNull();
    expect(userPhotoUrl(undefined)).toBeNull();
    expect(userPhotoUrl(3)).toBe("/api/user/photo?v=3");
  });
});

describe("v2.2.1 — dropdown portal selalu paling depan", () => {
  it("menu dirender lewat createPortal ke document.body, fixed z-[100]", () => {
    // Akar bug "tertumpuk": dropdown lama hidup di dalam stacking
    // context header (relative z-10) sehingga <main> yang datang
    // belakangan di DOM melukis menindihnya. Portal + fixed + z-[100]
    // mengeluarkan menu dari urutan stacking halaman sama sekali.
    const isi = baca("components/user-menu.tsx");
    expect(isi).toContain("createPortal");
    expect(isi).toContain("document.body");
    expect(isi).toContain("z-[100]");
    expect(isi).toContain('position: "fixed"');
  });

  it("chip profil lama tidak lagi dobel di konsol Kelola Akun", () => {
    // v2.2.0 sempat menampilkan DUA profil di /dev/users: UserMenu baru
    // + chip developer lama (inisial + nama + email statis). Chip lama
    // dihapus; test ini menjaga agar tidak pernah tertinggal lagi.
    const isi = baca("app/dev/users/users-client.tsx");
    expect(isi).toContain("UserMenu");
    expect(isi.includes("initials(userName")).toBe(false);
    expect(isi.includes("userName?:")).toBe(false);
  });

  it("navbar area developer kini full-width ala kasir/owner", () => {
    // dulu /dev, /dev/logs, /dev/outlets/[id] membungkus SELURUH
    // halaman (termasuk topbar) dalam kolom max-w-6xl di tengah layar;
    // kini topbar memanjang penuh dan hanya barisnya yang dibatasi
    // max-w-7xl — pola navbar kasir/owner.
    const halamanDev = [
      "app/dev/page.tsx",
      "app/dev/logs/page.tsx",
      "app/dev/outlets/[id]/page.tsx",
    ];
    for (const rel of halamanDev) {
      const isi = baca(rel);
      expect(isi.includes("max-w-6xl")).toBe(false);
      expect(isi).toContain("max-w-7xl");
    }
  });

  it("terminal jejak audit hidup di konsol dev & Log Aktivitas", () => {
    expect(existsSync(join(ROOT_FRONTEND, "components/audit-terminal.tsx"))).toBe(true);
    expect(existsSync(join(ROOT_FRONTEND, "lib/audit-terminal.ts"))).toBe(true);
    // Kartu konsol dev memakai terminal...
    expect(baca("app/dev/page.tsx")).toContain("AuditTerminal");
    // ...dan /dev/logs punya dua mode: tabel default + ?view=terminal.
    const logs = baca("app/dev/logs/page.tsx");
    expect(logs).toContain("AuditTerminal");
    expect(logs).toContain("view=terminal");
    // Mode tersimpan saat filter diterapkan & pagination berpindah halaman.
    expect(logs).toContain('name="view"');
  });
});
