import { auth } from "@/lib/auth";
import { getOutletContext } from "@/lib/outlet-context";
import {
  AssistantError,
  postAssistantChat,
} from "@/lib/assistant";

// Pintu chat Asisten AI (frontend v2.4.0) — hanya OWNER & DEVELOPER.
//
// Sesi diperiksa DI SINI (bukan di layanan ML): user_id numerik Go
// dikirim bersama pertanyaan + outlet_id identitas konteks, dilindungi
// X-Internal-Key di jaringan internal docker. KASIR ditolak dengan
// jelas — asisten bicara omzet & strategi, urusan pemilik.

export async function POST(request: Request) {
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

  let question = "";
  try {
    const body = (await request.json()) as { question?: unknown };
    if (typeof body.question === "string") {
      question = body.question.trim().slice(0, 500);
    }
  } catch {
    return Response.json({ detail: "Permintaan tidak valid." }, { status: 400 });
  }
  if (!question) {
    return Response.json(
      { detail: "Tulis pertanyaannya dulu." },
      { status: 400 },
    );
  }

  // Outlet sesi (pemilik multi-outlet bertanya tentang outletnya).
  const outlet = await getOutletContext();
  const userId = Number(session.user.id);
  if (!Number.isFinite(userId) || userId < 1) {
    return Response.json({ detail: "Identitas sesi tidak sah." }, { status: 401 });
  }

  try {
    const hasil = await postAssistantChat(
      userId,
      question,
      outlet?.id,
    );
    return Response.json(hasil, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const status = err instanceof AssistantError ? err.status : 502;
    const detail =
      err instanceof AssistantError
        ? err.message
        : "Asisten sedang tidak bisa menjawab.";
    return Response.json({ detail }, { status });
  }
}
