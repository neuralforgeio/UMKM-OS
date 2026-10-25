// Test penjaga multi-outlet v2.0.0 — fungsi murni dari lib/api.ts
// (withOutletParam) dan lib/outlet-context.ts (outletLogoUrl).
// Sengaja tidak menyentuh goFetch/getOutletContext: keduanya memakai
// next/headers + jaringan — itu wilayah smoke test docker, bukan vitest.
import { describe, expect, it } from "vitest";
import { withOutletParam } from "../lib/api";
import { outletLogoUrl } from "../lib/outlet-branding";

describe("withOutletParam — penempel ?outlet_id= mode maintenance dev", () => {
  it("menempel parameter pertama dengan tanda ?", () => {
    expect(withOutletParam("/products", "3")).toBe("/products?outlet_id=3");
  });

  it("menempel parameter berikutnya dengan tanda &", () => {
    expect(withOutletParam("/products?all=true", "3")).toBe(
      "/products?all=true&outlet_id=3",
    );
  });

  it("cookie kosong/null tidak mengubah path", () => {
    expect(withOutletParam("/products", null)).toBe("/products");
    expect(withOutletParam("/products", undefined)).toBe("/products");
    expect(withOutletParam("/products", "")).toBe("/products");
  });

  it("nilai cookie bukan angka murni ditolak (anti-injeksi)", () => {
    // Id outlet Go selalu numerik; nilai lain (mis. cuid Prisma era lama
    // atau string serangan) tidak boleh pernah ikut terkirim.
    expect(withOutletParam("/products", "abc")).toBe("/products");
    expect(withOutletParam("/products", "3;drop")).toBe("/products");
    expect(withOutletParam("/products", "-1")).toBe("/products");
    expect(withOutletParam("/products", "1.5")).toBe("/products");
  });

  it("id numerik sah tetap lolos", () => {
    expect(withOutletParam("/queue", "12")).toBe("/queue?outlet_id=12");
    expect(withOutletParam("/reports/dashboard", "1048576")).toBe(
      "/reports/dashboard?outlet_id=1048576",
    );
  });
});

describe("outletLogoUrl — URL logo cache-busted", () => {
  it("outlet dengan logo menghasilkan URL ber-versi", () => {
    expect(outletLogoUrl({ has_logo: true, logo_version: 7 })).toBe(
      "/api/outlet/logo?v=7",
    );
  });

  it("outlet tanpa logo menghasilkan null (pemanggil pakai ikon bawaan)", () => {
    expect(outletLogoUrl({ has_logo: false, logo_version: 0 })).toBeNull();
  });

  it("versi 0 pun tetap cache-busted bila logo ada", () => {
    expect(outletLogoUrl({ has_logo: true, logo_version: 0 })).toBe(
      "/api/outlet/logo?v=0",
    );
  });
});
