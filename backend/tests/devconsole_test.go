package tests

// Tes GERBANG DEVELOPER (v2.2.0) — enam fitur konsol developer:
// sesi (tendang), bendera fitur, pengaturan terdaftar, SQL console
// hanya-baca, kesehatan, metrik. Bagian murni (validasi kueri, aturan
// tipe) berjalan tanpa DB; bagian DB butuh DB_URL_UJI (skrip verifikasi
// memasangnya; tanpa itu skip — CI tanpa postgres).

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/neuralforgeio/internal/auth"
	"github.com/neuralforgeio/internal/db"
	"github.com/neuralforgeio/internal/handler"
	"github.com/neuralforgeio/internal/schema"
)

// hubungkanUji: buka pool + pasang schema (tabel sessions/flags/settings
// ikut terbuat lewat Pernyataan). Node uji dipakai bersama paket lain
// lewat kunci berkas (lihat backup_test.go) — di sisi tests paket ini
// tes DB berjalan serial dalam satu proses.
func hubungkanUji(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DB_URL_UJI")
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatalf("buka pool uji: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	for _, stmt := range schema.Pernyataan {
		if _, err := pool.Exec(ctx, stmt); err != nil {
			t.Fatalf("pasang schema (stmt pertama gagal): %v", err)
		}
	}
	return pool
}

// ---- SQL console: validasi murni -----------------------------------------

func TestValidasiKueriKonsol(t *testing.T) {
	kasus := []struct {
		nama      string
		kueri     string
		mauTolak  bool
		mauAlasan string
	}{
		{"select sederhana lolos", "SELECT 1", false, ""},
		{"insert ditolak", "INSERT INTO users VALUES (1)", true, "hanya SELECT"},
		{"update ditolak", "UPDATE users SET name='x' WHERE id=1", true, "hanya SELECT"},
		{"delete ditolak", "DELETE FROM users", true, "hanya SELECT"},
		{"drop ditolak", "DROP TABLE users", true, "hanya SELECT"},
		{"select drop di tengah ditolak", "SELECT * FROM users; DROP TABLE users", true, "titik-koma"},
		{"truncate ditolak", "TRUNCATE users", true, "hanya SELECT"},
		{"komentar -- dibuang, lolos", "SELECT 1 -- hapus semuanya", false, ""},
		{"komentar blok dibuang", "SELECT /* rahasia */ 2", false, ""},
		{"kolom created_at TIDAK tertangkap (kata utuh)", "SELECT created_at FROM audit_logs LIMIT 5", false, ""},
		{"CTE with ditolak (bisa menulis lewat INSERT .. RETURNING)", "WITH x AS (SELECT 1) SELECT * FROM x", true, "hanya SELECT"},
		{"set ditolak", "SET search_path TO publik", true, "hanya SELECT"},
		{"explain ditolak", "EXPLAIN SELECT 1", true, "hanya SELECT"},
		{"copy ditolak", "COPY users TO '/tmp/x'", true, "hanya SELECT"},
		{"grant ditolak", "GRANT ALL ON users TO publik", true, "hanya SELECT"},
	}
	for _, k := range kasus {
		_, alasan := handler.ValidasiKueriKonsol(k.kueri)
		if k.mauTolak && alasan == "" {
			t.Errorf("%s: seharusnya ditolak, kueri lolos: %q", k.nama, k.kueri)
		}
		if !k.mauTolak && alasan != "" {
			t.Errorf("%s: seharusnya lolos, ditolak: %q alasan=%q", k.nama, k.kueri, alasan)
		}
		if k.mauTolak && k.mauAlasan != "" && !containsFold(alasan, k.mauAlasan) {
			t.Errorf("%s: alasan %q tidak memuat %q", k.nama, alasan, k.mauAlasan)
		}
	}
}

func containsFold(s, sub string) bool {
	// kecilkan keduanya
	a, b := s, sub
	if len(b) > len(a) {
		return false
	}
	for i := 0; i+len(b) <= len(a); i++ {
		if lowerEq(a[i:i+len(b)], b) {
			return true
		}
	}
	return false
}

func lowerEq(a, b string) bool {
	for i := 0; i < len(a); i++ {
		ca, cb := a[i], b[i]
		if ca >= 'A' && ca <= 'Z' {
			ca += 32
		}
		if cb >= 'A' && cb <= 'Z' {
			cb += 32
		}
		if ca != cb {
			return false
		}
	}
	return true
}

func TestValidasiKueriPaksaLimit(t *testing.T) {
	q, alasan := handler.ValidasiKueriKonsol("SELECT id FROM users")
	if alasan != "" {
		t.Fatalf("kueri tanpa limit ditolak: %q", alasan)
	}
	if !containsFold(q, "LIMIT 100") {
		t.Fatalf("LIMIT tidak dipasang: %q", q)
	}
	q, _ = handler.ValidasiKueriKonsol("SELECT id FROM users LIMIT 99999")
	if !containsFold(q, "LIMIT 500") {
		t.Fatalf("LIMIT besar tidak dipotong ke 500: %q", q)
	}
	q, _ = handler.ValidasiKueriKonsol("SELECT id FROM users LIMIT 10")
	if !containsFold(q, "LIMIT 10") {
		t.Fatalf("LIMIT kecil yang sah ikut diubah: %q", q)
	}
}

// ---- Bendera & pengaturan: aturan daftar (murni) --------------------------

