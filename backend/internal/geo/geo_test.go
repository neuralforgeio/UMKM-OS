package geo

// Unittest geo lookup IP audit (era Go murni): IP privat langsung
// "jaringan lokal" tanpa trafik keluar; hasil lookup deterministik
// (cache); input aneh tidak pernah panic.

import (
	"context"
	"testing"
)

func TestIPPrivatLangsung(t *testing.T) {
	BersihkanCache()
	h := Lookup("192.168.1.10")
	if !h.Lokal || h.Kota != "jaringan lokal" {
		t.Errorf("IP privat harus langsung jaringan lokal: %+v", h)
	}
	h2 := Lookup("127.0.0.1")
	if !h2.Lokal {
		t.Errorf("loopback harus lokal: %+v", h2)
	}
	h3 := Lookup("10.0.0.5")
	if !h3.Lokal {
		t.Errorf("RFC1918 10.x harus lokal: %+v", h3)
	}
	h4 := Lookup("172.16.5.4")
	if !h4.Lokal {
		t.Errorf("RFC1918 172.16.x harus lokal: %+v", h4)
	}
}

func TestInputAnehTidakPanic(t *testing.T) {
	BersihkanCache()
	if h := Lookup(""); h.Kota != "" {
		t.Errorf("IP kosong: geo kosong: %+v", h)
	}
	if h := LookupContext(context.Background(), "bukan-ip"); h.Kota != "" {
		t.Errorf("IP tidak valid: geo kosong, bukan error: %+v", h)
	}
	if h := Lookup("999.999.999.999"); h.Kota != "" {
		t.Errorf("IP mustahil: geo kosong: %+v", h)
	}
}

func TestHasilDeterministikCache(t *testing.T) {
	BersihkanCache()
	// IP contoh publik (TEST-NET-3 203.0.113.7): dari sandbox mungkin
	// tidak terjangkau — hasil apapun itu harus STABIL (ter-cache pada
	// panggilan kedua) dan tidak pernah berbeda.
	h1 := Lookup("203.0.113.7")
	h2 := Lookup("203.0.113.7")
	if h1 != h2 {
		t.Errorf("hasil lookup harus deterministik (cache): %+v vs %+v", h1, h2)
	}
}
