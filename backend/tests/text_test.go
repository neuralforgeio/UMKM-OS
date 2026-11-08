package tests

import (
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/neuralforgeio/internal/handler"
)

// Alasan refund / catatan / nama pembeli dipotong sebelum disimpan.
// Batasnya dihitung per KARAKTER (sama dengan maxLength di frontend),
// dan hasilnya harus tetap UTF-8 valid supaya PostgreSQL mau menyimpannya.

func TestTruncateRunesTidakMembelahKarakter(t *testing.T) {
	// 119 huruf ASCII lalu em dash (3 byte) dan sisa teks: memotong di
	// byte ke-120 akan membelah em dash.
	s := strings.Repeat("a", 119) + "— pesanan salah"
	got := handler.TruncateRunes(s, 120)
	if !utf8.ValidString(got) {
		t.Fatalf("hasil potongan bukan UTF-8 valid: %q", got)
	}
	if want := strings.Repeat("a", 119) + "—"; got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestTruncateRunesMenghitungKarakterBukanByte(t *testing.T) {
	// 40 karakter beraksen = 80 byte; frontend mengizinkannya (maxLength 40)
	// jadi backend tidak boleh memotongnya.
	s := strings.Repeat("é", 40)
	if got := handler.TruncateRunes(s, 40); got != s {
		t.Fatalf("teks 40 karakter ikut terpotong: %q", got)
	}
	if got := handler.TruncateRunes(s+"x", 40); got != s {
		t.Fatalf("got %q, want %q", got, s)
	}
}

func TestTruncateRunesTeksPendekTidakBerubah(t *testing.T) {
	for _, s := range []string{"", "barang rusak", "Bu Siti 🙏"} {
		if got := handler.TruncateRunes(s, 120); got != s {
			t.Fatalf("got %q, want %q", got, s)
		}
	}
}
