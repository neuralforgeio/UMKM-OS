package db

// Tes SALINAN DATABASE (run-7) — dua node PostgreSQL SUNGGUHAN:
// failover (pusat mati -> salinan mengambil alih) dan sinkron balik
// (perubahan zaman-salinan dipulangkan ke pusat saat hidup kembali).
// Butuh env DB_URL_UJI + DB_URL_UJI_2 (dipasang skrip verifikasi);
// tanpa itu tes skip (CI tanpa postgres) — tapi bagian logika murni
// (samarURL, riwayat) tetap berjalan.

import (
	"context"
	"os"
	"path/filepath"
	"syscall"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/neuralforgeio/internal/backup"
	"github.com/neuralforgeio/internal/schema"
)

// kunciDBUji: `go test ./...` menjalankan tiap paket sebagai PROSES
// terpisah, dan tes paket backup mem-DROP schema node yang sama yang
// dipakai tes ini - kunci berkas lintas proses (nama identik dengan
// kunci di paket backup) supaya tes DB sungguhan berjalan serial.
func kunciDBUji() (*os.File, func()) {
	f, err := os.OpenFile(filepath.Join(os.TempDir(), "umkm-uji-db.lock"), os.O_CREATE|os.O_RDWR, 0o644)
	if err != nil {
		return nil, func() {}
	}
	_ = syscall.Flock(int(f.Fd()), syscall.LOCK_EX)
	return f, func() { _ = syscall.Flock(int(f.Fd()), syscall.LOCK_UN); f.Close() }
}

func TestSamarURLMenyembunyikanPassword(t *testing.T) {
	got := samarURL("postgres://umkm:rahasia@db-pusat:5432/umkmos?sslmode=disable")
	if got != "@db-pusat:5432/umkmos" {
		t.Fatalf("samarURL = %q", got)
	}
	if got := samarURL("tanpa-credential"); got != "tanpa-credential" {
		t.Fatalf("URL tanpa @ dikembalikan apa adanya: %q", got)
	}
}

func TestNodeSehatMenolakURLKosong(t *testing.T) {
	if nodeSehat("") {
		t.Fatal("URL kosong tidak mungkin sehat")
	}
}

// Skenario penuh (meninggalkan jejak di 2 database uji):
//  1. dua node hidup; aktif = pusat
//  2. simulasikan pusat mati (URL palsu) -> pindahNode harus TETAP
//     di pusat bila salinan tidak sehat; kami pakai salinan sehat
//     sehingga pindah ke salinan terjadi
//  3. tulis transaksi zaman-salinan ke salinan lewat Pool
//  4. hidupkan pusat kembali -> sinkronBalikKePusat memulangkan
//  5. verifikasi baris sama + nodeAktif kembali "pusat".
func TestFailoverDanSinkronBalikSungguhan(t *testing.T) {
	_, buka := kunciDBUji()
	defer buka()
	uPusat := os.Getenv("DB_URL_UJI")
	uSalinan := os.Getenv("DB_URL_UJI_2")
	if uPusat == "" || uSalinan == "" {
		t.Skip("butuh DB_URL_UJI + DB_URL_UJI_2 (dua PostgreSQL uji)")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	// Bersihkan kedua node: schema kosong supaya hitungan baris pasti.
	for _, u := range []string{uPusat, uSalinan} {
		p, err := poolBaru(ctx, u)
		if err != nil {
			t.Fatalf("node uji tidak terjangkau: %v", err)
		}
		if _, err := p.Exec(ctx, `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`); err != nil {
			t.Fatalf("gagal reset node uji: %v", err)
		}
		p.Close()
	}

	// Pasang salinan + pool pusat + heartbeat (migrasi tabel uji inti
	// tidak dibutuhkan; cukup dbheartbeat + users untuk data).
	foMu.Lock()
	urlPusat = uPusat
	urlSalinanV = uSalinan
	nodeAktif = "pusat"
	foMu.Unlock()

	pPusat, err := pgxpool.New(ctx, uPusat)
	if err != nil {
		t.Fatal(err)
	}
	if err := pPusat.Ping(ctx); err != nil {
		t.Fatal(err)
	}
	Pool = pPusat
	if err := siapkanHeartbeat(); err != nil {
		t.Fatalf("siapkan heartbeat: %v", err)
	}

	PasangSinkron(sinkronBalikTest)
	defer func() { sinkronFn = nil }()

	// --- 2) failover manual ke salinan -------------------------------
	if err := PaksaPindahKe("salinan"); err != nil {
		t.Fatalf("pindah ke salinan gagal: %v", err)
	}
	if NodeAktif() != "salinan" {
		t.Fatalf("node aktif harus salinan, dapat %q", NodeAktif())
	}

	// --- 3) zaman-salinan: tulis data lewat Pool (node aktif) --------
	// Tabel users dipasang DDL penuh dari internal/schema — konsisten
	// dengan produksi (sinkron balik dump memuat seluruh kolom; tabel
	// versi mini bikin INSERT gagal 23502).
	for _, stmt := range schema.Pernyataan {
		if _, err := Pool.Exec(ctx, stmt); err != nil {
			t.Fatalf("pasang DDL schema di node aktif: %v", err)
		}
	}
	_, err = Pool.Exec(ctx, `INSERT INTO users (name, email, password_hash, role)
		VALUES ('kasir zaman salinan', 'kasir-zaman@umkm.local', 'x', 'OWNER')`)
	if err != nil {
		t.Fatalf("tulis zaman-salinan: %v", err)
	}

	// --- 4) pusat "hidup lagi" -> sinkron balik ----------------------
	sinkronBalikKePusat()

	// --- 5) verifikasi -------------------------------------------------
	if NodeAktif() != "pusat" {
		t.Fatalf("setelah sinkron balik node aktif harus pusat, dapat %q", NodeAktif())
	}
	var n int
	if err := Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE name='kasir zaman salinan'`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("baris zaman-salinan hilang di pusat (n=%d err=%v)", n, err)
	}
	_ = n
	riwayat := RiwayatPindahan()
	if len(riwayat) < 2 {
		t.Fatalf("riwayat pindahan harus >= 2 (failover + failback), dapat %d", len(riwayat))
	}
	if riwayat[0].Ke != "pusat" || riwayat[1].Ke != "salinan" {
		t.Fatalf("urutan riwayat salah: %+v", riwayat[:2])
	}
	if riwayat[0].Baris != 1 {
		t.Fatalf("riwayat failback harus mencatat 1 baris users dipulangkan, dapat %d", riwayat[0].Baris)
	}
}

// sinkronBalikTest: adaptor produksi — sejak 2.1.1 dump/pemulihan
// MURNI GO, dan tes boleh langsung mengimpor paket backup dari paket
// db (dependensi db->backup untuk TES tidak melingkar: produksi tetap
// lewat suntikan PasangSinkron).
func sinkronBalikTest(dari, ke string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	return backup.SinkronBalik(ctx, dari, ke)
}
