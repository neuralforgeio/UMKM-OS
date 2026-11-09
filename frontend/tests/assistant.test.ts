// Test penjaga asisten OSCAR (frontend 1.3.0, era Go murni), panel murni
// AI, halaman obrolan terpusat, kontrak lintas-stack, dan uji sambungan
// LLM.
//
// Yang dikunci: persona OSCAR (nama, singkatan Online Shop Center for
// Assistance & Response, pencipta) sama di frontend dan backend Go;
// perilaku panel (riwayat, Enter mengirim, batas 500 karakter, gulir
// otomatis, aria-live); MURNI obrolan AI tanpa lencana mode dan tanpa
// jawaban template (kegagalan tampil jujur dengan tombol kirim ulang);
// halaman tanpa lampiran nama model; pintu route handler
// /api/assistant/* yang menolak kasir; dan jalur Tes Koneksi.
// ERA GO MURNI: sumber lintas-stack kini file Go di backend/internal/ai
// + internal/handler — layanan Python sudah tidak ada.
// Standar: Bahasa Indonesia, stdlib Node saja, tanpa DB/jaringan.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_REPO = join(ROOT_FRONTEND, "..");

const baca = (rel: string) => readFileSync(join(ROOT_FRONTEND, rel), "utf-8");
const bacaRepo = (rel: string) => readFileSync(join(ROOT_REPO, rel), "utf-8");

// Konstanta persona backend Go (backend/internal/ai/normalize.go),
// dikutip di sini sebagai kontrak lintas-stack: bila salah satu sisi
// berganti nama, test ini menyala lebih dulu.
const ASSISTANT_NAME = "OSCAR";
const ASSISTANT_FULL_NAME = "Online Shop Center for Assistance & Response";
const ASSISTANT_CREATOR = "Dearly Febriano Irwansyah";

describe("persona OSCAR, frontend dan backend Go seirama", () => {
  it("backend Go: nama dan singkatan resmi OSCAR", () => {
    const otak = bacaRepo("backend/internal/ai/normalize.go");
    expect(otak).toContain(`AssistantName      = "OSCAR"`);
    expect(otak).toContain(ASSISTANT_FULL_NAME);
    expect(otak).toContain(`AssistantCreator   = "${ASSISTANT_CREATOR}"`);
    expect(otak).not.toContain('"Dea"');
  });

  it("frontend: lib/oscar.ts memuat identitas yang sama", () => {
    const oscar = baca("lib/oscar.ts");
    expect(oscar).toContain(`export const OSCAR_NAME = "${ASSISTANT_NAME}";`);
    expect(oscar).toContain(ASSISTANT_FULL_NAME);
    expect(oscar).toContain(`export const OSCAR_CREATOR = "${ASSISTANT_CREATOR}"`);
  });

  it("panel: kepala obrolan memperkenalkan OSCAR + nama panjang", () => {
    const panel = baca("components/assistant/assistant-panel.tsx");
    expect(panel).toContain(`import { OSCAR_LONG_NAME, OSCAR_NAME } from "@/lib/oscar";`);
    expect(panel).toContain("{OSCAR_NAME}");
    expect(panel).toContain("{OSCAR_LONG_NAME}");
  });
});

