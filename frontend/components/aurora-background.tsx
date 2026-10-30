// Latar halaman tenang (v3.1.0) — pensiun dini untuk aurora v1.3.0.
//
// Nama ekspor "AuroraBackground" sengaja DIPERTAHANKAN (bukan dihapus)
// karena semua shell halaman mengimpor komponen ini; test penjaga
// konsistensi tema juga mengunci kehadirannya. Yang berubah totalnya
// adalah ISINYA: tidak lagi tiga blob gradien beranimasi + blur 130px,
// melainkan satu latar datar semantik (Cloud di terang, Midnight di
// gelap) mengikuti arahan desain "quiet surfaces" — netral, senyap,
// tanpa dekorasi. print:hidden tetap: latar tidak pernah ikut tercetak.
export function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 bg-background print:hidden"
    />
  );
}
