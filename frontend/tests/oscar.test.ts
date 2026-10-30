// Test penjaga OSCAR (frontend v2.6.0) — persona & otak baru lintas-stack.
//
// Yang dikunci: persona OSCAR menggantikan Dea di layanan ML (nama +
// nama lengkap), maksud baru obrolan & jam_ramai beserta keyword-nya,
// konteks jam ramai + estimasi hari habis di routes, validasi angka
// jam_ramai, chip contoh baru di panel, dan kehadiran tes backend OSCAR.
// Standar: Bahasa Indonesia, stdlib Node saja, tanpa DB/jaringan.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_REPO = join(ROOT_FRONTEND, "..");

const baca = (rel: string) => readFileSync(join(ROOT_FRONTEND, rel), "utf-8");
const bacaRepo = (rel: string) => readFileSync(join(ROOT_REPO, rel), "utf-8");

describe("OSCAR v2.6.0 — persona & otak baru (lintas-stack)", () => {
  it("layanan ML: persona OSCAR menggantikan Dea", () => {
    const isi = bacaRepo("backend/app/services/assistant.py");
    expect(isi).toContain('ASSISTANT_NAME = "OSCAR"');
    expect(isi).toContain(
      "Online Shop Center for Assistance & Response",
    );
    expect(isi).not.toContain('"Dea"');
    expect(isi).not.toContain("nama dea");
    expect(isi).not.toContain("halo dea");
  });

  it("layanan ML: maksud baru obrolan + jam_ramai", () => {
    const isi = bacaRepo("backend/app/services/assistant.py");
    expect(isi).toContain("_KW_OBROLAN");
    expect(isi).toContain("_KW_JAM_RAMAI");
    expect(isi).toContain("OBROLAN_VARIAN");
    expect(isi).toContain("return \"obrolan\"");
    expect(isi).toContain("return \"jam_ramai\"");
  });

  it("layanan ML: system prompt gaya campuran + riwayat lanjutan", () => {
    const isi = bacaRepo("backend/app/services/assistant.py");
    expect(isi).toContain("Gaya campuran");
    expect(isi).toContain("RIWAYAT percakapan");
    expect(isi).toContain("Estimasi stok habis");
    expect(isi).toContain("Jam paling ramai 7 hari");
  });

  it("routes: jam ramai + kecepatan laku + hari habis dari SQL", () => {
    const routes = bacaRepo("backend/app/api/routes/assistant.py");
    expect(routes).toContain("async def _jam_ramai");
    expect(routes).toContain('"jam_ramai": await _jam_ramai');
    expect(routes).toContain('"kecepatan_hari": kecepatan,');
    expect(routes).toContain('"hari_habis": hari_habis,');
  });

  it("validasi angka: jam_ramai ikut diizinkan", () => {
    const isi = bacaRepo("backend/app/services/assistant.py");
    expect(isi).toContain('_susuri(context.get("jam_ramai", []))');
  });

  it("panel: chip contoh 'Jam paling ramai kapan?' hadir", () => {
    const panel = baca("components/assistant/assistant-panel.tsx");
    expect(panel).toContain('"Jam paling ramai kapan?"');
  });

  it("tes backend OSCAR hadir", () => {
    expect(() => bacaRepo("backend/tests/test_oscar.py")).not.toThrow();
    const t = bacaRepo("backend/tests/test_oscar.py");
    expect(t).toContain("OSCAR");
    expect(t).toContain("obrolan");
    expect(t).toContain("jam_ramai");
  });

  it("NLU lama diperluas: obrolan + jam_ramai ikut validasi angka", () => {
    const nlu = bacaRepo("backend/tests/test_assistant_nlu.py");
    expect(nlu).toContain('"obrolan", "jam_ramai",');
  });

  it("persona test lama diperbarui ke OSCAR", () => {
    const tes = baca("tests/assistant.test.ts");
    expect(tes).toContain('ASSISTANT_NAME = "OSCAR"');
    expect(tes).not.toContain('ASSISTANT_NAME = "Dea"');
  });
});
