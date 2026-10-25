import { auth } from "@/lib/auth";
import { goFetch, API_BASE } from "@/lib/api";

// Serves the uploaded UMKM logo. Unlike product photos (immutable ids),
// this row's bytes change in place, so caching is short and the URL
// carries ?v=<logoVersion> — every upload bumps the version and every
// consumer (receipt, POS header, favicon) gets a fresh URL instantly.
// v2.0.0 multi-outlet: byte logo milik backend-go (tabel outlets) —
// route ini memutuskan outlet dari SESI pemanggil (GET /my/outlet),
// lalu mem-proxy byte dari endpoint publik Go. Browser tidak pernah
// tahu alamat internal backend.
export async function GET(request: Request) {
  const session = await auth();
  const token = session?.user?.goToken;
  if (!token) {
    // Tidak ada sesi (mis. favicon di layar login) — pakai ikon bawaan
    // supaya tab tetap punya favicon, bukan 404.
    return Response.redirect(new URL("/favicon.ico", request.url), 307);
  }

  // Outlet konteks pemanggil: ikatan akun owner/kasir, atau outlet mode
  // maintenance developer (goFetch menempelkan ?outlet_id otomatis).
  const res = await goFetch<{
    id: number;
    has_logo: boolean;
    logo_version: number;
  }>(token, "/my/outlet");
  if (!res.ok || !res.data.has_logo) {
    return Response.redirect(new URL("/favicon.ico", request.url), 307);
  }

  // ?v= dari pemanggil diteruskan ke Go: versi = cache immutable panjang;
  // tanpa versi cache pendek supaya logo baru cepat terlihat.
  const version = new URL(request.url).searchParams.get("v");
  const goUrl = `${API_BASE}/outlets/${res.data.id}/logo${
    version ? `?v=${encodeURIComponent(version)}` : ""
  }`;

  const goRes = await fetch(goUrl, { cache: "no-store" });
  if (!goRes.ok || !goRes.body) {
    return Response.redirect(new URL("/favicon.ico", request.url), 307);
  }

  return new Response(goRes.body, {
    status: 200,
    headers: {
      "Content-Type": goRes.headers.get("Content-Type") ?? "image/png",
      "Cache-Control": "public, max-age=3600, must-revalidate",
    },
  });
}
