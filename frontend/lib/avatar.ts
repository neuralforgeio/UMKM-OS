// Helper tampilan avatar pengguna (v2.2.0) — fungsi murni tanpa import
// Next/React supaya bisa diuji vitest langsung dan dipakai komponen
// server maupun client.
//
// Avatar dipakai di dua tempat: chip profil di kanan navbar (semua
// halaman) dan halaman Profil Saya. Sumbernya dua tahap:
//   1. foto profil unggahan (bila photo_version > 0) — URL proxy
//      /api/user/photo?v=N yang membawa cache-bust versi;
//   2. fallback inisial nama di atas gradasi warna per peran.

/** Inisial nama untuk avatar tanpa foto.
 *
 * Kata lebih dari satu: huruf pertama dua kata pertama ("Dear Dor" ->
 * "DD"). Satu kata: dua huruf pertama kata itu ("Developer" -> "DE",
 * "Kasir1" -> "KA") — konsisten dengan avatar lama era mockup. Nama
 * kosong/whitespace -> "?" supaya lingkaran avatar tidak pernah kosong.
 */
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) {
    const w = words[0]!;
    return w.slice(0, 2).toUpperCase();
  }
  return (
    words[0]!.charAt(0).toUpperCase() + words[1]!.charAt(0).toUpperCase()
  );
}

/** Gradasi warna avatar per peran — Owner biru, Kasir hijau, Developer
 * ungu (selaras kartu peran halaman peluncur). Tanpa peran = biru netral.
 * Kelas statis Tailwind supaya terdeteksi JIT saat build. */
export function avatarGradientFor(role: string | null | undefined): string {
  switch (role) {
    case "KASIR":
      return "from-emerald-500 to-teal-600";
    case "DEVELOPER":
      return "from-violet-500 to-purple-700";
    default:
      return "from-blue-600 to-indigo-600";
  }
}

/** Label peran ramah bahasa Indonesia untuk dropdown & kartu profil. */
export function roleLabelOf(role: string | null | undefined): string {
  switch (role) {
    case "OWNER":
      return "Pemilik";
    case "KASIR":
      return "Kasir";
    case "DEVELOPER":
      return "Developer";
    default:
      return "Pengguna";
  }
}

/** URL foto profil bila sudah diunggah, null bila belum.
 *
 * `v` = versi foto dari Go (naik tiap unggah/hapus) — memakai versi di
 * URL membuat browser langsung memuat foto baru tanpa menunggu TTL
 * cache, dan versi lama tetap immutable di cache.
 */
export function userPhotoUrl(
  photoVersion: number | null | undefined,
): string | null {
  const v = photoVersion ?? 0;
  return v > 0 ? `/api/user/photo?v=${v}` : null;
}
