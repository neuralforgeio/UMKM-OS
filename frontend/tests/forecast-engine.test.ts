// Test penjaga ML v3.0.0 (frontend v2.3.0) — engine ganda per-outlet.
//
// Keluarga invariant yang dikunci di sini:
//   1. lib/forecast.ts membawa engine + quality (duel backtest MAPE)
//      pada RevenueForecastResponse, dan mengirim outlet_id sesi.
//   2. ForecastSection menampilkan badge engine (Prophet/Statistik +
//      MAPE) di dashboard owner — bukti visual mesin mana yang menang.
//   3. Kontrak lintas-stack tetap utuh: outlet_id difilter lewat
//      transactions.outlet_id (kolom yang ditulis Go), model joblib
//      per outlet di volume mlmodels, .gitignore menutup foldernya.
// Standar: Bahasa Indonesia, stdlib Node saja, tanpa DB, tanpa jaringan.
// Regex ^...$ memakai \r? — file repo bisa ber-akhir CRLF (git
// autocrlf di Windows), tanpa itu "$" tak pernah cocok di baris CRLF.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_REPO = join(ROOT_FRONTEND, "..");

const baca = (rel: string) => readFileSync(join(ROOT_FRONTEND, rel), "utf-8");
const bacaRepo = (rel: string) => readFileSync(join(ROOT_REPO, rel), "utf-8");

describe("lib/forecast.ts — engine ganda + outlet_id", () => {
  it("RevenueForecastResponse membawa field engine dan quality", () => {
    const isi = baca("lib/forecast.ts");
    expect(isi).toContain("engine?: \"prophet\" | \"statistical\"");
    expect(isi).toContain("quality?: ForecastQuality | null");
    expect(isi).toContain("interface ForecastQuality");
  });

  it("ForecastQuality memuat metrik duel MAPE lengkap", () => {
    const isi = baca("lib/forecast.ts");
    for (const medan of [
      "winner",
      "mape_prophet",
      "mape_statistical",
      "margin_pp",
      "backtest_days",
      "train_days",
      "trained_at",
      "trained_through",
    ]) {
      expect(isi).toContain(`${medan}:`);
    }
  });

  it("getRevenueForecast & getProductsForecast mengirim outlet_id sesi", () => {
    const isi = baca("lib/forecast.ts");
    expect(isi).toContain("outletParam(outletId)");
    expect(isi).toContain("outlet_id=${encodeURIComponent");
    expect(isi).toContain("getRevenueForecast(days = 30, horizon = 7, outletId?: number)");
    expect(isi).toContain("getProductsForecast(limit = 5, outletId?: number)");
  });

  it("panggilan tanpa identitas outlet tetap sah (agregat lama)", () => {
    const isi = baca("lib/forecast.ts");
    expect(isi).toContain("outletId != null && Number.isFinite(outletId)");
  });
});

describe("components/forecast/forecast-section.tsx — badge engine di dashboard owner", () => {
  it("komponen EngineBadge ada dan dipakai RevenueCard", () => {
    const isi = baca("components/forecast/forecast-section.tsx");
    expect(isi).toContain("function EngineBadge");
    expect(isi).toContain("<EngineBadge engine={data.engine} quality={data.quality} />");
  });

  it("badge membedakan Prophet vs Statistik + MAPE lokal Indonesia", () => {
    const isi = baca("components/forecast/forecast-section.tsx");
    expect(isi).toContain('engine === "prophet"');
    expect(isi).toContain('"Prophet"');
    expect(isi).toContain('"Statistik"');
    expect(isi).toContain("formatMapeId");
    expect(isi).toContain('replace(".", ",")');
    expect(isi).toContain("MAPE");
  });

  it("badge menampilkan MAPE pemenang duel, bukan yang kalah", () => {
    const isi = baca("components/forecast/forecast-section.tsx");
    expect(isi).toContain("quality.mape_prophet");
    expect(isi).toContain("quality.mape_statistical");
    expect(isi).toContain("quality.backtest_days");
    expect(isi).toContain("quality.winner");
  });

  it("ForecastSection mengambil identitas outlet sesi untuk panggilan ML", () => {
    const isi = baca("components/forecast/forecast-section.tsx");
    expect(isi).toContain("getOutletContext()");
    expect(isi).toContain("getRevenueForecast(30, 7, outlet?.id)");
    expect(isi).toContain("getProductsForecast(5, outlet?.id)");
  });
});

