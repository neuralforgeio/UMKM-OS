// Test penjaga Asisten AI (frontend v2.4.0) — file guard + kontrak.
//
// Yang dikunci: gerbang sesi/role di route handler, header internal
// antar-layanan, badge Mode Data vs AI + peringatan angka di panel,
// batas laju & cache di sisi layanan ML, dan kontrak lintas-stack
// (migrasi chat_history Go, konfigurasi LLM di compose/env).
// Standar: Bahasa Indonesia, stdlib Node saja, tanpa DB/jaringan.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_REPO = join(ROOT_FRONTEND, "..");

const baca = (rel: string) => readFileSync(join(ROOT_FRONTEND, rel), "utf-8");
const bacaRepo = (rel: string) => readFileSync(join(ROOT_REPO, rel), "utf-8");

describe("lib/assistant.ts — klien server-side", () => {
  it("BASE URL dari env server-only (bukan NEXT_PUBLIC)", () => {
    const isi = baca("lib/assistant.ts");
    expect(isi).toContain('process.env.BACKEND_URL ?? "http://127.0.0.1:8000"');
    expect(isi).not.toContain("NEXT_PUBLIC_BACKEND");
  });

  it("mengirim X-Internal-Key saat env terisi (blueprint 5.4)", () => {
    const isi = baca("lib/assistant.ts");
    expect(isi).toContain('process.env.INTERNAL_API_KEY ?? ""');
    expect(isi).toContain('headers["X-Internal-Key"] = INTERNAL_KEY');
  });

  it("chat TIDAK di-cache (no-store) — beda dari forecast 900 detik", () => {
    const isi = baca("lib/assistant.ts");
    expect(isi).toContain('cache: "no-store"');
    expect(isi).not.toContain("revalidate");
  });

  it("kontrak ChatResponse selaras skema layanan ML", () => {
    const isi = baca("lib/assistant.ts");
    for (const medan of [
      "answer",
      "mode",
      "intent",
      "period",
      "numbers_validated",
      "cached",
      "retried",
      "engine",
      "outlet_id",
      "outlet_name",
    ]) {
      expect(isi).toContain(`${medan}:`);
    }
  });

  it("kegagalan layanan menjadi pesan ramah, bukan crash", () => {
    const isi = baca("lib/assistant.ts");
    expect(isi).toContain("AssistantError");
    expect(isi).toContain("tidak terjangkau");
  });
});

describe("route handler /api/assistant — gerbang sesi & role", () => {
  it("chat: sesi wajib, KASIR ditolak 403 dengan pesan jelas", () => {
    const isi = baca("app/api/assistant/chat/route.ts");
    expect(isi).toContain("await auth()");
    expect(isi).toContain('session.user.role === "KASIR"');
    expect(isi).toContain("403");
  });

  it("chat: pertanyaan divalidasi (string, trim, maks 500)", () => {
    const isi = baca("app/api/assistant/chat/route.ts");
    expect(isi).toContain("slice(0, 500)");
    expect(isi).toContain("Tulis pertanyaannya dulu.");
  });

  it("chat: outlet_id diambil dari getOutletContext (per-outlet)", () => {
    const isi = baca("app/api/assistant/chat/route.ts");
    expect(isi).toContain("getOutletContext()");
    expect(isi).toContain("outlet?.id");
  });

  it("history: gerbang sama + toleran layanan tumbang (kosong)", () => {
    const isi = baca("app/api/assistant/history/route.ts");
    expect(isi).toContain("await auth()");
    expect(isi).toContain('session.user.role === "KASIR"');
    expect(isi).toContain("{ messages: [], total: 0 }");
  });
});

describe("components/assistant/assistant-panel.tsx — UX jujur", () => {
  it("badge Mode AI vs Mode Data dibedakan", () => {
    const isi = baca("components/assistant/assistant-panel.tsx");
    expect(isi).toContain("Mode AI");
    expect(isi).toContain("Mode Data");
    expect(isi).toContain("Sparkles");
    expect(isi).toContain("Database");
  });

  it("peringatan angka belum tervalidasi tampil (amber)", () => {
    const isi = baca("components/assistant/assistant-panel.tsx");
    expect(isi).toContain("numbersValidated === false");
    expect(isi).toContain("belum lolos validasi data");
  });

  it("daftar pesan aria-live untuk pembaca layar", () => {
    const isi = baca("components/assistant/assistant-panel.tsx");
    expect(isi).toContain('aria-live="polite"');
  });

  it("chip contoh pertanyaan untuk onboarding cepat", () => {
    const isi = baca("components/assistant/assistant-panel.tsx");
    expect(isi).toContain("Berapa omzet hari ini?");
    expect(isi).toContain("Stok apa yang menipis?");
  });

  it("umpan galat ramah (termasuk 429 batas laju dari detail)", () => {
    const isi = baca("components/assistant/assistant-panel.tsx");
    expect(isi).toContain("role=\"alert\"");
    expect(isi).toContain("isi.detail ??");
  });

  it("riwayat dimuat sekali + indicator memuat", () => {
    const isi = baca("components/assistant/assistant-panel.tsx");
    expect(isi).toContain('"/api/assistant/history"');
    expect(isi).toContain("Memuat riwayat");
  });
});

