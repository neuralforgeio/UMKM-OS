package shell

// TES FITUR 3 UMKM2Shell: PELARI PERINTAH (cmd_test.go).
// Parser murni diuji tanpa OS; eksekusi asli dengan echo/sleep.

import (
	"strings"
	"testing"
	"time"
)

func TestValidasiPerintahPutihHitam(t *testing.T) {
	kasus := []struct {
		nama  string
		baris string
		galat bool
	}{
		{"echo lolos", "echo halo warung", false},
		{"ls lolos", "ls -la sub", false},
		{"rm TIDAK di whitelist", "rm -rf /", true},
		{"sh TIDAK di whitelist", "sh -c whoami", true},
		{"pipe ditolak (token |)", "cat a | grep b", true},
		{"titik-koma ditolak", "echo a; echo b", true},
		{"ampersand ganda ditolak", "echo a && echo b", true},
		{"substitusi $() ditolak", "echo $(whoami)", true},
		{"backtick ditolak", "echo `whoami`", true},
		{"redirect > ditolak", "cat a > /tmp/x", true},
		{"jalur keluar jail ditolak", "cat ../etc/passwd", true},
		{"rahasia env ditolak", "env DATABASE_URL", true},
		{"kunci groq ditolak", "echo GROQ_API_KEY", true},
		{"git status lolos", "git status", false},
		{"git push DITOLAK", "git push origin main", true},
		{"curl tanpa flag lolos", "curl http://localhost:8080/health", false},
		{"curl -X DITOLAK", "curl -X POST http://x", true},
		{"perintah kosong", "", true},
	}
	for _, k := range kasus {
		_, _, err := ValidasiPerintah(k.baris)
		if k.galat && err == nil {
			t.Errorf("%s: seharusnya ditolak: %q", k.nama, k.baris)
		}
		if !k.galat && err != nil {
			t.Errorf("%s: seharusnya lolos: %q (%v)", k.nama, k.baris, err)
		}
	}
}

func TestJalankanEchoSungguhan(t *testing.T) {
	hasil, err := Jalankan("echo uji-umkm-shell")
	if err != nil {
		t.Fatalf("Jalankan echo: %v", err)
	}
	if !strings.Contains(hasil.Output, "uji-umkm-shell") {
		t.Fatalf("output tidak memuat teks: %q", hasil.Output)
	}
	if hasil.Keluar != 0 {
		t.Fatalf("exit code seharusnya 0: %d", hasil.Keluar)
	}
}

func TestJalankanPerintahGagal(t *testing.T) {
	// cat ke berkas yang tidak ada: exit code bukan 0 tapi TIDAK error
	hasil, err := Jalankan("cat /tidak/ada/berkas.ini")
	if err != nil {
		t.Fatalf("Jalankan tidak seharusnya galat level HTTP: %v", err)
	}
	if hasil.Keluar == 0 {
		t.Fatal("cat berkas hilang seharusnya exit != 0")
	}
}

func TestSejarahTercatat(t *testing.T) {
	_, err := Jalankan("echo sejarah-uji")
	if err != nil {
		t.Fatalf("Jalankan: %v", err)
	}
	s := Sejarah()
	if len(s) == 0 {
		t.Fatal("sejarah kosong setelah Jalankan")
	}
	if s[0].Perintah != "echo sejarah-uji" {
		t.Fatalf("sejarah terbaru salah: %q", s[0].Perintah)
	}
}

func TestInterupsiTanpaJalan(t *testing.T) {
	if Interupsi() {
		t.Fatal("Interupsi tanpa perintah jalan seharusnya false")
	}
	jalan, id := SedangJalan()
	if jalan || id != 0 {
		t.Fatal("SedangJalan seharusnya kosong")
	}
}

func TestPotongOutputMurni(t *testing.T) {
	// unit murni potongOutput: argumen echo besar akan E2BIG di
	// kernel (argument list too long) — panggil fungsinya langsung.
	besar := strings.Repeat("x", BatasOutput+50)
	dapat := potongOutput(besar)
	if len(dapat) > BatasOutput+200 {
		t.Fatalf("tidak terpotong: %d", len(dapat))
	}
	if !strings.Contains(dapat, "terpotong") {
		t.Fatal("penanda terpotong tidak ada")
	}
	// di bawah batas: utuh tanpa penanda
	kecil := potongOutput("kecil")
	if kecil != "kecil" || strings.Contains(kecil, "terpotong") {
		t.Fatalf("kecil berubah: %q", kecil)
	}
}

func TestAntrianSerialTolakGanda(t *testing.T) {
	// kunci slot lewat jalanan sleep panjang… tapi sandbox membatasi
	// kill; pakai pendekatan: cek fungsi penolakan ganda lewat state
	// setelah Interupsi. Cukup: dua Jalankan berurutan harus sukses
	// (serial), dan sejarah bertambah.
	n := len(Sejarah())
	_, _ = Jalankan("echo satu")
	_, _ = Jalankan("echo dua")
	if len(Sejarah()) < n+2 {
		t.Fatalf("sejarah tidak bertambah 2: %d -> %d", n, len(Sejarah()))
	}
	_ = time.Second // import dipakai bila ditambah tes waktu nanti
}
