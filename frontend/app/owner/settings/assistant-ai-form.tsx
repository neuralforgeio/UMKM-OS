"use client";

// Form Pengaturan -> Asisten AI (UMKM OS v1.0.0).
//
// Mengaktifkan "Mode AI" tanpa menyentuh .env / restart container:
// pengaturan tersimpan di volume ml-service (llm_config.json) lewat
// route handler /api/assistant/llm-config dan langsung berlaku untuk
// obrolan BERIKUTNYA. Kunci penyedia tidak pernah kembali ke browser, // kolom kunci sengaja hanya menampilkan versi dimasker.
//
// BARU v1.0.0: tombol "Tes Koneksi" memanggil /api/assistant/llm-selftest
// sehingga pemilik bisa MEMBUKTIKAN kunci dan model benar benar hidup
// (latensi + contoh jawaban dari penyedia) sebelum mengandalkan OSCAR.

import { useEffect, useState } from "react";
import {
  Check,
  Loader2,
  PlugZap,
  Save,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { UiAlert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { log } from "@/lib/ui/log";

interface LlmConfigState {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface HasilSimpan {
  ok: boolean;
  message: string;
  mode?: "ai" | "data";
  llmModel?: string | null;
}

interface HasilUji {
  ok: boolean;
  message: string;
}

const inputClass =
  "mt-1.5 w-full rounded-xl border border-shell-line bg-shell-card px-3.5 py-2.5 text-sm text-shell-ink outline-none transition placeholder:text-shell-muted focus:border-shell-primary";

export function AssistantAiForm() {
  const toast = useToast();
  const [config, setConfig] = useState<LlmConfigState>({
    enabled: true,
    baseUrl: "",
    apiKey: "",
    model: "",
  });
  const [maskedKey, setMaskedKey] = useState("");
  const [modeAwal, setModeAwal] = useState<"ai" | "data">("data");
  const [modelAwal, setModelAwal] = useState<string | null>(null);
  const [sumber, setSumber] = useState<"file" | "env">("env");
  const [memuat, setMemuat] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [menguji, setMenguji] = useState(false);
  const [hasil, setHasil] = useState<HasilSimpan | null>(null);
  const [hasilUji, setHasilUji] = useState<HasilUji | null>(null);

  useEffect(() => {
    let hidup = true;
    (async () => {
      try {
        const res = await fetch("/api/assistant/llm-config", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const isi = (await res.json()) as {
          enabled?: boolean;
          base_url?: string;
          model?: string;
          api_key_masked?: string;
          source?: "file" | "env";
          mode?: "ai" | "data";
          llm_model?: string | null;
        };
        if (!hidup) return;
        setConfig({
          enabled: isi.enabled ?? true,
          baseUrl: isi.base_url ?? "",
          apiKey: "",
          model: isi.model ?? "",
        });
        setMaskedKey(isi.api_key_masked ?? "");
        setModeAwal(isi.mode ?? "data");
        setModelAwal(isi.llm_model ?? null);
        setSumber(isi.source ?? "env");
      } catch {
        // pengaturan tak terbaca, form tetap bisa mengisi ulang
      } finally {
        if (hidup) setMemuat(false);
      }
    })();
    return () => {
      hidup = false;
    };
  }, []);

  async function simpan() {
    if (menyimpan) return;
    setMenyimpan(true);
    setHasil(null);
    try {
      const res = await fetch("/api/assistant/llm-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: config.enabled,
          base_url: config.baseUrl,
          api_key: config.apiKey,
          model: config.model,
        }),
      });
      // Bentuk respons PUT = LlmConfigOut ml-service (snake_case) +
      // `detail` galat 422/5xx dari route handler. Diketik EKSPLISIT
      // supaya tsc menangkap salah ketik properti.
      const isi = (await res.json()) as {
        detail?: string;
        mode?: "ai" | "data";
        llm_model?: string | null;
        api_key_masked?: string;
      };
      if (!res.ok) {
        setHasil({
          ok: false,
          message:
            isi.detail ?? "Gagal menyimpan. Periksa isian lalu coba lagi.",
        });
        toast.show({ variant: "galat", message: "Pengaturan AI gagal disimpan." });
      } else {
        setHasil({
          ok: true,
          message:
            isi.mode === "ai"
              ? "Tersimpan. Mode AI aktif dan jawaban asisten kini dibuat model bahasa."
              : "Tersimpan. Asisten berjalan dalam Mode Data.",
          mode: isi.mode,
          llmModel: isi.llm_model ?? null,
        });
        setModeAwal(isi.mode ?? "data");
        setModelAwal(isi.llm_model ?? null);
        setSumber("file");
        setMaskedKey(isi.api_key_masked ?? maskedKey);
        setConfig((c) => ({ ...c, apiKey: "" }));
        toast.show({
          variant: "sukses",
          message: "Pengaturan asisten AI tersimpan.",
        });
        log.sukses("asisten", "pengaturan LLM tersimpan dari form pengaturan");
      }
    } catch {
      setHasil({
        ok: false,
        message: "Koneksi ke layanan asisten terputus. Coba lagi.",
      });
    } finally {
      setMenyimpan(false);
    }
  }

  async function ujiKoneksi() {
    if (menguji) return;
    setMenguji(true);
    setHasilUji(null);
    try {
      const res = await fetch("/api/assistant/llm-selftest", {
        method: "POST",
        cache: "no-store",
      });
      const isi = (await res.json()) as {
        detail?: string;
        ok?: boolean;
        configured?: boolean;
        mode?: "ai" | "data";
        answer_sample?: string | null;
        latency_ms?: number | null;
        error?: string | null;
        model?: string;
        api_key_masked?: string;
      };
      if (!res.ok || typeof isi.ok !== "boolean") {
        setHasilUji({
          ok: false,
          message: isi.detail ?? "Uji sambungan gagal dijalankan.",
        });
        toast.show({ variant: "galat", message: "Uji sambungan gagal." });
        return;
      }
      if (isi.ok) {
        const contoh = isi.answer_sample ? ` Jawaban contoh: "${isi.answer_sample}"` : "";
        setHasilUji({
          ok: true,
          message: `Sambungan sehat. Penyedia menjawab dalam ${isi.latency_ms ?? "?"} ms dengan model ${isi.model ?? "?"}.${contoh}`,
        });
        toast.show({
          variant: "sukses",
          message: "Mode AI terhubung ke penyedia LLM.",
        });
        log.sukses("asisten", "uji sambungan LLM sehat", { model: isi.model });
      } else {
        setHasilUji({
          ok: false,
          message:
            isi.error ??
            "Sambungan belum berhasil. Periksa saklar, URL dasar, nama model, dan kunci.",
        });
        toast.show({ variant: "peringatan", message: "Uji sambungan belum berhasil." });
        log.peringatan("asisten", "uji sambungan LLM gagal", { error: isi.error });
      }
    } catch {
      setHasilUji({
        ok: false,
        message: "Koneksi ke layanan asisten terputus. Coba lagi.",
      });
    } finally {
      setMenguji(false);
    }
  }

  if (memuat) {
    return (
      <div className="flex items-center gap-2 text-xs text-shell-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat pengaturan
      </div>
    );
  }

  const modeAi = hasil?.mode ?? modeAwal;

  return (
    <div className="space-y-4">
      {/* Status saat ini */}
      <div className="flex flex-wrap items-center gap-2">
        {modeAi === "ai" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-shell-ok/12 px-3 py-1 text-[11px] font-bold text-shell-ok">
            <Sparkles className="h-3.5 w-3.5" /> Mode AI aktif
            {hasil?.llmModel || modelAwal
              ? ` · ${hasil?.llmModel ?? modelAwal}`
              : ""}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-shell-soft px-3 py-1 text-[11px] font-bold text-shell-muted">
            Mode Data. Asisten menjawab dari data warung tanpa model bahasa.
          </span>
        )}
        <span className="text-[10px] text-shell-muted">
          sumber pengaturan:{" "}
          {sumber === "file" ? "form ini (volume server)" : "berkas lingkungan"}
        </span>
      </div>

      {/* Saklar aktif */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-shell-line bg-shell-soft p-3.5">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) =>
            setConfig((c) => ({ ...c, enabled: e.target.checked }))
          }
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--shell-primary)]"
          aria-label="Aktifkan Mode AI"
        />
        <span className="text-sm">
          <span className="font-semibold text-shell-ink">
            Aktifkan Mode AI
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-shell-muted">
            Centang untuk memakai model bahasa (jawaban lebih luas memahami
            bahasa bebas). Tanpa model, asisten tetap menjawab dari data
            warung (Mode Data).
          </span>
        </span>
      </label>

      <div>
        <label
          htmlFor="llm-base-url"
          className="block text-sm font-medium text-shell-ink-soft"
        >
          URL dasar penyedia (standar OpenAI compatible)
        </label>
        <input
          id="llm-base-url"
          value={config.baseUrl}
          onChange={(e) =>
            setConfig((c) => ({ ...c, baseUrl: e.target.value }))
          }
          maxLength={200}
          placeholder="https://api.groq.com/openai/v1"
          className={inputClass}
        />
        <p className="mt-1 text-xs leading-relaxed text-shell-muted">
          Contoh: Groq (https://api.groq.com/openai/v1), OpenAI
          (https://api.openai.com/v1), OpenRouter, atau Ollama lokal
          (http://host.docker.internal:11434/v1, tanpa kunci).
        </p>
      </div>

      <div>
        <label
          htmlFor="llm-api-key"
          className="block text-sm font-medium text-shell-ink-soft"
        >
          Kunci API (opsional untuk Ollama)
        </label>
        <input
          id="llm-api-key"
          type="password"
          value={config.apiKey}
          onChange={(e) =>
            setConfig((c) => ({ ...c, apiKey: e.target.value }))
          }
          maxLength={200}
          placeholder={maskedKey ? `tersimpan: ${maskedKey}` : "gsk_ contoh kunci"}
          className={inputClass}
          autoComplete="off"
        />
        <p className="mt-1 text-xs leading-relaxed text-shell-muted">
          Kunci disimpan HANYA di server (volume docker) dan tidak pernah
          dikirim utuh ke browser. Kosongkan untuk memakai kunci yang sudah
          tersimpan.
        </p>
      </div>

      <div>
        <label
          htmlFor="llm-model"
          className="block text-sm font-medium text-shell-ink-soft"
        >
          Nama model
        </label>
        <input
          id="llm-model"
          value={config.model}
          onChange={(e) =>
            setConfig((c) => ({ ...c, model: e.target.value }))
          }
          maxLength={100}
          placeholder="openai/gpt-oss-20b"
          className={inputClass}
        />
        <p className="mt-1 text-xs leading-relaxed text-shell-muted">
          Contoh: openai/gpt-oss-20b (Groq), llama-3.3-70b-versatile (Groq),
          gpt-4o-mini (OpenAI), llama3.1 (Ollama).
        </p>
      </div>

      {hasil && (
        <UiAlert variant={hasil.ok ? "sukses" : "peringatan"}>
          <span className="inline-flex items-center gap-1.5">
            {hasil.ok ? (
              <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
            ) : (
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            )}
            {hasil.message}
          </span>
        </UiAlert>
      )}

      {hasilUji && (
        <UiAlert variant={hasilUji.ok ? "sukses" : "galat"} title="Hasil Tes Koneksi">
          {hasilUji.message}
        </UiAlert>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={simpan}
          disabled={menyimpan}
          className="inline-flex items-center gap-2 rounded-xl bg-shell-primary px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-shell-primary/25 transition hover:bg-shell-primary-strong disabled:opacity-60"
        >
          {menyimpan ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Simpan Pengaturan AI
        </button>
        <button
          type="button"
          onClick={ujiKoneksi}
          disabled={menguji}
          className="inline-flex items-center gap-2 rounded-xl border border-shell-line bg-shell-card px-4 py-2.5 text-xs font-bold text-shell-ink-soft transition hover:border-shell-primary/50 hover:text-shell-primary-strong disabled:opacity-60"
        >
          {menguji ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PlugZap className="h-4 w-4" />
          )}
          Tes Koneksi
        </button>
        <span className="text-[10px] leading-relaxed text-shell-muted">
          Simpan berlaku langsung tanpa restart; jawaban berikutnya sudah
          memakai pengaturan baru. Bila penyedia gagal dijawab, asisten
          otomatis jatuh ke Mode Data dan tidak pernah tumbang.
        </span>
      </div>
    </div>
  );
}
