// Jembatan server-side ke backend-go: satu tempat untuk URL, header
// Authorization Bearer, dan pembukaan envelope respons yang konsisten.
// Dipakai server component & server action — token selalu berasal dari
// sesi (session.user.goToken), tidak pernah dari browser.

const API_URL = process.env.API_URL ?? "http://localhost:8080";

export const API_BASE = `${API_URL}/api/v1`;

// Format respons Go (backend-go/internal/handler/respond.go):
// sukses -> {"success":true,"data":...}
// gagal  -> {"success":false,"error":{"message":"..."}}
type GoEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { message: string };
};

export type GoResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

export async function goFetch<T>(
  token: string,
  path: string,
  init?: { method?: string; body?: string | FormData },
): Promise<GoResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: init?.method,
      body: init?.body,
      headers: {
        // FormData sengaja dibiarkan tanpa Content-Type supaya boundary
        // multipart terpasang otomatis oleh fetch.
        ...(typeof init?.body === "string"
          ? { "Content-Type": "application/json" }
          : {}),
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
  } catch {
    // Backend tidak terjangkau — pemanggil yang memutuskan nasibnya
    // (halaman: error; checkout: pesan gagal ke kasir).
    return { ok: false, status: 0, message: "Backend tidak merespons." };
  }

  let json: GoEnvelope<T>;
  try {
    json = (await res.json()) as GoEnvelope<T>;
  } catch {
    return {
      ok: false,
      status: res.status,
      message: "Respons backend tidak valid.",
    };
  }

  if (!res.ok || !json.success) {
    return {
      ok: false,
      status: res.status,
      message: json.error?.message ?? "Terjadi kesalahan di backend.",
    };
  }
  return { ok: true, data: json.data as T };
}
