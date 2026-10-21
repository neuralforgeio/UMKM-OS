import { prisma } from "@/lib/prisma";

// Streams one product photo from the database. Ids are UUIDs whose bytes
// never change (an edit is always a new row), so responses are immutable
// and safe to cache forever — the POS grid and product table can then
// reuse the browser cache instead of re-hitting the database.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const image = await prisma.productImage.findUnique({
    where: { id },
    select: { data: true, mimeType: true },
  });
  if (!image) {
    return new Response("Not found", { status: 404 });
  }

  // Prisma Bytes is a Uint8Array already — a valid Response body.
  const bytes = new Uint8Array(image.data);

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": image.mimeType || "image/jpeg",
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
