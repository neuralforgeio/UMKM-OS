// FITUR 1 UMKM2Shell: PENJELAJAH FILESYSTEM (fs.go).
//
// PHP2Shell/NodeJS2Shell membiarkan developer melihat dan mengedit
// file apa pun di server — itu senjata sekaligus lubang keamanan.
// Versi UMKM mengambil ide yang sama tapi di dalam PENJARA (jail):
// seluruh operasi dibatasi di bawah JailRoot, jalur relatif
// ".." tidak pernah lolos (dibersihkan + dicegah kembali).
package shell

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// Bersihkan: normalisasi jalur relatif pengguna terhadap jail.
// Mengembalikan jalur absolut filesystem + jalur relatif rapi.
// Bila jalur mencoba keluar penjara (…/…), dikembalikan galat.
func Bersihkan(rel string) (string, string, error) {
	rel = strings.TrimSpace(strings.ReplaceAll(rel, "\\", "/"))
	if rel == "" || rel == "." {
		rel = ""
	}
	// potong awalan absolut ("/etc/passwd") dan tilde
	rel = strings.TrimPrefix(rel, "/")
	rel = strings.TrimPrefix(rel, "~/")
	// cek .. SEBELUM Clean: "a/../../etc" masih memuat .. beruntun
	// yang setelah Clean berlipat (a/.. -> ., ../.. -> /) KELUAR jail.
	if strings.Contains(rel, "..") {
		return "", "", fmt.Errorf("jalur tidak boleh memuat ..")
	}
	bersih := filepath.Clean("/" + rel) // "/a/b" -> "/a/b"
	if bersih == "/" || bersih == "/." {
		bersih = ""
	}
	relatif := strings.TrimPrefix(bersih, "/")
	absolut := filepath.Join(JailRoot, relatif)
	return absolut, relatif, nil
}

// InfoFile: satu baris direktori/berkas untuk JSON ls.
type InfoFile struct {
	Name    string    `json:"name"`
	Path    string    `json:"path"`
	IsDir   bool      `json:"is_dir"`
	Size    int64     `json:"size"`
	Mode    string    `json:"mode"`
	ModTime time.Time `json:"mod_time"`
}

// Ls: daftar isi satu direktori di dalam penjara.
// Ukuran direktori = 4096 konvensional (tidak dihitung rekursif —
// mahal dan tidak informatif untuk panel).
func Ls(rel string) ([]InfoFile, error) {
	abs, relatif, err := Bersihkan(rel)
	if err != nil {
		return nil, err
	}
	ent, err := os.ReadDir(abs)
	if err != nil {
		return nil, fmt.Errorf("tidak bisa membaca %q: %v", relatif, err)
	}
	daftar := make([]InfoFile, 0, len(ent))
	for _, e := range ent {
		info, err := e.Info()
		if err != nil {
			continue // berkas terhapus di tengah jalan — abaikan
		}
		bar := InfoFile{
			Name:    e.Name(),
			Path:    filepath.Join(relatif, e.Name()),
			IsDir:   e.IsDir(),
			Size:    info.Size(),
			Mode:    info.Mode().String(),
			ModTime: info.ModTime(),
		}
		if bar.IsDir {
			bar.Size = 4096
		}
		daftar = append(daftar, bar)
	}
	// direktori dulu, lalu berkas, keduanya alfabetis — kebiasaan panel
	sort.SliceStable(daftar, func(i, j int) bool {
		if daftar[i].IsDir != daftar[j].IsDir {
			return daftar[i].IsDir
		}
		return daftar[i].Name < daftar[j].Name
	})
	return daftar, nil
}

// BatasBaca: maksimum byte yang dibaca Cat/Unduh ke string.
// file gambar/db besar tidak dimuat ke memori — Unduh streaming.
const BatasBaca = 512 * 1024

// Cat: baca isi berkas teks (dipotong BatasBaca) + indikasi terpotong.
func Cat(rel string) (isi string, terpotong bool, err error) {
	abs, _, err := Bersihkan(rel)
	if err != nil {
		return "", false, err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return "", false, fmt.Errorf("berkas tidak ada: %v", err)
	}
	if info.IsDir() {
		return "", false, fmt.Errorf("itu direktori, bukan berkas")
	}
	if info.Size() > BatasBaca {
		terpotong = true
	}
	f, err := os.Open(abs)
	if err != nil {
		return "", false, err
	}
	defer f.Close()
	b := make([]byte, BatasBaca)
	n, _ := io.ReadFull(f, b)
	return string(b[:n]), terpotong, nil
}