describe("panel obrolan, perilaku yang tidak boleh berubah", () => {
  it("riwayat dimuat sekali lewat /api/assistant/history", () => {
    const panel = baca("components/assistant/assistant-panel.tsx");
    expect(panel).toContain('fetch("/api/assistant/history"');
    expect(panel).toContain('cache: "no-store"');
  });

  it("pertanyaan dikirim ke /api/assistant/chat dengan isi JSON", () => {
    const panel = baca("components/assistant/assistant-panel.tsx");
    expect(panel).toContain('fetch("/api/assistant/chat"');
    expect(panel).toContain('body: JSON.stringify({ question: bersih })');
  });

  it("Enter mengirim, Shift+Enter membuat baris baru", () => {
    const panel = baca("components/assistant/assistant-panel.tsx");
    expect(panel).toContain('e.key === "Enter" && !e.shiftKey');
    expect(panel).toContain("e.preventDefault()");
  });

  it("batas 500 karakter per pertanyaan tetap diberlakukan", () => {
    const panel = baca("components/assistant/assistant-panel.tsx");
    expect(panel).toContain("maxLength={500}");
  });

  it("alur pesan hidup untuk pembaca layar (aria-live)", () => {
    const panel = baca("components/assistant/assistant-panel.tsx");
    expect(panel).toContain('aria-live="polite"');
    expect(panel).toContain('aria-label="Percakapan asisten"');
  });

  it("panel murni obrolan AI: tanpa lencana mode dan tanpa tautan mode", () => {
    const panel = baca("components/assistant/assistant-panel.tsx");
    expect(panel).not.toContain("Mode AI");
    expect(panel).not.toContain("Mode Data");
    expect(panel).not.toContain('href="/owner/settings#asisten-ai"');
  });

  it("angka yang belum lolos validasi data diberi peringatan", () => {
    const panel = baca("components/assistant/assistant-panel.tsx");
    expect(panel).toContain("numbersValidated === false");
    expect(panel).toContain("belum lolos validasi data");
  });

  it("kegagalan AI tampil jujur sebagai gelembung galat dengan kirim ulang", () => {
    const panel = baca("components/assistant/assistant-panel.tsx");
    expect(panel).toContain('role={m.galat ? "alert" : undefined}');
    expect(panel).toContain("galat");
    expect(panel).toContain("Kirim ulang");
    expect(panel).toContain("tanyaTerakhir");
  });

  it("chip contoh lengkap, termasuk jam ramai, pencipta, dan hitungan bebas", () => {
    const panel = baca("components/assistant/assistant-panel.tsx");
    expect(panel).toContain('"Berapa omzet hari ini?"');
    expect(panel).toContain('"Stok apa yang menipis?"');
    expect(panel).toContain('"Produk terlaris minggu ini?"');
    expect(panel).toContain('"Kasih saran untuk minggu ini"');
    expect(panel).toContain('"Hitung diskon 20% dari Rp 50.000"');
    expect(panel).toContain('"Siapa kamu?"');
    expect(panel).toContain('"Jam paling ramai kapan?"');
    expect(panel).toContain('"Siapa penciptamu?"');
  });

  it("gulir otomatis mengikuti jawaban terbaru", () => {
    const panel = baca("components/assistant/assistant-panel.tsx");
    expect(panel).toContain("scrollIntoView");
    expect(panel).toContain("ujungRef");
  });

  it("sapaan pembuka menyebut nama outlet yang aktif", () => {
    const panel = baca("components/assistant/assistant-panel.tsx");
    expect(panel).toContain("{outletName}");
  });

  it("v1.2.0 AI Bebas: sapaan pembuka mengumumkan bisa tanya apa saja", () => {
    const panel = baca("components/assistant/assistant-panel.tsx");
    expect(panel).toContain("Tanya apa saja");
    expect(panel).toContain("selalu saya");
    // teks lama yang memenjarakan jawaban pada data saja sudah tidak boleh ada
    expect(panel).not.toContain("hanya dari data outlet ini");
  });

  it("v1.2.0 AI Bebas: pencatat bawah menyebut kebebasan + data terbaru", () => {
    const panel = baca("components/assistant/assistant-panel.tsx");
    expect(panel).toContain("OSCAR menjawab pertanyaan apa saja");
    expect(panel).toContain("data terbaru");
  });
});

