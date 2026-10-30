"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Loader2,
  Save,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

// Form Pengaturan -> Asisten AI (frontend v2.5.0).
//
// Mengaktifkan "Mode AI" tanpa menyentuh .env / restart container:
// pengaturan tersimpan di volume ml-service (llm_config.json) lewat
// route handler /api/assistant/llm-config dan langsung berlaku untuk
// chat BERIKUTNYA. Kunci penyedia tidak pernah kembali ke browser —
// kolom kunci sengaja menampilkan versi dimasker saja.

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

const inputClass =
  "glass-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition";

export function AssistantAiForm() {
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
  const [hasil, setHasil] = useState<HasilSimpan | null>(null);

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
        // pengaturan tak terbaca — form tetap bisa mengisi ulang
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
      // supaya tsc menangkap salah-ketik properti (pelajaran run-1
      // v2.5.0: llm_model/api_key_masked lolos gerbang sandbox).
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
            isi.detail ?? "Gagal menyimpan — periksa isian lalu coba lagi.",
        });
      } else {
        setHasil({
          ok: true,
          message:
            isi.mode === "ai"
              ? "Tersimpan — Mode AI aktif. Jawaban asisten kini dibuat LLM."
              : "Tersimpan — asisten berjalan dalam Mode Data.",
          mode: isi.mode,
          llmModel: isi.llm_model ?? null,
        });
        setModeAwal(isi.mode ?? "data");
        setModelAwal(isi.llm_model ?? null);
        setSumber("file");
        setMaskedKey(isi.api_key_masked ?? maskedKey);
        setConfig((c) => ({ ...c, apiKey: "" }));
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

  if (memuat) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat pengaturan…
      </div>
    );
  }

  const modeAi = hasil?.mode ?? modeAwal;

  return (
    <div className="space-y-4">
      {/* Status saat ini */}
      <div className="flex flex-wrap items-center gap-2">
        {modeAi === "ai" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" /> Mode AI aktif
            {hasil?.llmModel || modelAwal ? ` · ${hasil?.llmModel ?? modelAwal}` : ""}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-700/60 dark:text-slate-300">
            Mode Data — asisten menjawab dari data warung tanpa LLM
          </span>
        )}
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          sumber pengaturan:{" "}
          {sumber === "file" ? "form ini (volume server)" : ".env / compose"}
        </span>
      </div>

      {/* Saklar aktif */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white/60 p-3.5 dark:border-slate-700 dark:bg-slate-900/50">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) =>
            setConfig((c) => ({ ...c, enabled: e.target.checked }))
          }
          className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
          aria-label="Aktifkan Mode AI"
        />
        <span className="text-sm">
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            Aktifkan Mode AI
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Centang untuk memakai LLM (jawaban lebih pintar memahami bahasa
            bebas). Tanpa LLM, asisten tetap menjawab dari data warung
            (Mode Data).
          </span>
        </span>
      </label>

      <div>
        <label
          htmlFor="llm-base-url"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Base URL penyedia (OpenAI-compatible)
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
        <p className="mt-1 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          Contoh: Groq (https://api.groq.com/openai/v1), OpenAI
          (https://api.openai.com/v1), OpenRouter, atau Ollama lokal
          (http://host.docker.internal:11434/v1 — tanpa kunci).
        </p>
      </div>

      <div>
        <label
          htmlFor="llm-api-key"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          API key (opsional untuk Ollama)
        </label>
        <input
          id="llm-api-key"
          type="password"
          value={config.apiKey}
          onChange={(e) =>
            setConfig((c) => ({ ...c, apiKey: e.target.value }))
          }
          maxLength={200}
          placeholder={maskedKey ? `tersimpan: ${maskedKey}` : "gsk_…"}
          className={inputClass}
          autoComplete="off"
        />
        <p className="mt-1 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          Kunci disimpan HANYA di server (volume docker), tidak pernah
          dikirim ke browser. Kosongkan untuk memakai kunci yang sudah
          tersimpan.
        </p>
      </div>

      <div>
        <label
          htmlFor="llm-model"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
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
          placeholder="llama-3.3-70b-versatile"
          className={inputClass}
        />
        <p className="mt-1 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          Contoh: llama-3.3-70b-versatile (Groq), gpt-4o-mini (OpenAI),
          llama3.1 (Ollama).
        </p>
      </div>

      {hasil && (
        <p
          className={
            hasil.ok
              ? "flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400"
              : "flex items-center gap-1.5 text-sm font-medium text-rose-600"
          }
        >
          {hasil.ok ? (
            <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
          ) : (
            <TriangleAlert className="h-4 w-4 shrink-0" />
          )}
          {hasil.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={simpan}
          disabled={menyimpan}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
        >
          {menyimpan ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Simpan Pengaturan AI
        </button>
        <span className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
          Berlaku langsung tanpa restart — jawaban berikutnya sudah memakai
          pengaturan baru. Gagal koneksi penyedia? Asisten otomatis jatuh
          ke Mode Data, tidak pernah tumbang.
        </span>
      </div>
    </div>
  );
}
