import { auth } from "@/lib/auth";
import { API_BASE } from "@/lib/api";

// Sajikan FOTO PROFIL pengguna yang sedang login (v2.2.0).
//
// Berbeda dari logo outlet & foto produk (publik karena struk membacanya
// tanpa login), foto wajah staf bersifat PRIBADI: hanya pemilik sesi yang
// boleh melihatnya. Alur: <img> navbar memuat /api/user/photo?v=N (cookie
// sesi ikut otomatis) -> route ini memeriksa sesi -> mem-proxy byte dari
// GET /api/v1/me/photo milik Go dengan Bearer token -> hanya foto
// PEMANGGIL yang pernah tersaji. Foto orang lain tidak bisa diminta
// lewat pintu ini, dan browser tidak pernah tahu alamat internal Go.
//
// ?v= diteruskan ke Go: versi = cache immutable panjang; tanpa versi
// cache pendek supaya foto baru cepat terlihat.
export async function GET(request: Request) {
  const session = await auth();
  const token = session?.user?.goToken;
  if (!token) {
    return new Response("Sesi tidak valid", { status: 401 });
  }

  const version = new URL(request.url).searchParams.get("v");
  const goRes = await fetch(
    `${API_BASE}/me/photo${version ? `?v=${encodeURIComponent(version)}` : ""}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  // 404 dari Go = foto belum/tidak lagi ada — UserAvatar di sisi client
  // sudah punya fallback inisial, jadi cukup dilempar apa adanya.
  if (!goRes.ok || !goRes.body) {
    return new Response("Foto profil tidak tersedia", { status: 404 });
  }

  return new Response(goRes.body, {
    status: 200,
    headers: {
      "Content-Type": goRes.headers.get("Content-Type") ?? "image/png",
      // private: hanya milik sesi ini — tidak boleh di-cache proxy bersama.
      "Cache-Control": "private, max-age=3600, must-revalidate",
    },
  });
}
