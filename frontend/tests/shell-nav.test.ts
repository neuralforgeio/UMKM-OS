// Test navigasi shell UMKM OS v1.0.0, murni, tanpa React/router.
//
// Yang dikunci: menu sidebar per peran (OWNER/KASIR/DEVELOPER), penanda
// menu aktif berbasis awalan terpanjang (halaman detail menandai menu
// induknya), judul remah roti, dan penyimpanan status sidebar
// diringkatkan (minimize) yang bertahan antar halaman.
import { describe, expect, it } from "vitest";
import {
  SIDEBAR_STORAGE_KEY,
  activeNavHref,
  navSectionsForRole,
  sectionTitleFor,
  sidebarCollapsedFromStorage,
  sidebarCollapsedToStorage,
} from "@/lib/shell-nav";

describe("navSectionsForRole, menu sidebar per peran", () => {
  it("OWNER punya dua bagian: Menu Utama dan Pengelolaan", () => {
    const bagian = navSectionsForRole("OWNER");
    expect(bagian.map((b) => b.title)).toEqual([
      "Menu Utama",
      "Pengelolaan",
    ]);
  });

  it("menu OWNER memuat seluruh rute konsol pemilik", () => {
    const href = navSectionsForRole("OWNER")
      .flatMap((b) => b.items.map((i) => i.href))
      .sort();
    expect(href).toEqual(
      [
        "/owner",
        "/owner/assistant",
        "/owner/products",
        "/owner/settings",
        "/owner/stock",
        "/owner/transactions",
        "/owner/verify",
      ].sort());
  });

  it("OSCAR tampil di menu OWNER dengan ikon sparkles", () => {
    const oscar = navSectionsForRole("OWNER")
      .flatMap((b) => b.items)
      .find((i) => i.label === "OSCAR");
    expect(oscar?.href).toBe("/owner/assistant");
    expect(oscar?.icon).toBe("sparkles");
  });

  it("KASIR hanya melihat Beranda dan Kasir", () => {
    const item = navSectionsForRole("KASIR").flatMap((b) => b.items);
    expect(item.map((i) => i.href)).toEqual(["/", "/cashier"]);
  });

  it("DEVELOPER melihat konsolnya, bukan menu owner", () => {
    const bagian = navSectionsForRole("DEVELOPER");
    expect(bagian).toHaveLength(1);
    expect(bagian[0].title).toBe("Konsol Developer");
    const href = bagian[0].items.map((i) => i.href);
    expect(href).toContain("/dev");
    expect(href).toContain("/dev/users");
    expect(href).toContain("/dev/logs");
    expect(href).not.toContain("/owner");
  });

  it("peran tak dikenal mendapat menu kosong, bukan melempar", () => {
    expect(navSectionsForRole(null)).toEqual([]);
  });
});

describe("activeNavHref, menu aktif berdasarkan jalur", () => {
  it("kecocokan persis menandai menunya", () => {
    expect(activeNavHref("/owner/stock", "OWNER")).toBe("/owner/stock");
    expect(activeNavHref("/dev/logs", "DEVELOPER")).toBe("/dev/logs");
  });

  it("halaman detail menandai menu induk (awalan berbatas /)", () => {
    expect(activeNavHref("/dev/outlets/3", "DEVELOPER")).toBe("/dev");
    expect(activeNavHref("/owner/verify/TRX-123", "OWNER")).toBe(
      "/owner/verify");
  });

  it("awalan terpanjang menang bila dua menu serumpun", () => {
    expect(activeNavHref("/owner/transactions", "OWNER")).toBe(
      "/owner/transactions");
  });

  it("jalur di luar menu peran menghasilkan null", () => {
    expect(activeNavHref("/owner", "KASIR")).toBeNull();
    expect(activeNavHref("/cashier", "OWNER")).toBeNull();
  });

  it("Beranda KASIR hanya cocok pada jalur akar persis", () => {
    expect(activeNavHref("/", "KASIR")).toBe("/");
    expect(activeNavHref("/owner", "KASIR")).toBeNull();
  });
});

describe("sectionTitleFor, remah roti topbar", () => {
  it("setiap area memperkenalkan bagiannya", () => {
    expect(sectionTitleFor("/owner", "OWNER")).toBe("Menu Utama");
    expect(sectionTitleFor("/owner/assistant", "OWNER")).toBe("Pengelolaan");
    expect(sectionTitleFor("/dev/users", "DEVELOPER")).toBe(
      "Konsol Developer");
  });

  it("halaman yang tak dikenal jatuh ke Ruang Kerja", () => {
    expect(sectionTitleFor("/tidak-ada", "OWNER")).toBe("Ruang Kerja");
  });
});

describe("penyimpanan status sidebar diringkatkan", () => {
  it("kunci penyimpanan lokal tetap stabil antar rilis", () => {
    expect(SIDEBAR_STORAGE_KEY).toBe("umkm.sidebar.collapsed");
  });

  it("nilai 1 berarti diringkatkan; lainnya berarti dibentangkan", () => {
    expect(sidebarCollapsedFromStorage("1")).toBe(true);
    expect(sidebarCollapsedFromStorage("0")).toBe(false);
    expect(sidebarCollapsedFromStorage(null)).toBe(false);
  });

  it("konversi dua arah tidak kehilangan makna", () => {
    expect(sidebarCollapsedToStorage(true)).toBe("1");
    expect(sidebarCollapsedToStorage(false)).toBe("0");
    expect(
      sidebarCollapsedFromStorage(sidebarCollapsedToStorage(true))).toBe(true);
  });
});
