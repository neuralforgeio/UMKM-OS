// Test penjaga OSCAR (frontend 1.3.0, era Go murni) — persona & otak
// lintas-stack, kini membaca sumber Go di backend/internal/ai.
//
// Yang dikunci: persona OSCAR (nama + nama lengkap) di backend Go,
// maksud obrolan & jam_ramai beserta keyword-nya, konteks jam ramai +
// estimasi hari habis di handler, validasi angka jam_ramai, chip
// contoh di panel, dan kehadiran unittest Go untuk OSCAR.
// Standar: Bahasa Indonesia, stdlib Node saja, tanpa DB/jaringan.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_REPO = join(ROOT_FRONTEND, "..");

const baca = (rel: string) => readFileSync(join(ROOT_FRONTEND, rel), "utf-8");
const bacaRepo = (rel: string) => readFileSync(join(ROOT_REPO, rel), "utf-8");

describe("OSCAR era Go murni — persona & otak (lintas-stack)", () => {
  it("backend Go: persona OSCAR tetap menggantikan Dea", () => {
    const isi = bacaRepo("backend/internal/ai/normalize.go");
    expect(isi).toContain('AssistantName      = "OSCAR"');
    expect(isi).toContain(
      "Online Shop Center for Assistance & Response",
    );
    expect(isi).not.toContain('"Dea"');
    expect(isi).not.toContain("nama dea");
    expect(isi).not.toContain("halo dea");
  });

  it("backend Go: maksud obrolan + jam_ramai tetap hidup", () => {
    const isi = bacaRepo("backend/internal/ai/normalize.go");
    expect(isi).toContain("kwObrolan");
    expect(isi).toContain("kwJamRamai");
    expect(isi).toContain('return "obrolan"');
    expect(isi).toContain('return "jam_ramai"');
  });

  it("backend Go: system prompt gaya campuran + riwayat lanjutan", () => {
    const isi = bacaRepo("backend/internal/ai/prompt.go");
    expect(isi).toContain("Gaya campuran");
    expect(isi).toContain("RIWAYAT percakapan");
    expect(isi).toContain("Estimasi stok habis");
    expect(isi).toContain("Jam paling ramai 7 hari");
  });

  it("handler Go: jam ramai + kecepatan laku + hari habis dari SQL", () => {
    const routes = bacaRepo("backend/internal/handler/assistant.go");
    expect(routes).toContain("func jamRamai");
    expect(routes).toContain("JamRamai:            jamRamai(ctx, outletID, 3)");
    expect(routes).toContain("s.KecepatanHari = kecepatan");
    expect(routes).toContain("s.HariHabis = &hh");
  });

  it("validasi angka: jam_ramai ikut diizinkan", () => {
    const isi = bacaRepo("backend/internal/ai/context.go");
    expect(isi).toContain("for _, j := range ctx.JamRamai");
  });

  it("panel: chip contoh 'Jam paling ramai kapan?' hadir", () => {
    const panel = baca("components/assistant/assistant-panel.tsx");
    expect(panel).toContain('"Jam paling ramai kapan?"');
  });

  it("unittest Go untuk OSCAR hadir", () => {
    expect(() => bacaRepo("backend/internal/ai/normalize_test.go")).not.toThrow();
    const t = bacaRepo("backend/internal/ai/normalize_test.go");
    expect(t).toContain("ClassifyIntent");
    expect(t).toContain("obrolan");
    expect(t).toContain("jam_ramai");
    // persona OSCAR dijaga di file sumber (normalize.go), bukan di tes:
    const sumber = bacaRepo("backend/internal/ai/normalize.go");
    expect(sumber).toContain('AssistantName      = "OSCAR"');
  });

  it("NLU lama diperluas: obrolan + jam_ramai tetap teruji di Go", () => {
    const nlu = bacaRepo("backend/internal/ai/normalize_test.go");
    expect(nlu).toContain('"wkwk lucu":                  "obrolan"');
    expect(nlu).toContain('"jam paling ramai kapan":     "jam_ramai"');
  });

  it("persona test lama diperbarui ke OSCAR", () => {
    const tes = baca("tests/assistant.test.ts");
    expect(tes).toContain('const ASSISTANT_NAME = "OSCAR"');
    expect(tes).not.toContain('const ASSISTANT_NAME = "Dea"');
  });
});
