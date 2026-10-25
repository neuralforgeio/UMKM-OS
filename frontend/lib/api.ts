// Jembatan server-side ke backend-go: satu tempat untuk URL, header
// Authorization Bearer, dan pembukaan envelope respons yang konsisten.
// Dipakai server component & server action — token selalu berasal dari
// sesi (session.user.goToken), tidak pernah dari browser.

import { cookies } from "next/headers";

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

// Header tambahan yang bisa diteruskan ke backend-go. Dipakai aksi
// publik (goPublic) supaya jejak anti-fraud di handover_events mencatat
// perangkat + IP PEMBELI asli, bukan User-Agent/IP server Next yang
// tidak mengatakan apa-apa.
export type GoInit = {
  method?: string;
  body?: string | FormData;
  headers?: Record<string, string>;
};

async function goRequest<T>(
  path: string,
  init: GoInit | undefined,
  authHeader: Record<string, string> | null,
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
        ...(authHeader ?? {}),
        ...(init?.headers ?? {}),
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

// withOutletParam (v2.0.0 multi-outlet): menempelkan ?outlet_id= ke path
// saat mode maintenance developer aktif (cookie dev_outlet berisi id
// outlet Go). Backend MENGABAIKAN parameter ini untuk OWNER/KASIR (scope
// selalu diambil dari ikatan akun di database) dan hanya memakainya
// untuk DEVELOPER — jadi menempelkannya selalu aman, tidak bisa dipakai
// pemalsuan di sisi browser untuk menyamar jadi outlet lain.
// Fungsi murni (tanpa next/headers) supaya bisa dites vitest langsung.
export function withOutletParam(path: string, devOutlet: string | null | undefined): string {
  if (!devOutlet || !/^\d+$/.test(devOutlet)) return path;
  return path + (path.includes("?") ? "&" : "?") + `outlet_id=${devOutlet}`;
}

export async function goFetch<T>(
  token: string,
  path: string,
  init?: GoInit,
): Promise<GoResult<T>> {
  let scoped = path;
  try {
    // Server action / server component selalu punya cookie store; konteks
    // lain (mis. route handler tanpa cookie) dilewati tanpa efek.
    const store = await cookies();
    scoped = withOutletParam(path, store.get("dev_outlet")?.value);
  } catch {
    // Tanpa akses cookie — kirim path apa adanya.
  }
  return goRequest<T>(scoped, init, { Authorization: `Bearer ${token}` });
}

// goPublic memanggil endpoint publik backend-go (v1.3.0): struk pembeli
// di /public/receipt/* TANPA header Authorization — kode klaim adalah
// satu-satunya kunci. Aksi publik HARUS meneruskan User-Agent +
// X-Forwarded-For dari request browser via init.headers supaya jejak
// perangkat pembeli tetap tercatat di sisi Go (r.UserAgent() dan
// middleware.ClientIP membacanya dari request yang sampai ke Go).
export async function goPublic<T>(
  path: string,
  init?: GoInit,
): Promise<GoResult<T>> {
  return goRequest<T>(path, init, null);
}