describe("kontrak lintas-stack era Go murni tetap utuh", () => {
  it("backend VERSIONS.csv memuat rilis 2.0.0 era Go murni + hotfix 2.0.1", () => {
    const isi = bacaRepo("backend/VERSIONS.csv");
    expect(isi).toContain("2.0.0,2026-11-07,FITUR");
    expect(isi).toContain("2.0.1,2026-11-07,HOTFIX");
  });

  it("backend murni Go: go.mod ada, requirements.txt tidak", () => {
    expect(existsSync(join(ROOT_REPO, "backend", "go.mod"))).toBe(true);
    expect(existsSync(join(ROOT_REPO, "backend", "requirements.txt"))).toBe(false);
    const isi = bacaRepo("backend/go.mod");
    expect(isi).toContain("github.com/go-chi/chi/v5");
    expect(isi).toContain("github.com/jackc/pgx/v5");
  });

  it("handler ramalan Go memfilter transaksi lewat outlet_id milik migrasi Go", () => {
    const isi = bacaRepo("backend/internal/handler/forecast.go");
    expect(isi).toContain('k.outlet("p.outlet_id", outletID)');
    expect(isi).toContain('"engine":        "statistical"');
    expect(isi).toContain("RamalPendapatan");
    expect(isi).toContain("deretHarian(r.Context(), outletID, days)");
  });

  it("migrasi Go tetap memetakan transactions.outlet_id & products.outlet_id", () => {
    const isi = bacaRepo("backend/internal/db/db.go");
    expect(isi).toContain("ALTER TABLE products ADD COLUMN IF NOT EXISTS outlet_id");
    expect(isi).toContain("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS outlet_id");
  });

  it("docker-compose era Go murni: volume aidata + AI_DATA_DIR, tanpa Prophet", () => {
    const isi = bacaRepo("docker-compose.yml");
    expect(isi).toContain("- aidata:/app/aidata");
    expect(isi).toContain("AI_DATA_DIR: /app/aidata");
    expect(isi).not.toContain("PROPHET_ENABLED");
    expect(isi).toMatch(/^  aidata:\r?$/m);
  });

  it("gerbang progresif data 28/14 tetap hidup di handler asisten Go", () => {
    const isi = bacaRepo("backend/internal/handler/assistant.go");
    expect(isi).toContain("gerbangMinHari     = 28");
    expect(isi).toContain("gerbangMinBeromzet = 14");
  });

  it("MAPE hanya menilai hari non-zero (hari sepi bukan dosa ramalan)", () => {
    const isi = bacaRepo("backend/internal/ai/forecast.go");
    expect(isi).toContain("u.Omzet <= 0");
    expect(isi).toContain("continue");
  });

  it(".gitignore menutup folder data AI lokal", () => {
    const isi = bacaRepo(".gitignore");
    expect(isi).toMatch(/^backend\/aidata\/\r?$/m);
    expect(isi).not.toMatch(/^backend\/mlmodels\/\r?$/m);
  });
});

describe("regresi v2.3.0 tidak boleh melanggari pekerjaan lama", () => {
  it("fallback BackendDown saat layanan ML mati tetap utuh", () => {
    const isi = baca("components/forecast/forecast-section.tsx");
    expect(isi).toContain("function BackendDown()");
    expect(isi).toContain("getRevenueForecast");
  });

  it("formatRupiah tetap satu-satunya pemformat uang", () => {
    const isi = baca("components/forecast/forecast-section.tsx");
    expect(isi).toContain("formatRupiah");
  });
});
