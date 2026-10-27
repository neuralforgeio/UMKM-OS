import { auth } from "@/lib/auth";
import { getAssistantHistory } from "@/lib/assistant";

// Riwayat percakapan asisten untuk panel (frontend v2.4.0).
// Sama seperti pintu chat: sesi diperiksa di sini, user_id Go numerik
// dikirim ke layanan ML dengan X-Internal-Key internal.

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
      { detail: "Asisten hanya untuk pemilik (owner)." },
      { status: 403 },
    );
  }

  const userId = Number(session.user.id);
  if (!Number.isFinite(userId) || userId < 1) {
    return Response.json({ detail: "Identitas sesi tidak sah." }, { status: 401 });
  }

  const riwayat = await getAssistantHistory(userId, 20);
  // null = layanan ML tidak terjangkau: panel memulai kosong, bukan
  // error keras — pemilik tetap bisa bertanya (jawaban baru tetap
  // dibuat dan disimpan layanan ML).
  return Response.json(riwayat ?? { messages: [], total: 0 }, {
    headers: { "Cache-Control": "no-store" },
  });
}
