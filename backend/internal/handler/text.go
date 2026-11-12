package handler

import "unicode/utf8"

// TruncateRunes memotong s menjadi paling banyak max KARAKTER (rune),
// bukan byte. Memotong per byte (s[:max]) bisa membelah karakter UTF-8
// multi-byte (é, —, emoji) sehingga hasilnya bukan UTF-8 valid dan
// PostgreSQL menolaknya ("invalid byte sequence for encoding UTF8").
// Batas karakter ini juga sama dengan maxLength di input frontend.
func TruncateRunes(s string, max int) string {
	if utf8.RuneCountInString(s) <= max {
		return s
	}
	n := 0
	for i := range s {
		if n == max {
			return s[:i]
		}
		n++
	}
	return s
}