describe("halaman /owner/assistant", () => {
  it("gerbang role OWNER/DEVELOPER (kasir diarahkan ke kasir)", () => {
    const isi = baca("app/owner/assistant/page.tsx");
    expect(isi).toContain('session.user.role !== "OWNER"');
    expect(isi).toContain('redirect("/cashier")');
  });

  it("memakai AssistantPanel dengan nama outlet konteks", () => {
    const isi = baca("app/owner/assistant/page.tsx");
    expect(isi).toContain("<AssistantPanel outletName={namaOutlet} />");
    expect(isi).toContain("getOutletContext()");
  });
});

describe("navbar owner menautkan asisten", () => {
  it("link /owner/assistant ada di dashboard owner", () => {
    const isi = baca("app/owner/page.tsx");
    expect(isi).toContain('href="/owner/assistant"');
    expect(isi).toContain("Asisten");
  });
});

describe("kontrak lintas-stack Asisten (ml-service v3.1.0)", () => {
  it("layanan ML: batas laju sliding window per user dipasang", () => {
    const isi = bacaRepo("backend/app/api/routes/assistant.py");
    expect(isi).toContain("SlidingWindowLimiter");
    expect(isi).toContain("429");
    expect(isi).toContain("Retry-After");
  });

  it("layanan ML: cache jawaban + hanya jawaban tervalidasi di-cache", () => {
    const isi = bacaRepo("backend/app/api/routes/assistant.py");
    expect(isi).toContain("AnswerCache(");
    expect(isi).toContain('if hasil["numbers_validated"]:');
  });

  it("layanan ML: system prompt tegas 120 kata + 1 saran (blueprint)", () => {
    const isi = bacaRepo("backend/app/services/assistant.py");
    expect(isi).toContain("MAX_ANSWER_WORDS = 120");
    expect(isi).toContain("1 saran tindakan");
    expect(isi).toContain("HANYA dari DATA");
  });

  it("layanan ML: validasi angka + retry tepat 1x + flag jujur", () => {
    const isi = bacaRepo("backend/app/services/assistant.py");
    expect(isi).toContain("def validate_numbers(");
    expect(isi).toContain("def build_retry_instruction(");
    expect(isi).toContain('"numbers_validated": sah,');
  });

  it("layanan ML: kunci internal X-Internal-Key di gerbang endpoint", () => {
    const isi = bacaRepo("backend/app/api/routes/assistant.py");
    expect(isi).toContain('request.headers.get("X-Internal-Key", "")');
    expect(isi).toContain("require_internal_key");
  });

  it("layanan ML: jatuh ke Mode Data saat LLM tumbang (asisten tak mati)", () => {
    const isi = bacaRepo("backend/app/api/routes/assistant.py");
    expect(isi).toContain("build_offline_answer");
  });

  it("model ChatHistory dipetakan (pengecualian tulis satu-satunya)", () => {
    const isi = bacaRepo("backend/app/models/__init__.py");
    expect(isi).toContain('__tablename__ = "chat_history"');
    expect(isi).toContain("class ChatHistory(Base):");
  });

  it("compose: LLM opsional + INTERNAL_API_KEY di kedua layanan", () => {
    const isi = bacaRepo("docker-compose.yml");
    expect(isi).toContain("LLM_ENABLED:");
    expect(isi).toContain("LLM_BASE_URL:");
    expect(isi).toContain("LLM_API_KEY:");
    expect(isi).toContain("INTERNAL_API_KEY:");
    const layanan = isi.split("frontend:")[0];
    const frontend = isi.split("frontend:")[1] ?? "";
    expect(layanan).toContain("INTERNAL_API_KEY:"); // service backend
    expect(frontend).toContain("INTERNAL_API_KEY:"); // service frontend
  });

  it(".env.example: seksi OPSIONAL LLM agnostik penyedia", () => {
    const isi = bacaRepo(".env.example");
    expect(isi).toContain("LLM_BASE_URL");
    expect(isi).toContain("LLM_API_KEY");
    expect(isi).toContain("LLM_MODEL");
  });

  it("status asisten PUBLIK tanpa kunci (kejujuran mode)", () => {
    const isi = bacaRepo("backend/app/api/routes/assistant.py");
    const setelahStatus = isi.split("@router.get(\"/status\"")[1] ?? "";
    // hotfix RUN-3: blok /status dibatasi sampai decorator "@router." berikutnya;
    // endpoint /llm-config (v3.2.0) di bawahnya SAH memakai kunci internal,
    // jangan sampai ikut terbaca sebagai bagian endpoint publik /status.
    const blokStatus = setelahStatus.split("@router.")[0] ?? "";
    expect(blokStatus).not.toContain("require_internal_key");
  });
});

