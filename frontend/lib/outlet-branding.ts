// Bagian MURNI identitas outlet (tanpa import auth/jaringan) — supaya
// bisa dites vitest langsung tanpa menarik rantai next-auth/next-headers.
// Dipakai ulang oleh lib/outlet-context.ts (re-export).

// URL logo cache-busted lewat proxy route Next (byte logo tetap di server;
// ?v naik setiap unggah ulang supaya semua <img> lama langsung segar).
export function outletLogoUrl(outlet: {
  has_logo: boolean;
  logo_version: number;
}): string | null {
  return outlet.has_logo
    ? `/api/outlet/logo?v=${outlet.logo_version}`
    : null;
}
