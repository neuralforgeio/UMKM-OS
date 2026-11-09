// Test penjaga OSCAR Developer AI (frontend 1.3.0, era Go murni) —
// identitas pencipta + privasi per-owner + Mode Developer lintas toko,
// kini membaca sumber Go di backend/internal/ai + internal/handler.
//
// Yang dikunci: chip contoh 'Siapa penciptamu?' di panel, konstanta
// pencipta + aturan privasi/rahasia di otak Go, kehadiran modul
// devreport.go beserta unittest Go-nya, dan jalur chat Mode Developer
// yang memotong LLM (data lintas toko tidak pernah dikirim ke
// penyedia eksternal).
// Standar: Bahasa Indonesia, stdlib Node saja, tanpa DB/jaringan.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_REPO = join(ROOT_FRONTEND, "..");

const baca = (rel: string) => readFileSync(join(ROOT_FRONTEND, rel), "utf-8");
const bacaRepo = (rel: string) => readFileSync(join(ROOT_REPO, rel), "utf-8");

describe("OSCAR Developer AI era Go murni — identitas pencipta", () => {
  it("panel: chip contoh 'Siapa penciptamu?' hadir", () => {
    const panel = baca("components/assistant/assistant-panel.tsx");
    expect(panel).toContain('"Siapa penciptamu?"');
    expect(panel).toContain('"Jam paling ramai kapan?"'); // regresi v2.6.0
  });

  it("otak Go: pencipta + privasi per-owner + modul Developer AI", () => {
    const otak = bacaRepo("backend/internal/ai/normalize.go");
    expect(otak).toContain(
      'AssistantCreator   = "Dearly Febriano Irwansyah"',
    );
    expect(otak).toContain('"Surabaya, Indonesia"');
    const prompt = bacaRepo("backend/internal/ai/prompt.go");
    expect(prompt).toContain("Privasi per-owner");
    expect(prompt).toContain("Rahasia");
    expect(() =>
      bacaRepo("backend/internal/ai/devreport.go"),
    ).not.toThrow();
    expect(() => bacaRepo("backend/internal/ai/ai_test.go")).not.toThrow();
  });

  it("handler Go: Mode Developer memotong jalur LLM (privasi lintas toko)", () => {
    const routes = bacaRepo("backend/internal/handler/assistant.go");
    expect(routes).toContain('ClassifyIntent(question) == "dev_laporan"');
    expect(routes).toContain("oscar-developer-report");
    expect(routes).toContain("ai.Dev.JawabChat(question)");
    // laporan lintas toko TIDAK mengalir ke prompt penyedia eksternal
    expect(routes).toContain("TIDAK lewat LLM");
  });

  it("PIN developer dibandingkan konstan-waktu + batas laju endpoint", () => {
    const dev = bacaRepo("backend/internal/ai/devreport.go");
    expect(dev).toContain("subtle.ConstantTimeCompare");
    expect(dev).toContain("frasaDev");
    const handler = bacaRepo("backend/internal/handler/assistant.go");
    expect(handler).toContain("devLimiter");
    expect(handler).toContain("DEV_AI_RATE_LIMIT_PER_HOUR");
  });
});
