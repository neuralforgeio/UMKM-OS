package shell

// TES FITUR 5 UMKM2Shell: PERKAKAS JARINGAN (net_test.go) —
// ping TCP ke server uji lokal + HttpHead ke handler uji.

import (
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestPingTCPKeServerUji(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Skipf("listen gagal: %v", err)
	}
	defer ln.Close()
	go func() {
		for {
			c, err := ln.Accept()
			if err != nil {
				return
			}
			_ = c.Close()
		}
	}()
	alamat := ln.Addr().(*net.TCPAddr)
	hidup, ms, err := PingTCP("127.0.0.1", itoaPort(alamat.Port))
	if err != nil || !hidup {
		t.Fatalf("ping ke server uji gagal: %v hidup=%v", err, hidup)
	}
	if ms < 0 {
		t.Fatalf("latensi negatif: %f", ms)
	}
}

func itoaPort(p int) string {
	if p == 0 {
		return "0"
	}
	s := ""
	for p > 0 {
		s = string(rune('0'+p%10)) + s
		p /= 10
	}
	return s
}

func TestPingTCPPortTutup(t *testing.T) {
	// cari port yang pasti tertutup: listen lalu tutup
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Skipf("listen gagal: %v", err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	ln.Close()
	// beri jeda supaya kernel benar-benar melepas
	time.Sleep(50 * time.Millisecond)
	hidup, _, err := PingTCP("127.0.0.1", itoaPort(port))
	if err == nil && hidup {
		t.Fatal("port tertutup seharusnya gagal")
	}
}

func TestHttpHeadKeServerUji(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot) // 418 — penanda unik
	}))
	defer srv.Close()
	status, ms, err := HttpHead(srv.URL)
	if err != nil {
		t.Fatalf("HttpHead: %v", err)
	}
	if status != 418 {
		t.Fatalf("status seharusnya 418: %d", status)
	}
	if ms < 0 {
		t.Fatalf("latensi negatif: %f", ms)
	}
}

func TestHttpHeadTolakSkemaAneh(t *testing.T) {
	for _, u := range []string{"file:///etc/passwd", "ftp://x", "gopher://x", "javascript:alert(1)"} {
		if _, _, err := HttpHead(u); err == nil {
			t.Errorf("skema %q seharusnya ditolak", u)
		}
	}
}

func TestHttpHeadTidakIkutRedirect(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Location", "http://127.0.0.1:9/")
		w.WriteHeader(302)
	}))
	defer srv.Close()
	status, _, err := HttpHead(srv.URL)
	if err != nil {
		t.Fatalf("HttpHead redirect: %v", err)
	}
	if status != 302 {
		t.Fatalf("redirect seharusnya TIDAK diikuti (status 302): %d", status)
	}
}