// Unduh: streaming berkas ke ResponseWriter (tanpa memuat ke memori).
// Content-Type dari ekstensi umum; fallback octet-stream.
func Unduh(w http.ResponseWriter, rel string) error {
	abs, _, err := Bersihkan(rel)
	if err != nil {
		return err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return fmt.Errorf("berkas tidak ada: %v", err)
	}
	if info.IsDir() {
		return fmt.Errorf("itu direktori — unduh satu berkas")
	}
	f, err := os.Open(abs)
	if err != nil {
		return err
	}
	defer f.Close()
	w.Header().Set("Content-Disposition",
		"attachment; filename=\""+filepath.Base(abs)+"\"")
	w.Header().Set("Content-Type", mimeDariNama(filepath.Base(abs)))
	_, err = io.Copy(w, f)
	return err
}

// mimeDariNama: tebakan Content-Type sederhana untuk unduhan.
func mimeDariNama(nama string) string {
	switch strings.ToLower(filepath.Ext(nama)) {
	case ".log", ".txt", ".csv", ".json", ".md", ".go", ".ts", ".tsx", ".sql":
		return "text/plain; charset=utf-8"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".pdf":
		return "application/pdf"
	case ".zip":
		return "application/zip"
	case ".gz":
		return "application/gzip"
	default:
		return "application/octet-stream"
	}
}

// Tulis: buat/timpa berkas teks di dalam penjara.
// Ukuran maksimum BatasBaca supaya panel tidak dipakai menulis blob.
func Tulis(rel, isi string) error {
	abs, _, err := Bersihkan(rel)
	if err != nil {
		return err
	}
	if len(isi) > BatasBaca {
		return fmt.Errorf("isi lebih besar dari %d byte", BatasBaca)
	}
	return os.WriteFile(abs, []byte(isi), 0644)
}

// Hapus: buang berkas/konten direktori (bukan direktori itu sendiri —
// penjara tidak boleh tergerus dari dalam). Gagal bila masih ada
// isi direktori — panel harus mengosongkan dulu (sengaja, aman).
func Hapus(rel string) error {
	abs, relatif, err := Bersihkan(rel)
	if err != nil {
		return err
	}
	if relatif == "" {
		return fmt.Errorf("tidak bisa menghapus akar penjara")
	}
	info, err := os.Stat(abs)
	if err != nil {
		return fmt.Errorf("tidak ada: %v", err)
	}
	if info.IsDir() {
		kosong, err := direktoriKosong(abs)
		if err != nil {
			return err
		}
		if !kosong {
			return fmt.Errorf("direktori tidak kosong — kosongkan dulu")
		}
		return os.Remove(abs)
	}
	return os.Remove(abs)
}

func direktoriKosong(abs string) (bool, error) {
	f, err := os.Open(abs)
	if err != nil {
		return false, err
	}
	defer f.Close()
	_, err = f.Readdirnames(1)
	if err == io.EOF {
		return true, nil
	}
	return err == nil, err
}

// GantiNama: pindahkan berkas/direktori dalam penjara.
// Tujuan ikut dibersihkan — dua-duanya harus di dalam penjara.
func GantiNama(dari, ke string) error {
	absD, _, err := Bersihkan(dari)
	if err != nil {
		return err
	}
	absK, _, err := Bersihkan(ke)
	if err != nil {
		return err
	}
	if _, err := os.Stat(absD); err != nil {
		return fmt.Errorf("sumber tidak ada: %v", err)
	}
	return os.Rename(absD, absK)
}

// StatistikAkar: ringkasan penjara untuk halaman utama shell
// (jumlah berkas + total byte, tanpa rekursi dalam — satu level).
func StatistikAkar() (jumlah int64, byte_ int64) {
	ent, err := os.ReadDir(JailRoot)
	if err != nil {
		return 0, 0
	}
	for _, e := range ent {
		info, err := e.Info()
		if err != nil || e.IsDir() {
			continue
		}
		jumlah++
		byte_ += info.Size()
	}
	return jumlah, byte_
}
