// Test penjaga OSCAR Developer AI (frontend v2.7.0) — identitas pencipta
// + privasi per-owner + Mode Developer lintas toko.
//
// Yang dikunci: chip contoh 'Siapa penciptamu?' di panel, konstanta
// pencipta + aturan privasi/rahasia di otak ML, kehadiran modul
// developer_report.py beserta tes backend-nya, dan jalur chat Mode
// Developer yang memotong LLM (data lintas toko tidak pernah dikirim
// ke penyedia eksternal).
// Standar: Bahasa Indonesia, stdlib Node saja, tanpa DB/jaringan.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_REPO = join(ROOT_FRONTEND, "..");

const baca = (rel: string) => readFileSync(join(ROOT_FRONTEND, rel), "utf-8");
const bacaRepo = (rel: string) => readFileSync(join(ROOT_REPO, rel), "utf-8");

describe("OSCAR v2.7.0 — Developer AI + identitas pencipta", () => {
  it("panel: chip contoh 'Siapa penciptamu?' hadir", () => {
    const panel = baca("components/assistant/assistant-panel.tsx");
    expect(panel).toContain('"Siapa penciptamu?"');
    expect(panel).toContain('"Jam paling ramai kapan?"'); // regresi v2.6.0
  });

  it("otak ML: pencipta + privasi per-owner + modul Developer AI", () => {
    const otak = bacaRepo("backend/app/services/assistant.py");
    expect(otak).toContain(
      'ASSISTANT_CREATOR = "Dearly Febriano Irwansyah"',
    );
    expect(otak).toContain('"Surabaya, Indonesia"');
    expect(otak).toContain("Privasi per-owner");
    expect(otak).toContain("Rahasia");
    expect(() =>
      bacaRepo("backend/app/services/developer_report.py"),
    ).not.toThrow();
    expect(() => bacaRepo("backend/tests/test_dev_ai.py")).not.toThrow();
  });

  it("routes: Mode Developer memotong jalur LLM (privasi lintas toko)", () => {
    const routes = bacaRepo("backend/app/api/routes/assistant.py");
    expect(routes).toContain('if maksud == "dev_laporan":');
    expect(routes).toContain("oscar-developer-report");
    expect(routes).toContain("await _oscar_dev_jawab(payload.question)");
    // laporan lintas toko TIDAK mengalir ke prompt penyedia eksternal
    expect(routes).toContain("TIDAK lewat LLM");
  });
});
