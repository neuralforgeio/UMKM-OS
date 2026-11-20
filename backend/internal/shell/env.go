// FITUR 4 UMKM2Shell: INSPEKTUR LINGKUNGAN (env.go).
//
// Developer panel klasik menampilkan $_ENV mentah-mentah — di
// UMKM, nilai yang TERDETEKSI sebagai rahasia (kunci/token/
// password) otomatis DIMASK (awalan + panjang + akhiran saja)
// kecuali developer eksplisit meminta membuka satu kunci
// (permintaan membuka juga ter-audit di handler).
package shell

import (
	"os"
	"sort"
	"strings"
)

// InfoEnv: satu baris variabel lingkungan.
type InfoEnv struct {
	Key     string `json:"key"`
	Value   string `json:"value"` // sudah termask bila rahasia
	Rahasia bool   `json:"rahasia"`
}

// POLA_RAHASIA: potongan nama variabel yang hampir pasti nilai
// sensitif. Pencocokan substring case-insensitive.
var POLA_RAHASIA = []string{
	"KEY", "TOKEN", "SECRET", "PASSWORD", "PASSWD", "CREDENTIAL",
	"PRIVATE", "CERT", "SIGNATURE", "DSN", "WEBHOOK",
	// 2.3.1 audit: DATABASE_URL memuat password postgres://user:pw@
	"DATABASE_URL", "REPLICA_URL",
}

// ApakahRahasia: kunci termasuk pola sensitif? (murni — diuji unit)
func ApakahRahasia(kunci string) bool {
	atas := strings.ToUpper(kunci)
	// pengecualian eksplisit: ini nama yang MEMUAT kata rahasia tapi
	// nilainya tidak sensitif di konteks warung (bendera boolean).
	kecuali := map[string]bool{
		"NEXT_PUBLIC_API_URL": true, // URL publik front
	}
	if kecuali[kunci] {
		return false
	}
	for _, p := range POLA_RAHASIA {
		if strings.Contains(atas, p) {
			return true
		}
	}
	return false
}

// MaskNilai: bentuk samaran "gsk_abc…(34)" — panjang tetap
// terlihat supaya developer bisa mencocokkan kunci yang dipasang
// tanpa membaca isinya. (murni — diuji unit)
func MaskNilai(nilai string) string {
	n := len(nilai)
	switch {
	case n == 0:
		return "(kosong)"
	case n <= 8:
		return "***(" + strings.Repeat("*", n) + ")…" + string(nilai[n-1]) + "…(" + itoa(n) + ")"
	default:
		return string(nilai[:4]) + "…(" + itoa(n) + ")"
	}
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	s := ""
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	return s
}

// DaftarEnv: seluruh variabel lingkungan, terurut abjad,
// rahasia termask (kecuali satu kunci diminta terbuka).
func DaftarEnv(buka string) []InfoEnv {
	daftar := []InfoEnv{}
	for _, kv := range os.Environ() {
		i := strings.Index(kv, "=")
		if i <= 0 {
			continue
		}
		k, v := kv[:i], kv[i+1:]
		bar := InfoEnv{Key: k, Rahasia: ApakahRahasia(k)}
		if bar.Rahasia && k != buka {
			bar.Value = MaskNilai(v)
		} else {
			bar.Value = v
		}
		daftar = append(daftar, bar)
	}
	sort.Slice(daftar, func(i, j int) bool { return daftar[i].Key < daftar[j].Key })
	return daftar
}
