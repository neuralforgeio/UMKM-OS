// Test pembangun filter jejak audit era Go murni (v2.1.0).
//
// buildLogQuery/logQueryString adalah satu-satunya jembatan filter
// antara UI /dev/logs dan route export — keduanya WAJIB membangun
// parameter yang identik dari input yang sama, kalau tidak, file Excel
// yang terunduh akan berbeda dari yang terlihat di layar (bug klasik
// laporan audit). Urutan parameter juga stabil supaya URL enak dibaca
// dan mudah di-diff.
import { describe, expect, it } from "vitest";
import {
  LOG_EXPORT_ROW_CAP,
  buildLogQuery,
  logQueryString,
} from "@/lib/audit-query";

describe("buildLogQuery (murni, tanpa Prisma)", () => {
  it("input kosong menghasilkan query kosong", () => {
    const qs = buildLogQuery({});
    expect(qs.toString()).toBe("");
    expect(logQueryString({})).toBe("");
  });

  it("nilai kosong dan 'ALL' dari dropdown tidak ikut terkirim", () => {
    const qs = buildLogQuery({
      q: "   ",
      action: "",
      outlet: "ALL",
      actor: undefined,
      from: "",
      to: "",
      level: "",
    });
    expect(qs.toString()).toBe("");
  });

  it("semua filter sehat masuk dengan urutan stabil", () => {
    const qs = buildLogQuery({
      q: "refund struk",
      action: "TRANSACTION_REFUND",
      outlet: "3",
      actor: "12",
      from: "2026-10-01",
      to: "2026-10-26",
      level: "PERINGATAN",
    });
    expect(qs.toString()).toBe(
      "q=refund+struk&action=TRANSACTION_REFUND&outlet=3&actor=12" +
        "&from=2026-10-01&to=2026-10-26&level=PERINGATAN",
    );
  });

  it("tanggal di luar format YYYY-MM-DD dibuang (bukan error)", () => {
    const qs = buildLogQuery({ from: "26/10/2026", to: "kapan saja" });
    expect(qs.toString()).toBe("");
  });

  it("level tidak dikenal diabaikan — hanya 3 tingkat yang sah", () => {
    const qs = buildLogQuery({ level: "GALAU" });
    expect(qs.toString()).toBe("");
    expect(buildLogQuery({ level: "GAGAL" }).get("level")).toBe("GAGAL");
    expect(buildLogQuery({ level: "SUKSES" }).get("level")).toBe("SUKSES");
  });

  it("logQueryString menghasilkan '?…' hanya saat ada filter", () => {
    expect(logQueryString({ action: "LOGIN" })).toBe("?action=LOGIN");
    expect(logQueryString({})).toBe("");
  });

  it("cap export tetap 10.000 — selaras limit maksimum backend-go", () => {
    expect(LOG_EXPORT_ROW_CAP).toBe(10_000);
  });
});
