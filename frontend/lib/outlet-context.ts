// Satu pintu identitas outlet untuk seluruh halaman (v2.0.0 multi-outlet).
//
// Era single-outlet, semua halaman memakai pola:
//   prisma.outlet.findUnique({ where: { id: session.user.outletId } })
//     ?? prisma.outlet.findFirst()
// yang diam-diam menjatuhkan SEMUA orang ke baris pertama tabel "Outlet"
// Prisma (beku, isi seed) karena outletId sesi selalu null. Kini identitas
// dibaca dari backend-go lewat GET /api/v1/my/outlet: outlet diambil dari
// ikatan akun (OWNER/KASIR) atau parameter mode maintenance (DEVELOPER,
// ditempelkan otomatis oleh goFetch dari cookie dev_outlet). Akun tanpa
// ikatan (era pra-multi-outlet) dijatuhkan Go ke outlet utama — perilaku
// lama yang sama, tanpa tabel mati.

import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { outletLogoUrl } from "@/lib/outlet-branding";

// Fungsi murni branding di-reexport supaya halaman cukup satu pintu import.
export { outletLogoUrl };

// Bentuk OutletResponse dari backend-go (internal/handler/outlet.go).
export type OutletIdentity = {
  id: number;
  name: string;
  address: string;
  phone: string;
  logo_version: number;
  has_logo: boolean;
  is_active: boolean;
  user_count: number;
  created_at: string;
};

// getOutletContext: identitas outlet konteks pengguna yang sedang login.
// null = backend tidak merespons / sesi tanpa token — pemanggil memutuskan
// nasibnya (fallback "Warung", redirect, atau error yang jelas).
export async function getOutletContext(): Promise<OutletIdentity | null> {
  const session = await auth();
  const token = session?.user?.goToken;
  if (!token) return null;
  const res = await goFetch<OutletIdentity>(token, "/my/outlet");
  return res.ok ? res.data : null;
}
