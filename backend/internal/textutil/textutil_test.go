package textutil

// TES BUG PRODUKSI RUN-14 (GitHub issues): pemotongan per BYTE bisa
// membelah karakter UTF-8 sehingga INSERT Postgres gagal dengan
// "invalid byte sequence for encoding UTF8" (refund atau serah
// terima 500). Semua kasus di bawah mengunci perilaku per RUNE.

import (
	"strings"
	"testing"
	"unicode/utf8"
)

func TestPotongRuneASCII(t *testing.T) {
	if got := PotongRune("abcdefgh", 5); got != "abcde" {
		t.Fatalf("ASCII: %q", got)
	}
	if got := PotongRune("abc", 5); got != "abc" {
		t.Fatalf("kurang dari maks harus utuh: %q", got)
	}
}

func TestPotongRuneEmDashTidakTerbelah(t *testing.T) {
	// Kasus persis dari laporan issues: 119x "a" lalu em dash (3 byte).
	// reason[:120] lama menghasilkan 120 BYTE = 119 a + 1 byte pertama
	// em dash (byte terbelah) bukan UTF-8 valid.
	alasan := strings.Repeat("a", 119) + "\u2014 pesanan salah"
	if got := PotongRune(alasan, 120); !utf8.ValidString(got) {
		t.Fatalf("hasil bukan UTF-8 valid: %q", got)
	}
	// 119 a + em dash + " pesanan salah" = 134 rune; maks 120 rune
	// menghasilkan 119 a + em dash utuh (rune ke-120), tetap VALID.
	got := PotongRune(alasan, 120)
	if !utf8.ValidString(got) || got != strings.Repeat("a", 119)+"\u2014" {
		t.Fatalf("harus 119a + em dash utuh: %q", got)
	}
	// versi byte lama memang terbelah (bukti regresi)
	if potonganByte := alasan[:120]; utf8.ValidString(potonganByte) {
		t.Fatal("potongan byte seharusnya INVALID (bukti bug asli)")
	}
}

func TestPotongRuneBeragamNonASCII(t *testing.T) {
	kasus := []struct {
		nama  string
		masuk string
	}{
		{"e beraksen", "café olé"},
		{"emoji", "kopi ☕ mantap 🎉"},
		{"han", " nama pembeli 李小明"},
		{"arab", "زبائن"},
		{"kode euro", "harga €50"},
	}
	for _, k := range kasus {
		for maks := 1; maks <= len([]rune(k.masuk))+2; maks++ {
			got := PotongRune(k.masuk, maks)
			if !utf8.ValidString(got) {
				t.Fatalf("%s maks=%d: hasil bukan UTF-8 valid: %q", k.nama, maks, got)
			}
			if len([]rune(got)) > maks {
				t.Fatalf("%s maks=%d: kepanjangan %d rune", k.nama, maks, len([]rune(got)))
			}
		}
	}
}

func TestPotongRuneNamaPembeli40(t *testing.T) {
	// Nama 40 karakter beraksen (diizinkan frontend maxLength=40).
	// Potongan byte lama menghasilkan 20 karakter terbelah.
	nama := strings.Repeat("é", 40)
	got := PotongRune(nama, 40)
	if got != nama {
		t.Fatalf("nama utuh harus tetap utuh: %d rune", len([]rune(got)))
	}
	got = PotongRune(strings.Repeat("é", 41), 40)
	if len([]rune(got)) != 40 || !utf8.ValidString(got) {
		t.Fatalf("41 rune dipotong 40 rune valid: %q", got)
	}
	// bukti bug asli: byte ganjil MEMBELAH rune 2-byte (39 byte dari
	// 20 rune e = terbelah di rune ke-20)
	if utf8.ValidString(strings.Repeat("é", 20)[:39]) {
		t.Fatal("potongan byte ganjil seharusnya INVALID (bukti bug)")
	}
}

func TestPotongRuneCatatan200(t *testing.T) {
	// catatan serah terima 199 huruf lalu em dash
	note := strings.Repeat("b", 199) + "\u2014"
	got := PotongRune(note, 200)
	if !utf8.ValidString(got) || got != note {
		t.Fatalf("note 200 rune harus utuh: %d rune valid=%v", len([]rune(got)), utf8.ValidString(got))
	}
}

func TestPotongRuneTepi(t *testing.T) {
	if got := PotongRune("apapun", 0); got != "" {
		t.Fatalf("maks 0 harus kosong: %q", got)
	}
	if got := PotongRune("apapun", -1); got != "" {
		t.Fatalf("maks negatif harus kosong: %q", got)
	}
	if got := PotongRune("", 10); got != "" {
		t.Fatalf("kosong harus kosong: %q", got)
	}
}

func TestPotongRuneUnggul(t *testing.T) {
	if got := PotongRuneUnggul("abcdef", 4); got != "abc..." {
		t.Fatalf("unggul: %q", got)
	}
	if got := PotongRuneUnggul("ab", 4); got != "ab" {
		t.Fatalf("pendek tetap utuh: %q", got)
	}
	// non ASCII tidak terbelah
	got := PotongRuneUnggul("café au lait ☕", 6)
	if !utf8.ValidString(got) {
		t.Fatalf("unggul non-ascii: %q", got)
	}
}
