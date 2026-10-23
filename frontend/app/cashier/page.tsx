import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { goFetch } from "@/lib/api";
import { PosClient } from "./pos-client";
import type { PosProduct } from "./types";
import { getServeQueue } from "@/app/owner/verify/actions";
import { ServeQueueBar } from "@/components/serve-queue";
import { MaintenanceBanner } from "@/components/maintenance-banner";

export const instant = false;

// Bentuk produk dari backend-go (GET /api/v1/products) — hanya kolom
// yang dipakai POS yang dideklarasikan.
type GoProductImage = { id: number; is_thumb: boolean };
type GoProduct = {
  id: number;
  name: string;
  sku: string | null;
  category: string;
  price: number;
  stock: number;
  min_stock: number;
  unit: string;
  // Backend lama (pra dukungan foto) tidak mengirim field ini.
  images?: GoProductImage[];
};

export default async function CashierPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Era backend-go v1.0.0 (belum multi-outlet): akun kasir dibuat tanpa
  // outlet, jadi kasir memakai outlet pertama sama seperti owner.
  // Developer dalam mode maintenance tetap punya outletId via cookie
  // dev_outlet — tanpa mode aktif dia dilempar balik ke /dev.
  const outletId = session.user.outletId;
  if (!outletId && session.user.role === "DEVELOPER") redirect("/");

  // Select only the identity fields the client needs — the logo BYTES
  // stay on the server; the client gets a cache-busted URL instead.
  const outletSelect = {
    id: true,
    name: true,
    address: true,
    phone: true,
    logoMimeType: true,
    logoVersion: true,
  } as const;
  const outlet = outletId
    ? await prisma.outlet.findUnique({
        where: { id: outletId },
        select: outletSelect,
      })
    : await prisma.outlet.findFirst({ select: outletSelect });
  if (!outlet) redirect("/");
  const outletInfo = {
    name: outlet.name,
    address: outlet.address,
    phone: outlet.phone,
    logoUrl: outlet.logoMimeType
      ? `/api/outlet/logo?v=${outlet.logoVersion}`
      : null,
  };

  // Produk kini dari backend-go — satu sumber kebenaran yang sama dengan
  // audit stok & halaman produk. Kalau backend tidak merespons, POS tidak
  // boleh terbuka dengan grid kosong yang terlihat normal: gagal keras.
  const goToken = session.user.goToken;
  const productsResult = goToken
    ? await goFetch<GoProduct[]>(goToken, "/products")
    : undefined;
  if (!productsResult || !productsResult.ok) {
    throw new Error(
      productsResult
        ? productsResult.message
        : "Sesi tidak memiliki token backend — silakan login ulang.",
    );
  }

  // Deteksi backend versi lama yang masih berjalan (pra foto produk):
  // responsnya tidak punya field "images"/"unit" — beri pesan yang jelas
  // alih-alih TypeError "Cannot read properties of undefined".
  if (productsResult.data.length > 0 && !("images" in productsResult.data[0])) {
    throw new Error(
      "Backend lama masih berjalan di port 8080. Matikan proses 'go run .' yang lama, jalankan ulang dari folder backend-go, lalu muat ulang halaman ini.",
    );
  }

  // Go memakai id numerik & harga integer Rupiah; tipe lama POS
  // (string) dipertahankan supaya seluruh komponen client tidak berubah.
  // Thumbnail = foto ber-flag is_thumb, else foto pertama — foto produk
  // kembali tampil di kartu POS begitu diunggah lewat halaman produk.
  const products: PosProduct[] = productsResult.data.map((p) => {
    const images = p.images ?? [];
    const thumb = images.find((image) => image.is_thumb) ?? images[0];
    return {
      id: String(p.id),
      name: p.name,
      sku: p.sku ?? "",
      price: String(p.price),
      stock: p.stock,
      unit: p.unit || "pcs",
      minStock: p.min_stock,
      categoryName: p.category || null,
      thumbImageId: thumb ? String(thumb.id) : null,
    };
  });

  // Antrean Penyajian (v3): today's receipts still waiting to be
  // handed over. Rendered as a floating bar; it refreshes on every
  // checkout and polls live on its own.
  const serveRows = await getServeQueue();

  return (
    <>
      {/* Banner amber hanya muncul untuk developer yang sedang mode
          maintenance — kasir & owner asli tidak melihat apa pun. */}
      <MaintenanceBanner />
      <PosClient
        cashierName={session.user.name ?? "Kasir"}
        outlet={outletInfo}
        products={products}
      />
      <ServeQueueBar rows={serveRows} />
    </>
  );
}