describe("Pengaturan LLM runtime (frontend v2.5.0)", () => {
  it("lib: fungsi GET/PUT llm-config memakai header internal + no-store", () => {
    const isi = baca("lib/assistant.ts");
    expect(isi).toContain("getAssistantLlmConfig");
    expect(isi).toContain("putAssistantLlmConfig");
    expect(isi).toContain("/api/v1/assistant/llm-config");
    expect(isi).toContain("AssistantLlmConfigInput");
  });

  it("route handler llm-config: sesi wajib, KASIR ditolak 403", () => {
    const isi = baca("app/api/assistant/llm-config/route.ts");
    expect(isi).toContain("await auth()");
    expect(isi).toContain('session.user.role === "KASIR"');
    expect(isi).toContain("403");
  });

  it("route handler llm-config: validasi base URL http(s) + model 422", () => {
    const isi = baca("app/api/assistant/llm-config/route.ts");
    expect(isi).toContain("/^https?:\\/\\//");
    expect(isi).toContain("422");
    expect(isi).toContain("Nama model wajib diisi");
  });

  it("form Asisten AI ada di Pengaturan dengan jangkar #asisten-ai", () => {
    const halaman = baca("app/owner/settings/page.tsx");
    expect(halaman).toContain("<AssistantAiForm />");
    expect(halaman).toContain('id="asisten-ai"');
    const form = baca("app/owner/settings/assistant-ai-form.tsx");
    expect(form).toContain('"/api/assistant/llm-config"');
    expect(form).toContain("Aktifkan Mode AI");
    expect(form).toContain("host.docker.internal:11434/v1");
  });

  it("form tidak pernah menampilkan kunci utuh (masker saja)", () => {
    const form = baca("app/owner/settings/assistant-ai-form.tsx");
    expect(form).toContain("api_key_masked");
    expect(form).toContain('type="password"');
  });

  it("panel asisten: hint Mode Data menautkan ke Pengaturan", () => {
    const isi = baca("components/assistant/assistant-panel.tsx");
    expect(isi).toContain('href="/owner/settings#asisten-ai"');
    expect(isi).toContain("Aktifkan Mode AI di Pengaturan");
  });

  it("panel asisten: chip identitas & saran minggu depan hadir", () => {
    const isi = baca("components/assistant/assistant-panel.tsx");
    expect(isi).toContain("Siapa kamu?");
    expect(isi).toContain("Saran minggu depan");
  });
});

describe("Asisten Cerdas lintas-stack (ml-service v3.2.0)", () => {
  it("layanan ML: jawaban Mode Data kini per-maksud (bukan template tunggal)", () => {
    const isi = bacaRepo("backend/app/services/assistant.py");
    expect(isi).toContain("def normalize_text(");
    expect(isi).toContain('maksud == "identitas"');
    expect(isi).toContain('maksud == "prediksi"');
    expect(isi).toContain('maksud == "sapaan"');
  });

  it("layanan ML: taksonomi maksud baru + persona OSCAR (v2.6.0)", () => {
    const isi = bacaRepo("backend/app/services/assistant.py");
    expect(isi).toContain('ASSISTANT_NAME = "OSCAR"');
    expect(isi).toContain("Online Shop Center for Assistance & Response");
    expect(isi).toContain('"identitas", "kemampuan", "sapaan", "terima_kasih"');
    expect(isi).toContain('"obrolan"');
    expect(isi).toContain('"jam_ramai"');
  });

  it("layanan ML: store konfigurasi runtime + endpoint PUT llm-config", () => {
    expect(bacaRepo("backend/app/services/llm_config_store.py")).toContain(
      "llm_config.json",
    );
    const routes = bacaRepo("backend/app/api/routes/assistant.py");
    expect(routes).toContain('@router.put("/llm-config"');
    expect(routes).toContain("mask_key");
    expect(routes).toContain("save_file_config");
  });

  it("layanan ML: konteks memuat kemajuan gerbang utk jawaban jujur", () => {
    const routes = bacaRepo("backend/app/api/routes/assistant.py");
    expect(routes).toContain("_progress_ml");
    expect(routes).toContain('"ml_progress"');
  });

  it("layanan ML: auto-train latar belakang + lifespan FastAPI", () => {
    expect(bacaRepo("backend/app/ml/auto_train.py")).toContain(
      "train_all_outlets",
    );
    expect(bacaRepo("backend/app/ml/auto_train.py")).toContain(
      "auto_train_loop",
    );
    expect(bacaRepo("backend/app/main.py")).toContain("lifespan");
    expect(bacaRepo("backend/app/main.py")).toContain("ML_AUTO_TRAIN");
  });

  it("layanan ML: gerbang progresif 28/14 (bukan lagi 56/28)", () => {
    const isi = bacaRepo("backend/app/ml/trainer.py");
    expect(isi).toContain("MIN_DAYS = 28");
    expect(isi).toContain("MIN_NONZERO = 14");
    expect(isi).toContain("def gate_status(");
  });

  it("API key opsional (Ollama) — bukan lagi syarat Mode AI", () => {
    const isi = bacaRepo("backend/app/services/llm.py");
    expect(isi).toContain("API key TIDAK diwajibkan");
    expect(isi).toContain("effective_llm_config");
  });

  it("compose: auto-train bisa dimatikan lewat env root", () => {
    const isi = bacaRepo("docker-compose.yml");
    expect(isi).toContain("ML_AUTO_TRAIN:");
  });
});
