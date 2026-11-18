import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// GUARD GERBANG DEVELOPER (v1.5.0 / backend 2.2.0): enam alat baru
// harus tetap ada setelah pemeliharaan berikutnya — pintu handler,
// rute server, tabel schema, halaman UI, dan menu navigasi.
// bacaRepo sama dengan helper tes lain (relatif root repo).

function bacaRepo(rel: string): string {
  return readFileSync(join(process.cwd(), "..", rel), "utf-8");
}

describe("gerbang developer v1.5.0 — pintu backend", () => {
  it("handler devconsole memuat enam pintu", () => {
    const h = bacaRepo("backend/internal/handler/devconsole.go");
    expect(h).toContain("func ListSessions");
    expect(h).toContain("func RevokeSession");
    expect(h).toContain("func ListFlags");
    expect(h).toContain("func PutFlag");
    expect(h).toContain("func ListSettings");
    expect(h).toContain("func PutSetting");
    expect(h).toContain("func SqlConsole");
    expect(h).toContain("func SystemHealth");
    expect(h).toContain("func SystemMetrics");
  });

  it("rute /admin/* terpasang khusus DEVELOPER di main.go", () => {
    const m = bacaRepo("backend/main.go");
    for (const rute of [
      "/admin/sessions",
      "/admin/flags",
      "/admin/settings",
      "/admin/sql",
      "/admin/health",
      "/admin/metrics",
    ]) {
      expect(m).toContain(`"${rute}"`);
    }
    // rute harus di grup DEVELOPER (bukan grup owner/mgr)
    const dev = m.slice(m.indexOf('RequireRoleIn("DEVELOPER")'));
    expect(dev).toContain("/admin/sessions");
  });

  it("schema membuat tiga tabel penyangga + TabelSet mengenali", () => {
    const sc = bacaRepo("backend/internal/schema/schema.go");
    expect(sc).toContain("CREATE TABLE IF NOT EXISTS sessions");
    expect(sc).toContain("CREATE TABLE IF NOT EXISTS flags");
    expect(sc).toContain("CREATE TABLE IF NOT EXISTS settings");
    const t = bacaRepo("backend/internal/schema/schema_test.go");
    expect(t).toContain('"sessions", "flags", "settings"');
  });

  it("token ber-sid: GenerateTokenSession + RequireAuth memeriksa sesi hidup", () => {
    const jw = bacaRepo("backend/internal/auth/jwt.go");
    expect(jw).toContain("SessionID string");
    expect(jw).toContain("func SidBaru()");
    expect(jw).toContain("func GenerateTokenSession");
    const mw = bacaRepo("backend/internal/middleware/middleware.go");
    expect(mw).toContain("Sesi telah dicabut");
    const lg = bacaRepo("backend/internal/handler/auth.go");
    expect(lg).toContain("GenerateTokenSession");
    expect(lg).toContain("INSERT INTO sessions");
  });

  it("SQL console menolak kata tulis + LIMIT dipaksa (tes Go ada)", () => {
    const h = bacaRepo("backend/internal/handler/devconsole.go");
    expect(h).toContain("JAM_TULIS");
    expect(h).toContain("hanya SELECT yang diizinkan");
    const t = bacaRepo("backend/tests/devconsole_test.go");
    expect(t).toContain("TestValidasiKueriKonsol");
    expect(t).toContain("TestSesiTendangBenderaPengaturanDB");
  });
});

describe("gerbang developer v1.5.0 — halaman frontend", () => {
  it("enam halaman baru ada di app/dev", () => {
    for (const p of [
      "ops",
      "sessions",
      "flags",
      "settings",
      "sql",
      "metrics",
    ]) {
      expect(() =>
        readFileSync(join(process.cwd(), "app/dev", p, "page.tsx")),
      ).not.toThrow();
    }
  });

  it("navigasi shell memuat seksi Gerbang Developer", () => {
    const nav = readFileSync(join(process.cwd(), "lib/shell-nav.ts"), "utf-8");
    expect(nav).toContain('"Gerbang Developer"');
    expect(nav).toContain('"/dev/ops"');
    expect(nav).toContain('"/dev/sql"');
    expect(nav).toContain('"/dev/metrics"');
  });
});