describe("halaman OSCAR, gerbang dan obrolan terpusat tanpa model", () => {
  it("hanya pemilik dan developer yang boleh membuka halaman", () => {
    const halaman = baca("app/owner/assistant/page.tsx");
    expect(halaman).toContain('if (!session?.user?.goToken) redirect("/login");');
    expect(halaman).toContain('redirect("/cashier");');
  });

  it("halaman tidak lagi melampirkan model yang dipakai OSCAR", () => {
    const halaman = baca("app/owner/assistant/page.tsx");
    expect(halaman).not.toContain("getAssistantLlmConfig");
    expect(halaman).not.toContain("namaModel");
    expect(halaman).not.toContain("modeJawaban");
    expect(halaman).not.toContain("Konteks bisnis");
    expect(halaman).not.toContain("gpt-oss");
  });

  it("halaman murni obrolan: satu kolom terpusat tanpa panel samping", () => {
    const halaman = baca("app/owner/assistant/page.tsx");
    expect(halaman).toContain("max-w-3xl");
    expect(halaman).not.toContain("Aturan main");
  });

  it("aturan privasi tetap hidup di system prompt backend Go", () => {
    const prompt = bacaRepo("backend/internal/ai/prompt.go");
    expect(prompt).toContain("Privasi per-owner");
  });

  it("backend Go menolak jujur saat AI tidak aktif (Mode Data mati)", () => {
    const rute = bacaRepo("backend/internal/handler/assistant.go");
    expect(rute).not.toContain("BuildOfflineAnswer");
    expect(rute).toContain("http.StatusServiceUnavailable");
    expect(rute).toContain("http.StatusBadGateway");
  });

  it("era Go murni: pintu assistant + ramalan ber-gerbang X-Internal-Key", () => {
    const main = bacaRepo("backend/main.go");
    expect(main).toContain("middleware.RequireInternalKey");
    expect(main).toContain("handler.AssistantChat");
    expect(main).toContain("handler.ForecastRevenue");
  });
});

describe("lib/assistant.ts, kontrak klien sisi-server", () => {
  it("alamat backend Go dan kunci internal hanya hidup di server", () => {
    const lib = baca("lib/assistant.ts");
    expect(lib).toContain('process.env.BACKEND_URL ?? "http://127.0.0.1:8080"');
    expect(lib).toContain("process.env.INTERNAL_API_KEY ??");
    expect(lib).toContain('headers["X-Internal-Key"] = INTERNAL_KEY;');
  });

  it("chat dikirim dengan user_id, pertanyaan, dan outlet sesi", () => {
    const lib = baca("lib/assistant.ts");
    expect(lib).toContain("user_id: userId");
    expect(lib).toContain("outlet_id: String(outletId)");
    expect(lib).toContain('cache: "no-store"');
  });

  it("galat layanan diterjemahkan menjadi pesan ramah pemilik", () => {
    const lib = baca("lib/assistant.ts");
    expect(lib).toContain("Layanan asisten tidak terjangkau");
    expect(lib).toContain("class AssistantError extends Error");
    expect(lib).toContain("this.status = status;");
  });

  it("kontrak pengaturan LLM: kunci hanya kembali dalam bentuk dimasker", () => {
    const lib = baca("lib/assistant.ts");
    expect(lib).toContain("api_key_masked: string;");
    expect(lib).toContain('source: "file" | "env";');
    expect(lib).toContain("putAssistantLlmConfig");
    // Era Go murni: model bisa dikunci developer; peran pelaku diteruskan.
    expect(lib).toContain("model_locked: boolean;");
    expect(lib).toContain('headers["X-Acting-Role"] = actingRole;');
  });

  it("uji sambungan: POST ke /api/v1/assistant/llm-selftest", () => {
    const lib = baca("lib/assistant.ts");
    expect(lib).toContain("postAssistantLlmSelftest");
    expect(lib).toContain("${BASE_URL}/api/v1/assistant/llm-selftest");
    expect(lib).toContain("latency_ms: number | null;");
    expect(lib).toContain("answer_sample: string | null;");
    expect(lib).toContain("api_key_masked: string;");
  });
});

