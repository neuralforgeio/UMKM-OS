import { prisma } from "@/lib/prisma";

// Serves the uploaded UMKM logo. Unlike product photos (immutable ids),
// this row's bytes change in place, so caching is short and the URL
// carries ?v=<logoVersion> — every upload bumps the version and every
// consumer (receipt, POS header, favicon) gets a fresh URL instantly.
// Single-outlet demo: the first outlet owns the branding; a query
// param can select others once multi-outlet lands.
export async function GET(request: Request) {
  const outlet = await prisma.outlet.findFirst({
    select: { logoData: true, logoMimeType: true, logoVersion: true },
  });
  if (!outlet?.logoData) {
    // No logo yet: send browsers back to the default icon so the tab
    // keeps a proper favicon instead of a 404.
    return Response.redirect(new URL("/favicon.ico", request.url), 307);
  }
  const bytes = new Uint8Array(outlet.logoData);
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": outlet.logoMimeType || "image/png",
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=3600, must-revalidate",
    },
  });
}
