package shell

// TES FITUR 1 UMKM2Shell: PENJELAJAH FILESYSTEM (fs_test.go).
// Semua tes memakai jail sementara (t.TempDir) — tidak pernah
// menyentuh direktori kerja asli.

import (
	"os"
	"path/filepath"
	"testing"
)

func denganJail(t *testing.T) string {
	t.Helper()
	lama := JailRoot
	dir := t.TempDir()
	JailRoot = dir
	t.Cleanup(func() { JailRoot = lama })
	return dir
}

func TestBersihkanJalur(t *testing.T) {
	denganJail(t)
	kasus := []struct {
		masuk   string
		relatif string
		galat   bool
	}{
		{"", "", false},
		{".", "", false},
		{"sub/berkas.txt", "sub/berkas.txt", false},
		{"/etc/passwd", "etc/passwd", false}, // awalan / dipotong -> tetap di jail
		{"a/../../etc/passwd", "", true},     // mencoba kabur -> galat
		{"..", "", true},
		{"../satu", "", true},
		{`C:\Windows\system32`, `C:/Windows/system32`, false}, // backslash dinormalkan
	}
	for _, k := range kasus {
		_, rel, err := Bersihkan(k.masuk)
		if k.galat && err == nil {
			t.Errorf("Bersihkan(%q) seharusnya galat, dapat rel=%q", k.masuk, rel)
		}
		if !k.galat && err != nil {
			t.Errorf("Bersihkan(%q) galat tak terduga: %v", k.masuk, err)
		}
		if !k.galat && rel != k.relatif {
			t.Errorf("Bersihkan(%q) = %q, mau %q", k.masuk, rel, k.relatif)
		}
	}
}

func TestBersihkanTakPernahKeluarJail(t *testing.T) {
	denganJail(t)
	for _, jalur := range []string{
		"../", "../../x", "a/../../../b", "/..", "sub/../../..",
		"..\\..\\windows", "~~/rahasia",
	} {
		abs, _, err := Bersihkan(jalur)
		if err == nil {
			// abs HARUS masih di bawah jail
			if !filepath.IsAbs(abs) || len(abs) < len(JailRoot) {
				t.Errorf("jalur %q lolos: abs=%q", jalur, abs)
			}
			if abs != JailRoot && len(abs) <= len(JailRoot)+1 {
				t.Errorf("jalur %q aneh: abs=%q", jalur, abs)
			}
		}
	}
}

func TestLsSortirDirektoriDulu(t *testing.T) {
	jail := denganJail(t)
	_ = os.MkdirAll(filepath.Join(jail, "zdir"), 0755)
	_ = os.WriteFile(filepath.Join(jail, "afile.txt"), []byte("x"), 0644)
	_ = os.WriteFile(filepath.Join(jail, "bfile.txt"), []byte("x"), 0644)

	daftar, err := Ls("")
	if err != nil {
		t.Fatalf("Ls: %v", err)
	}
	if len(daftar) != 3 {
		t.Fatalf("Ls harusnya 3 entri, dapat %d", len(daftar))
	}
	if !daftar[0].IsDir || daftar[0].Name != "zdir" {
		t.Fatalf("entri pertama harus direktori zdir, dapat %+v", daftar[0])
	}
	if daftar[1].Name != "afile.txt" || daftar[2].Name != "bfile.txt" {
		t.Fatal("berkas tidak terurut alfabetis")
	}
}

func TestCatDanTulis(t *testing.T) {
	denganJail(t) // jail cukup dipasang; jalur relatif ditangani shell
	if err := Tulis("catatan.txt", "halo warung"); err != nil {
		t.Fatalf("Tulis: %v", err)
	}
	isi, terpotong, err := Cat("catatan.txt")
	if err != nil || isi != "halo warung" || terpotong {
		t.Fatalf("Cat: isi=%q terpotong=%v err=%v", isi, terpotong, err)
	}
	// cat direktori = galat
	if _, _, err := Cat("."); err == nil {
		t.Fatal("Cat direktori seharusnya galat")
	}
	// cat berkas luar jail = galat
	if _, _, err := Cat("../tetusapak"); err == nil {
		t.Fatal("Cat luar jail seharusnya galat")
	}
	// tulis isi terlalu besar = galat
	besar := make([]byte, BatasBaca+1)
	if err := Tulis("besar.txt", string(besar)); err == nil {
		t.Fatal("Tulis di atas batas seharusnya galat")
	}
}

func TestHapusDanGantiNama(t *testing.T) {
	jail := denganJail(t)
	_ = os.WriteFile(filepath.Join(jail, "lama.txt"), []byte("x"), 0644)
	_ = jail // dipakai lewat filepath.Join di baris berikut
	if err := GantiNama("lama.txt", "baru.txt"); err != nil {
		t.Fatalf("GantiNama: %v", err)
	}
	if _, err := os.Stat(filepath.Join(jail, "baru.txt")); err != nil {
		t.Fatal("berkas baru tidak ada")
	}
	// hapus akar = galat
	if err := Hapus(""); err == nil {
		t.Fatal("Hapus akar penjara seharusnya galat")
	}
	// hapus direktori tidak kosong = galat
	_ = os.MkdirAll(filepath.Join(jail, "isi", "anak"), 0755)
	if err := Hapus("isi"); err == nil {
		t.Fatal("Hapus direktori berisi seharusnya galat")
	}
	// kosongkan lalu hapus = ok
	if err := Hapus("isi/anak"); err != nil {
		t.Fatalf("Hapus anak: %v", err)
	}
	if err := Hapus("isi"); err != nil {
		t.Fatalf("Hapus kosong: %v", err)
	}
}

func TestMimeDariNama(t *testing.T) {
	kasus := map[string]string{
		"a.log": "text/plain; charset=utf-8",
		"b.png": "image/png",
		"c.bin": "application/octet-stream",
	}
	for nama, mau := range kasus {
		if dapat := mimeDariNama(nama); dapat != mau {
			t.Errorf("mimeDariNama(%q)=%q mau %q", nama, dapat, mau)
		}
	}
}
