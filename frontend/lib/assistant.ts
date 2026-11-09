// Klien sisi-server untuk Asisten AI OSCAR (era Go murni, frontend 1.3.0).
//
// BACKEND_URL & INTERNAL_API_KEY adalah env SERVER-ONLY (tanpa awalan
// NEXT_PUBLIC_): browser tidak pernah memanggil backend langsung, // semua permintaan lewat route handler /api/assistant/* yang sudah
// memeriksa sesi NextAuth. X-Internal-Key (blueprint BAB 5.4) hanya
// dipakai ANTAR layanan di jaringan internal docker.
//
// ERA GO MURNI: BACKEND_URL kini menunjuk backend Go (:8080) — kontrak
// JSON persis sama dengan era ml-service Python, hanya rumahnya yang
// pindah. PUT llm-config membawa header X-Acting-Role dari sesi supaya
// backend bisa menolak pemilik saat model dikunci developer.
//
// Berbeda dari lib/forecast.ts yang di-cache 15 menit, chat HARUS
// segar (jawaban + riwayat bergerak) => cache: "no-store".

const BASE_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8080";
const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? "";

function internalHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (INTERNAL_KEY) {
    headers["X-Internal-Key"] = INTERNAL_KEY;
  }
  return headers;
}

// Kontrak ChatResponse era Go murni (internal/handler/assistant.go).
export interface AssistantChatResponse {
  answer: string;
  mode: "ai" | "data";
  intent: string;
  period: string;
  numbers_validated: boolean;
  cached: boolean;
  retried: boolean;
  engine: string;
  outlet_id: string;
  outlet_name: string;
}

export interface AssistantHistoryMessage {
  role: "USER" | "ASSISTANT";
  content: string;
  created_at: string;
}

export interface AssistantHistoryResponse {
  messages: AssistantHistoryMessage[];
  total: number;
}

export interface AssistantStatus {
  version: string;
  llm_configured: boolean;
  llm_model: string | null;
  mode: "ai" | "data";
  rate_limit_per_hour: number;
  cache_seconds: number;
}

export class AssistantError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function postAssistantChat(
  userId: number,
  question: string,
  outletId?: number): Promise<AssistantChatResponse> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/v1/assistant/chat`, {
      method: "POST",
      headers: internalHeaders(),
      cache: "no-store",
      body: JSON.stringify({
        user_id: userId,
        question,
        ...(outletId != null && Number.isFinite(outletId)
          ? { outlet_id: String(outletId) }
          : {}),
      }),
    });
  } catch {
    // Jaringan/layanan ML tumbang, pesan ramah untuk pemilik warung.
    throw new AssistantError(
      "Layanan asisten tidak terjangkau. Coba beberapa saat lagi.",
      502);
  }
  if (!res.ok) {
    const isi = (await res.json().catch(() => null)) as
      | { detail?: string }
      | null;
    throw new AssistantError(
      isi?.detail ?? "Asisten sedang tidak bisa menjawab.",
      res.status);
  }
  return (await res.json()) as AssistantChatResponse;
}

export async function getAssistantHistory(
  userId: number,
  limit = 20): Promise<AssistantHistoryResponse | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/api/v1/assistant/history?user_id=${userId}&limit=${limit}`,
      { headers: internalHeaders(), cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as AssistantHistoryResponse;
  } catch {
    return null; // riwayat opsional, panel tetap hidup tanpanya
  }
}

// ----------------------------------------------------------------------
// Pengaturan LLM runtime (frontend v2.5.0), UI Pengaturan -> Asisten AI.
// Konfigurasi tersimpan di volume aidata (menimpa env compose) dan
// langsung berlaku tanpa restart container; kunci TIDAK PERNAH dikirim
// balik ke browser utuh (hanya versi dimasker).
// ----------------------------------------------------------------------
export interface AssistantLlmConfig {
  enabled: boolean;
  base_url: string;
  model: string;
  api_key_masked: string;
  source: "file" | "env";
  llm_configured: boolean;
  llm_model: string | null;
  mode: "ai" | "data";
  // Era Go murni: true = pilihan model dikunci developer; PUT dari
  // pemilik akan ditolak 403 sampai kunci dibuka.
  model_locked: boolean;
}

export interface AssistantLlmConfigInput {
  enabled: boolean;
  base_url: string;
  api_key: string;
  model: string;
}

export async function getAssistantLlmConfig(): Promise<AssistantLlmConfig> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/v1/assistant/llm-config`, {
      headers: internalHeaders(),
      cache: "no-store",
    });
  } catch {
    throw new AssistantError(
      "Layanan asisten tidak terjangkau. Coba beberapa saat lagi.",
      502);
  }
  if (!res.ok) {
    const isi = (await res.json().catch(() => null)) as
      | { detail?: string }
      | null;
    throw new AssistantError(
      isi?.detail ?? "Gagal membaca pengaturan asisten.",
      res.status);
  }
  return (await res.json()) as AssistantLlmConfig;
}

export async function putAssistantLlmConfig(
  config: AssistantLlmConfigInput,
  actingRole: string,
): Promise<AssistantLlmConfig> {
  let res: Response;
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (INTERNAL_KEY) {
      headers["X-Internal-Key"] = INTERNAL_KEY;
    }
    // Peran pelaku dari sesi (OWNER/DEVELOPER) — dipakai backend untuk
    // menolak pemilik saat model dikunci developer (era Go murni).
    if (actingRole) {
      headers["X-Acting-Role"] = actingRole;
    }
    res = await fetch(`${BASE_URL}/api/v1/assistant/llm-config`, {
      method: "PUT",
      headers,
      cache: "no-store",
      body: JSON.stringify(config),
    });
  } catch {
    throw new AssistantError(
      "Layanan asisten tidak terjangkau. Coba beberapa saat lagi.",
      502);
  }
  if (!res.ok) {
    const isi = (await res.json().catch(() => null)) as
      | { detail?: string }
      | null;
    throw new AssistantError(
      isi?.detail ?? "Gagal menyimpan pengaturan asisten.",
      res.status);
  }
  return (await res.json()) as AssistantLlmConfig;
}

// ----------------------------------------------------------------------
// Uji sambungan LLM (frontend v1.0.0), tombol "Tes Koneksi" di
// Pengaturan -> Asisten AI. Route handler /api/assistant/llm-selftest
// memanggil layanan ML yang kemudian MENYAPA penyedia sungguhan dengan
// konfigurasi efektif saat itu; hasilnya (latensi, contoh jawaban,
// kunci termasker) kembali ke pengaturan tanpa pernah membocorkan
// kunci utuhnya.
// ----------------------------------------------------------------------
export interface AssistantLlmSelftest {
  ok: boolean;
  configured: boolean;
  mode: "ai" | "data";
  answer_sample: string | null;
  latency_ms: number | null;
  error: string | null;
  model: string;
  api_key_masked: string;
  source: "file" | "env";
  base_url: string;
}

export async function postAssistantLlmSelftest(): Promise<AssistantLlmSelftest> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/v1/assistant/llm-selftest`, {
      method: "POST",
      headers: internalHeaders(),
      cache: "no-store",
    });
  } catch {
    throw new AssistantError(
      "Layanan asisten tidak terjangkau. Coba beberapa saat lagi.",
      502);
  }
  if (!res.ok) {
    const isi = (await res.json().catch(() => null)) as
      | { detail?: string }
      | null;
    throw new AssistantError(
      isi?.detail ?? "Uji sambungan asisten gagal.",
      res.status);
  }
  return (await res.json()) as AssistantLlmSelftest;
}
