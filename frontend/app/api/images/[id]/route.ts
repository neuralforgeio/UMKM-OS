// Proxy foto produk ke backend-go. URL-nya TETAH /api/images/{id} — sama
// dengan era sebelumnya — sehingga tidak ada satu pun komponen client
// yang perlu berubah; header cache "immutable" juga dipertahankan
// (edit foto selalu membuat baris baru, id tidak pernah dipakai ulang).
const API_URL = process.env.API_URL ?? "http://localhost:8080";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Id foto era backend-go berupa angka; id UUID lama langsung 404.
  if (!/^\d+$/.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  let upstream: Response | null = null;
  try {
    upstream = await fetch(`${API_URL}/api/v1/images/${id}`, {
      cache: "no-store",
    });
  } catch {
    upstream = null;
  }
  if (!upstream || !upstream.ok) {
    return new Response("Not found", { status: 404 });
  }

  const bytes = new Uint8Array(await upstream.arrayBuffer());
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
