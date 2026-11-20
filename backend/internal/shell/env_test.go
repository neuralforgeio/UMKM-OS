package shell

// TES FITUR 4 UMKM2Shell: INSPEKTUR LINGKUNGAN (env_test.go) —
// deteksi rahasia + masking murni, tanpa menyentuh env asli.

import (
	"os"
	"strings"
	"testing"
)

func TestApakahRahasia(t *testing.T) {
	kasus := []struct {
		kunci string
		mau   bool
	}{
		{"GROQ_API_KEY", true},
		{"JWT_SECRET", true},
		{"DATABASE_URL", true}, // "URL" bukan pola rahasia — dsn ya, url tidak
		{"NEXT_PUBLIC_API_URL", false},
		{"PATH", false},
		{"HOME", false},
		{"LLM_API_TOKEN", true},
		{"BACKUP_DIR", false},
	}
	for _, k := range kasus {
		if dapat := ApakahRahasia(k.kunci); dapat != k.mau {
			t.Errorf("ApakahRahasia(%q)=%v mau %v", k.kunci, dapat, k.mau)
		}
	}
}

func TestMaskNilai(t *testing.T) {
	// panjang 40: awalan 4 + …(40)
	m := MaskNilai("gsk_1234567890abcdefghijklmnopqrst")
	if !strings.HasPrefix(m, "gsk_") || !strings.Contains(m, "(") {
		t.Fatalf("mask panjang salah bentuk: %q", m)
	}
	if strings.Contains(m, "5678") {
		t.Fatalf("mask membocorkan isi: %q", m)
	}
	// pendek: tidak membocorkan apa pun selain panjang
	p := MaskNilai("abc")
	if strings.Contains(p, "abc") {
		t.Fatalf("mask pendek membocorkan: %q", p)
	}
	// kosong
	if MaskNilai("") != "(kosong)" {
		t.Fatal("mask kosong salah")
	}
}

func TestDaftarEnvMaskKecualiBuka(t *testing.T) {
	// tanam dua var uji: satu rahasia pola, satu biasa
	kunci := "UMKM_UJI_SECRET_SHELL"
	nilai := "super-rahasia-jangan-dilihat"
	kecil := "UMKM_UJI_BIASA"
	_ = os.Setenv(kunci, nilai)
	_ = os.Setenv(kecil, "terlihat")
	defer func() {
		_ = os.Unsetenv(kunci)
		_ = os.Unsetenv(kecil)
	}()

	daftar := DaftarEnv("")
	var rah, bias bool
	for _, d := range daftar {
		if d.Key == kunci {
			rah = d.Value == nilai // seharusnya FALSE (termask)
			if strings.Contains(d.Value, "jangan-dilihat") {
				t.Fatalf("rahasia bocor di DaftarEnv: %q", d.Value)
			}
			if !d.Rahasia {
				t.Fatal("penanda rahasia tidak nyala")
			}
		}
		if d.Key == kecil && d.Value == "terlihat" {
			bias = true
		}
	}
	if rah {
		t.Fatal("nilai rahasia tidak termask")
	}
	if !bias {
		t.Fatal("nilai biasa tidak terbaca")
	}

	// buka satu kunci: nilai asli terlihat
	daftar = DaftarEnv(kunci)
	terbuka := false
	for _, d := range daftar {
		if d.Key == kunci && d.Value == nilai {
			terbuka = true
		}
	}
	if !terbuka {
		t.Fatal("kunci yang diminta terbuka tetap termask")
	}

	// urut abjad
	for i := 1; i < len(daftar); i++ {
		if daftar[i].Key < daftar[i-1].Key {
			t.Fatal("DaftarEnv tidak terurut")
		}
	}
}
