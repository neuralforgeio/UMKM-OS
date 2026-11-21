package textutil

// PotongRune: memotong teks per KARAKTER (rune), bukan per byte.
//
// Latar belakang bug produksi (laporan issues GitHub run-14): reason
// [:120], note[:200], buyerName[:40], user_agent[:300] di handler
// memotong per byte sehingga bisa membelah satu karakter UTF-8
// (em dash, e beraksen, emoji). Hasil potongannya bukan UTF-8 valid,
// ditolak Postgres dengan "invalid byte sequence for encoding UTF8"
// saat INSERT, dan refund atau konfirmasi gagal dengan 500.
// Potong per rune membuat hasil SELALU UTF-8 valid dan cocok dengan
// batas maxLength di frontend (yang menghitung per karakter).
func PotongRune(s string, maks int) string {
	if maks <= 0 {
		return ""
	}
	r := []rune(s)
	if len(r) <= maks {
		return s
	}
	return string(r[:maks])
}

// PotongRuneUnggul: potong per rune dengan penanda bila terpotong,
// dipakai untuk tampilan ringkas (bukan penyimpanan).
func PotongRuneUnggul(s string, maks int) string {
	r := []rune(s)
	if maks <= 1 || len(r) <= maks {
		return PotongRune(s, maks)
	}
	return string(r[:maks-1]) + "..."
}