func TestBenderaHanyaTerdaftar(t *testing.T) {
	if len(handler.BENDERA_KETERANGAN) < 6 {
		t.Fatalf("bendera terdaftar terlalu sedikit: %d", len(handler.BENDERA_KETERANGAN))
	}
	for kunci, ket := range handler.BENDERA_KETERANGAN {
		if ket == "" {
			t.Errorf("bendera %s tanpa keterangan", kunci)
		}
	}
}

func TestPengaturanTipeSah(t *testing.T) {
	if _, ok := handler.PENGATURAN_DAFTAR["jwt_secret"]; ok {
		t.Fatal("rahasia TIDAK boleh ada di registri pengaturan")
	}
	for kunci, meta := range handler.PENGATURAN_DAFTAR {
		if meta[0] != "int" && meta[0] != "bool" && meta[0] != "string" {
			t.Errorf("pengaturan %s tipe aneh: %q", kunci, meta[0])
		}
		if meta[1] == "" {
			t.Errorf("pengaturan %s tanpa keterangan", kunci)
		}
	}
}

// ---- DB: sesi tendang + bendera + pengaturan (butuh DB_URL_UJI) ---------

func TestSesiTendangBenderaPengaturanDB(t *testing.T) {
	if os.Getenv("DB_URL_UJI") == "" {
		t.Skip("butuh DB_URL_UJI (skrip verifikasi memasangnya)")
	}
	db.Pool = hubungkanUji(t)

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	// dua akun uji: satu "korban" sesinya ditendang, satu "developer".
	korbanID, devID := buatAkunUji(t, ctx, "sesi-korban", "sesi-dev")

	// sesi korban
	sid := auth.SidBaru()
	_, err := db.Pool.Exec(ctx,
		`INSERT INTO sessions (id, user_id, token_id, ip, user_agent, expires_at)
		 VALUES ($1, $2, 'tok', '10.0.0.9', 'uji-agent', NOW() + INTERVAL '2 hours')`, sid, korbanID)
	if err != nil {
		t.Fatalf("tanam sesi: %v", err)
	}

	// sesi masih hidup?
	var hidup bool
	err = db.Pool.QueryRow(ctx,
		`SELECT revoked_at IS NULL AND expires_at > NOW() FROM sessions WHERE id=$1`, sid).Scan(&hidup)
	if err != nil || !hidup {
		t.Fatalf("sesi harusnya hidup (err=%v hidup=%v)", err, hidup)
	}

	// tendang: UPDATE langsung (sama seperti RevokeSession)
	_, err = db.Pool.Exec(ctx,
		`UPDATE sessions SET revoked_at = NOW() WHERE id=$1 AND revoked_at IS NULL`, sid)
	if err != nil {
		t.Fatalf("tendang sesi: %v", err)
	}
	err = db.Pool.QueryRow(ctx,
		`SELECT revoked_at IS NULL AND expires_at > NOW() FROM sessions WHERE id=$1`, sid).Scan(&hidup)
	if err == nil && hidup {
		t.Fatal("sesi yang ditendang masih dianggap hidup — revocasi bocor")
	}

	// bendera: upsert + baca
	_, err = db.Pool.Exec(ctx,
		`INSERT INTO flags (key, value, updated_by, updated_at) VALUES ($1, TRUE, $2, NOW())
		 ON CONFLICT (key) DO UPDATE SET value = TRUE, updated_by = $2, updated_at = NOW()`,
		"forecast.enabled", devID)
	if err != nil {
		t.Fatalf("set bendera: %v", err)
	}
	if !handler.FlagAktif(ctx, "forecast.enabled") {
		t.Fatal("bendera yang dinyalakan terbaca mati")
	}
	if handler.FlagAktif(ctx, "bendera.yatim") {
		t.Fatal("bendera yatim terbaca hidup — harus fail-closed")
	}

	// pengaturan: upsert + baca
	_, err = db.Pool.Exec(ctx,
		`INSERT INTO settings (key, value, updated_by, updated_at) VALUES ($1, $2, $3, NOW())
		 ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()`,
		"low_stock_threshold", "7", devID)
	if err != nil {
		t.Fatalf("set pengaturan: %v", err)
	}
	var nilai string
	err = db.Pool.QueryRow(ctx, `SELECT value FROM settings WHERE key='low_stock_threshold'`).Scan(&nilai)
	if err != nil || nilai != "7" {
		t.Fatalf("pengaturan tidak tersimpan (nilai=%q err=%v)", nilai, err)
	}

	// bersih: akun uji hapus (sesi ikut CASCADE)
	_, _ = db.Pool.Exec(ctx, `DELETE FROM users WHERE id IN ($1, $2)`, korbanID, devID)
	_, _ = db.Pool.Exec(ctx, `DELETE FROM flags WHERE key='forecast.enabled'`)
	_, _ = db.Pool.Exec(ctx, `DELETE FROM settings WHERE key='low_stock_threshold'`)
	db.Pool.Close()
}

// buatAkunUji: dua akun uji ber-peran beda; id dikembalikan.
func buatAkunUji(t *testing.T, ctx context.Context, nama1, nama2 string) (int64, int64) {
	t.Helper()
	var id1, id2 int64
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO users (name, email, password_hash, role)
		VALUES ($1, $1 || '@uji.local', 'x', 'CASHIER') RETURNING id`, nama1).Scan(&id1)
	if err != nil {
		t.Fatalf("buat akun uji 1: %v", err)
	}
	err = db.Pool.QueryRow(ctx, `
		INSERT INTO users (name, email, password_hash, role)
		VALUES ($1, $1 || '@uji.local', 'x', 'DEVELOPER') RETURNING id`, nama2).Scan(&id2)
	if err != nil {
		t.Fatalf("buat akun uji 2: %v", err)
	}
	return id1, id2
}
