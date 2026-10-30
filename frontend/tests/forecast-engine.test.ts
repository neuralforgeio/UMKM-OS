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

describe("kontrak lintas-stack ML v3.0.0 tetap utuh", () => {
  it("backend VERSIONS.csv memuat rilis 3.0.0 (2.0.0 sengaja dilewati)", () => {
    const isi = bacaRepo("backend/VERSIONS.csv");
    expect(isi).toContain("3.0.0,2026-10-26,FITUR");
    expect(isi).not.toMatch(/^2\.0\.0,/m);
  });

  it("requirements.txt backend memasang prophet", () => {
    const isi = bacaRepo("backend/requirements.txt");
    expect(isi).toMatch(/^prophet\r?$/m);
  });

  it("router memfilter transaksi lewat kolom outlet_id milik Go", () => {
    const isi = bacaRepo("backend/app/api/routes/forecast.py");
    expect(isi).toContain("Transaction.outlet_id == int(outlet_filter_id)");
    expect(isi).toContain("ensure_model");
    expect(isi).toContain("/models");
  });

  it("model SQLAlchemy memetakan transactions.outlet_id & products.outlet_id", () => {
    const isi = bacaRepo("backend/app/models/__init__.py");
    const transaksi = isi.split("class TransactionItem")[0];
    const produk = isi.split("class Product(Base)")[1].split("class Transaction")[0];
    expect(transaksi).toContain("outlet_id = Column(BigInteger, nullable=True)");
    expect(produk).toContain("outlet_id = Column(BigInteger, nullable=True)");
  });

  it("docker-compose: volume mlmodels + saklar PROPHET_ENABLED + thread BLAS", () => {
    const isi = bacaRepo("docker-compose.yml");
    expect(isi).toContain("- mlmodels:/app/mlmodels");
    expect(isi).toContain("PROPHET_ENABLED: ${PROPHET_ENABLED:-true}");
    expect(isi).toContain("OMP_NUM_THREADS: \"2\"");
    expect(isi).toMatch(/^  mlmodels:\r?$/m);
  });

  it("trainer: gerbang progresif 28/14, split dijepit, margin 2pp, antrean serial", () => {
    const isi = bacaRepo("backend/app/ml/trainer.py");
    // v3.2.0: gerbang diturunkan 56/28 -> 28/14 (model terlatih lebih
    // awal, auto-train latar belakang menyegarkannya tiap ada data baru).
    expect(isi).toContain("MIN_DAYS = 28");
    expect(isi).toContain("MIN_NONZERO = 14");
    expect(isi).toContain("TEST_MIN = 7");
    expect(isi).toContain("TEST_MAX = 45");
    expect(isi).toContain("WIN_MARGIN_PP = 2.0");
    expect(isi).toContain("asyncio.Semaphore(1)");
    expect(isi).toContain("asyncio.to_thread");
    expect(isi).toContain("def gate_status(");
  });

  it("MAPE hanya menilai hari non-zero (hari sepi bukan dosa ramalan)", () => {
    const isi = bacaRepo("backend/app/services/mape.py");
    expect(isi).toContain("if a == 0:");
    expect(isi).toContain("continue");
  });

  it(".gitignore menutup folder artefak model lokal", () => {
    const isi = bacaRepo(".gitignore");
    expect(isi).toMatch(/^backend\/mlmodels\/\r?$/m);
  });

  it("endpoint status model untuk konsol developer tersedia", () => {
    const isi = bacaRepo("backend/app/api/routes/forecast.py");
    expect(isi).toContain('@router.get("/models"');
    expect(isi).toContain("ModelsStatusResponse");
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
