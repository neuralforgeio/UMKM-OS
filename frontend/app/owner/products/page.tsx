import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { getOutletContext } from "@/lib/outlet-context";
import { ProductsClient } from "./products-client";
import type { CategoryOption, ProductRow, UnitOption } from "./types";

export const instant = false;

// Bentuk produk & foto dari backend-go.
type GoProductImage = { id: number; is_thumb: boolean };
type GoProduct = {
  id: number;
  name: string;
  sku: string | null;
  category: string;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  unit: string;
  is_active: boolean;
  // Backend lama (pra dukungan foto) tidak mengirim field ini.
  images?: GoProductImage[];
};
type GoTopProduct = { product_id: number; qty: number };

export default async function OwnerProductsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "OWNER" && session.user.role !== "DEVELOPER")
    redirect("/cashier");
  if (!session.user.goToken) {
    throw new Error("Sesi tidak memiliki token backend — silakan login ulang.");
  }
  const goToken = session.user.goToken;

  // v2.0.0: nama outlet header dari backend-go (GET /my/outlet) — kelola
  // produk ter-scope ke outlet konteks pemanggil.
  const outlet = await getOutletContext();

  // Produk (termasuk terarsip) + permintaan 30 hari terakhir, keduanya
  // dari backend-go — satu sumber kebenaran yang sama dengan kasir.
  // Laporan terlaris bersifat pelengkap: kegagalannya tidak boleh
  // menutup halaman produk.
  const [productsResult, topResult] = await Promise.all([
    goFetch<GoProduct[]>(goToken, "/products?all=true"),
    goFetch<{ products: GoTopProduct[] }>(
      goToken,
      "/reports/top-products?days=30&limit=1000",
    ),
  ]);
  if (!productsResult.ok) {
    throw new Error(productsResult.message);
  }

  // Deteksi backend versi lama yang masih berjalan (pra foto produk):
  // responsnya tidak punya field "images"/"unit" — beri pesan yang jelas
  // alih-alih TypeError "Cannot read properties of undefined".
  if (productsResult.data.length > 0 && !("images" in productsResult.data[0])) {
    throw new Error(
      "Backend lama masih berjalan di port 8080. Matikan proses 'go run .' yang lama, jalankan ulang dari folder backend-go, lalu muat ulang halaman ini.",
    );
  }
  const soldById = new Map<number, number>();
  if (topResult.ok) {
    for (const row of topResult.data.products) {
      soldById.set(row.product_id, row.qty);
    }
  }

  // Decimals sudah berupa Rupiah bulat di sisi Go. Urutan tampil sama
  // dengan sebelumnya: produk aktif dulu, lalu alfabetis.
  const rows: ProductRow[] = productsResult.data
    .map((product) => {
      const images = product.images ?? [];
      const thumb = images.find((image) => image.is_thumb) ?? images[0];
      return {
        id: String(product.id),
        name: product.name,
        sku: product.sku ?? "",
        // Era backend-go: kategori adalah teks pada produk — namanya
        // sekaligus menjadi id di seluruh form.
        categoryId: product.category || null,
        categoryName: product.category || null,
        priceRupiah: product.price,
        costRupiah: product.cost,
        stock: product.stock,
        minStock: product.min_stock,
        unit: product.unit || "pcs",
        isActive: product.is_active,
        soldLast30Days: soldById.get(product.id) ?? 0,
        images: images.map((image) => ({
          id: String(image.id),
          isThumb: image.is_thumb,
        })),
        // Chosen thumbnail, else the first photo by manager order.
        thumbImageId: thumb ? String(thumb.id) : null,
      };
    })
    .sort(
      (a, b) =>
        Number(b.isActive) - Number(a.isActive) ||
        a.name.localeCompare(b.name, "id"),
    );

  // Opsi kategori turun dari produk yang ada (nama unik, deduped
  // case-insensitive, urut abjad) — kategori baru tetap bisa diketik
  // langsung di form lalu otomatis ikut daftar di muat berikutnya.
  const categoryByName = new Map<string, string>();
  for (const product of productsResult.data) {
    const name = (product.category ?? "").trim();
    if (name && !categoryByName.has(name.toLowerCase())) {
      categoryByName.set(name.toLowerCase(), name);
    }
  }
  const categoryOptions: CategoryOption[] = [...categoryByName.values()]
    .sort((a, b) => a.localeCompare(b, "id"))
    .map((name) => ({ id: name, name }));

  // Unit dropdown options: satuan yang benar-benar dipakai produk
  // (case-insensitive dedupe) + "pcs" sebagai dasar — satuan baru
  // ditulis bebas di form dan langsung terpakai (maks. 16 karakter).
  const unitByName = new Map<string, string>([["pcs", "pcs"]]);
  for (const product of productsResult.data) {
    const trimmed = (product.unit ?? "").trim();
    if (trimmed && !unitByName.has(trimmed.toLowerCase())) {
      unitByName.set(trimmed.toLowerCase(), trimmed);
    }
  }
  const unitOptions: UnitOption[] = [...unitByName.values()]
    .sort((a, b) => a.localeCompare(b, "id"))
    .map((name) => ({ name }));

  // Per-category product counts power the form's live "next SKU"
  // preview ("__none__" = products without a category -> BRG-xxxx).
  // The server still computes the authoritative SKU on save.
  const skuCounts: Record<string, number> = {};
  for (const product of productsResult.data) {
    const key = product.category ?? "__none__";
    skuCounts[key] = (skuCounts[key] ?? 0) + 1;
  }

  return (
    <ProductsClient
      outletName={outlet?.name ?? "Outlet"}
      products={rows}
      categories={categoryOptions}
      units={unitOptions}
      skuCounts={skuCounts}
    />
  );
}