describe("route handler /api/assistant/*, gerbang sesi NextAuth", () => {
  it("uji sambungan menolak tanpa sesi dan menolak kasir", () => {
    const route = baca("app/api/assistant/llm-selftest/route.ts");
    expect(route).toContain("await auth()");
    expect(route).toContain("Sesi tidak valid");
    expect(route).toContain('session.user.role === "KASIR"');
    expect(route).toContain("hanya untuk pemilik");
  });

  it("uji sambungan meneruskan hasil mentah backend Go", () => {
    const route = baca("app/api/assistant/llm-selftest/route.ts");
    expect(route).toContain("postAssistantLlmSelftest()");
    expect(route).toContain('"Cache-Control": "no-store"');
  });

  it("chat tetap menggerbangi sesi dan memotong pertanyaan 500 karakter", () => {
    const route = baca("app/api/assistant/chat/route.ts");
    expect(route).toContain("await auth()");
    expect(route).toContain("slice(0, 500)");
    expect(route).toContain('role === "KASIR"');
  });
});

describe("uji sambungan LLM, lintas-stack sampai backend Go", () => {
  it("uji mandiri ada dan menyuntik klien (stub unittest Go)", () => {
    const uji = bacaRepo("backend/internal/ai/selftest.go");
    expect(uji).toContain("func RunSelftest(");
    expect(uji).toContain("klien Client");
    expect(uji).toContain("UjiPrompt");
  });

  it("kunci hanya keluar dalam bentuk dimasker (aturan 9 prompt Go)", () => {
    const uji = bacaRepo("backend/internal/ai/selftest.go");
    expect(uji).toContain("MaskKey(cfg.APIKey)");
    expect(uji).toContain("APIKeyMasked string");
  });

  it("klien HTTP Go menormalkan peran + menerjemahkan galat penyedia", () => {
    const klien = bacaRepo("backend/internal/ai/llm.go");
    expect(klien).toContain("func NormalisasiPesan");
    expect(klien).toContain("func PesanGalatHTTP");
    expect(klien).toContain("console.groq.com");
    expect(klien).toContain("reasoning_effort");
  });

  it("unittest Go menyuntik stub klien untuk RunSelftest", () => {
    const tes = bacaRepo("backend/internal/ai/ai_test.go");
    expect(tes).toContain("stubKlien");
    expect(tes).toContain("RunSelftest(context.Background(), s, klien)");
    expect(tes).toContain("MaskKey");
  });

  it("form pengaturan memiliki tombol Tes Koneksi dengan hasil nyata", () => {
    const form = baca("app/owner/settings/assistant-ai-form.tsx");
    expect(form).toContain("ujiKoneksi");
    expect(form).toContain('fetch("/api/assistant/llm-selftest"');
    expect(form).toContain("latensi");
    expect(form).toContain("Tes Koneksi");
  });

  it("form pengaturan menyimpan lewat PUT llm-config tanpa restart", () => {
    const form = baca("app/owner/settings/assistant-ai-form.tsx");
    expect(form).toContain('fetch("/api/assistant/llm-config"');
    expect(form).toContain('"PUT"');
    expect(form).toContain("api_key: config.apiKey");
  });

  it("pesan singkat (toast) dipakai form untuk hasil simpan dan uji", () => {
    const form = baca("app/owner/settings/assistant-ai-form.tsx");
    expect(form).toContain("useToast()");
    expect(form).toContain('variant: "sukses"');
    expect(form).toContain('variant: "galat"');
  });
});

describe("pencatat konsol khusus dipakai komponen baru", () => {
  it("toast dan pemilih outlet mencatat lewat lib/ui/log", () => {
    const toast = baca("components/ui/toast.tsx");
    expect(toast).toContain('from "@/lib/ui/log"');
    const switcher = baca("components/shell/store-switcher.tsx");
    expect(switcher).toContain('from "@/lib/ui/log"');
  });

  it("shell mencatat perubahan sidebar pada tingkat debug", () => {
    const shell = baca("components/shell/app-shell.tsx");
    expect(shell).toContain('log.debug("shell"');
  });
});
