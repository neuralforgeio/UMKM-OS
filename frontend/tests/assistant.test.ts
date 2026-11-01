// Test penjaga asisten OSCAR (frontend v1.1.0), panel murni AI,
// halaman obrolan terpusat, kontrak lintas-stack, dan uji sambungan LLM.
//
// Yang dikunci: persona OSCAR (nama, singkatan Online Shop Center for
// Assistance & Response, pencipta) sama di frontend dan layanan ML;
// perilaku panel (riwayat, Enter mengirim, batas 500 karakter, gulir
// otomatis, aria-live); MURNI obrolan AI tanpa lencana mode dan tanpa
// jawaban template (kegagalan tampil jujur dengan tombol kirim ulang);
// halaman tanpa lampiran nama model; pintu route handler
// /api/assistant/* yang menolak kasir; dan jalur Tes Koneksi.
// Standar: Bahasa Indonesia, stdlib Node saja, tanpa DB/jaringan.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_REPO = join(ROOT_FRONTEND, "..");

const baca = (rel: string) => readFileSync(join(ROOT_FRONTEND, rel), "utf-8");
const bacaRepo = (rel: string) => readFileSync(join(ROOT_REPO, rel), "utf-8");

// Konstanta persona layanan ML (backend/app/services/assistant.py),
// dikutip di sini sebagai kontrak lintas-stack: bila salah satu sisi
// berganti nama, test ini menyala lebih dulu.
const ASSISTANT_NAME = "OSCAR";
const ASSISTANT_FULL_NAME = "Online Shop Center for Assistance & Response";
const ASSISTANT_CREATOR = "Dearly Febriano Irwansyah";

describe("persona OSCAR, frontend dan layanan ML seirama", () => {
  it("layanan ML: nama dan singkatan resmi OSCAR", () => {
    const otak = bacaRepo("backend/app/services/assistant.py");
    expect(otak).toContain(`ASSISTANT_NAME = "OSCAR"`);
    expect(otak).toContain(ASSISTANT_FULL_NAME);
    expect(otak).toContain(`ASSISTANT_CREATOR = "${ASSISTANT_CREATOR}"`);
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

  it("aturan privasi tetap hidup di system prompt layanan ML", () => {
    const otak = bacaRepo("backend/app/services/assistant.py");
    expect(otak).toContain("Privasi per-owner");
  });

  it("layanan ML menolak jujur saat AI tidak aktif (Mode Data mati)", () => {
    const rute = bacaRepo("backend/app/api/routes/assistant.py");
    expect(rute).not.toContain("build_offline_answer");
    expect(rute).toContain("status_code=503");
    expect(rute).toContain("status_code=502");
  });
});

describe("lib/assistant.ts, kontrak klien sisi-server", () => {
  it("alamat layanan ML dan kunci internal hanya hidup di server", () => {
    const lib = baca("lib/assistant.ts");
    expect(lib).toContain('process.env.BACKEND_URL ?? "http://127.0.0.1:8000"');
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

  it("uji sambungan meneruskan hasil mentah layanan ML", () => {
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

describe("uji sambungan LLM, lintas-stack sampai layanan ML", () => {
  it("layanan uji mandiri ada dan menyuntik klien serta konfigurasi", () => {
    const uji = bacaRepo("backend/app/services/llm_selftest.py");
    expect(uji).toContain("async def run_selftest(");
    expect(uji).toContain("klien: Any | None = None");
    expect(uji).toContain("cfg: dict[str, Any] | None = None");
    expect(uji).toContain("UJI_PROMPT");
  });

  it("kunci hanya keluar dalam bentuk dimasker (aturan 11 v2.7.0)", () => {
    const uji = bacaRepo("backend/app/services/llm_selftest.py");
    expect(uji).toContain("mask_key(cfg.get(\"api_key\")");
    expect(uji).toContain('"api_key_masked"');
  });

  it("endpoint POST /llm-selftest ber-gerbang X-Internal-Key", () => {
    const routes = bacaRepo("backend/app/api/routes/assistant.py");
    expect(routes).toContain('@router.post("/llm-selftest")');
    expect(routes).toContain("await require_internal_key(request)");
    expect(routes).toContain("llm_selftest as uji");
  });

  it("tes backend uji mandiri hadir dan menyuntik cfg eksplisit", () => {
    const tes = bacaRepo("backend/tests/test_llm_selftest.py");
    expect(tes).toContain("klien=KlienStub");
    expect(tes).toContain("cfg=CFG_AI");
    expect(tes).toContain('"gsk_****unci"');
    expect(tes).toContain("test_belum_dikonfigurasi");
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
