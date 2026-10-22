// Aturan prefix SKU — dipakai BERSAMA oleh server action (generasi
// otoritatif saat menyimpan produk) dan form produk (preview langsung
// di layar), sehingga keduanya tidak pernah berbeda aturan.
//
// Aturan: ambil nama kategori, buang selain huruf, buang vokal, pakai
// maksimal 3 konsonan pertama. "Snack" -> SNC, "Makanan" -> MKN,
// "Minuman" -> MNM, "Rokok" -> RKK. Produk tanpa kategori -> BRG.

const FALLBACK_PREFIX = "BRG";

export function skuPrefixOf(categoryName: string | null | undefined): string {
  const name = (categoryName ?? "").trim();
  if (!name) return FALLBACK_PREFIX;
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "");
  if (!letters) return FALLBACK_PREFIX;
  const consonants = letters.replace(/[AEIOU]/g, "");
  const base = (consonants || letters).slice(0, 3);
  return base.length >= 2 ? base : base.padEnd(2, "X");
}

export function formatSku(prefix: string, sequence: number): string {
  const seq = Math.max(1, Math.floor(sequence));
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}
