import { auth } from "@/lib/auth";
import {
  AssistantError,
  getAssistantLlmConfig,
  putAssistantLlmConfig,
} from "@/lib/assistant";

// Pintu pengaturan LLM asisten (frontend v2.5.0) — hanya OWNER &
// DEVELOPER. KASIR ditolak: mengubah kunci penyedia AI adalah urusan
// pemilik warung, bukan operator kasir.
//
// Validasi input terjadi DI SINI (pintu terdepan) DAN sekali lagi di
// layanan ML — keduanya menolak dengan 422 + pesan Indonesia. Kunci
// penyedia tidak pernah dikirim balik ke browser: GET hanya mengembalikan
// versi dimasker dari ml-service.

export async function GET() {
  const session = await auth();
  if (!session?.user?.goToken || !session.user.id) {
    return Response.json(
      { detail: "Sesi tidak valid — masuk kembali." },
      { status: 401 },
    );
  }
  if (session.user.role === "KASIR") {
    return Response.json(
      { detail: "Pengaturan asisten hanya untuk pemilik (owner)." },
      { status: 403 },
    );
  }

  try {
    const config = await getAssistantLlmConfig();
    return Response.json(config, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const status = err instanceof AssistantError ? err.status : 502;
    const detail =
      err instanceof AssistantError
        ? err.message
        : "Pengaturan asisten tidak terbaca.";
    return Response.json({ detail }, { status });
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.goToken || !session.user.id) {
    return Response.json(
      { detail: "Sesi tidak valid — masuk kembali." },
      { status: 401 },
    );
  }
  if (session.user.role === "KASIR") {
    return Response.json(
      { detail: "Pengaturan asisten hanya untuk pemilik (owner)." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { detail: "Permintaan tidak valid." },
      { status: 400 },
    );
  }
  const isi = (body ?? {}) as Record<string, unknown>;
  const enabled = isi.enabled === true;
  const baseUrl =
    typeof isi.base_url === "string" ? isi.base_url.trim().slice(0, 200) : "";
  const apiKey =
    typeof isi.api_key === "string" ? isi.api_key.trim().slice(0, 200) : "";
  const model =
    typeof isi.model === "string" ? isi.model.trim().slice(0, 100) : "";

  if (enabled) {
    if (!/^https?:\/\//.test(baseUrl)) {
      return Response.json(
        {
          detail:
            "Base URL harus berawalan http:// atau https:// (contoh: https://api.groq.com/openai/v1).",
        },
        { status: 422 },
      );
    }
    if (!model) {
      return Response.json(
        {
          detail:
            "Nama model wajib diisi (contoh: llama-3.3-70b-versatile).",
        },
        { status: 422 },
      );
    }
  }

  try {
    const config = await putAssistantLlmConfig({
      enabled,
      base_url: baseUrl,
      api_key: apiKey,
      model,
    });
    return Response.json(config, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const status = err instanceof AssistantError ? err.status : 502;
    const detail =
      err instanceof AssistantError
        ? err.message
        : "Gagal menyimpan pengaturan asisten.";
    return Response.json({ detail }, { status });
  }
}
