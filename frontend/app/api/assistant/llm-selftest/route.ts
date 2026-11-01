import { auth } from "@/lib/auth";
import {
  AssistantError,
  postAssistantLlmSelftest,
} from "@/lib/assistant";

// Pintu uji sambungan LLM (frontend v1.0.0), hanya OWNER & DEVELOPER.
//
// Sesi diperiksa DI SINI (bukan di layanan ML): permintaan diteruskan
// ke POST /api/v1/assistant/llm-selftest dengan X-Internal-Key di
// jaringan internal docker. Layanan ML lalu menyapa penyedia LLM
// sungguhan memakai konfigurasi efektif dan melaporkan hasilnya
// (kunci hanya kembali dalam bentuk dimasker).

export async function POST() {
  const session = await auth();
  if (!session?.user?.goToken || !session.user.id) {
    return Response.json(
      { detail: "Sesi tidak valid. Silakan masuk kembali." },
      { status: 401 });
  }
  if (session.user.role === "KASIR") {
    return Response.json(
      { detail: "Pengaturan asisten hanya untuk pemilik (owner)." },
      { status: 403 });
  }

  try {
    const hasil = await postAssistantLlmSelftest();
    return Response.json(hasil, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const status = err instanceof AssistantError ? err.status : 502;
    const detail =
      err instanceof AssistantError
        ? err.message
        : "Uji sambungan asisten tidak dapat dijalankan.";
    return Response.json({ detail }, { status });
  }
}
