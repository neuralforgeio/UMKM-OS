package backup

// Tes cadangan data (run-7 + hotfix 2.1.1 murni Go) — DIVERIFIKASI
// TERHADAP POSTGRES SUNGGUHAN, bukan stub: seluruh alur dump gzip ->
// daftar -> retensi -> terapkan (restore) dijalankan ke instance
// PostgreSQL uji. Sejak 2.1.1 dump/pemulihan MURNI GO (tanpa
// pg_dump/psql eksternal — akar kegagalan mesin pemilik: pg_dump klien
// 15 menolak server 18), jadi tes tidak lagi memerlukan alat apa pun
// di PATH; cukup DB_URL_UJI (skip bila kosong — CI tanpa postgres).

import (
	"bytes"
	"compress/gzip"
	"context"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// kunciNodeUji: dump sungguhan mem-DROP lalu mengisi ulang banyak
// tabel; dua tes DB paralel pada node yang sama pernah saling
// mengunci (deadlock 40P01 transien). `go test ./...` menjalankan
// tiap paket sebagai PROSES terpisah (internal/db juga menulis ke
// node yang sama), jadi kuncinya berkas flock lintas proses - bukan
// mutex intra-proses.
var kunciNodeUji = &berkasKunci{path: filepath.Join(os.TempDir(), "umkm-uji-db.lock")}

type berkasKunci struct {
	path string
	f    *os.File
}

func (k *berkasKunci) Lock() {
	k.f, _ = os.OpenFile(k.path, os.O_CREATE|os.O_RDWR, 0o644)
	kunciFlock(k.f)
}
func (k *berkasKunci) Unlock() {
	if k.f != nil {
		bukaKunciFlock(k.f)
		k.f.Close()
		k.f = nil
	}
}

func TestNamaBerkasPolaWaktu(t *testing.T) {
	n := NamaBerkas(time.Date(2026, 11, 17, 10, 15, 30, 0, time.UTC))
	if n != "umkm-backup-20261117-101530.sql.gz" {
		t.Fatalf("nama = %q", n)
	}
	if d := WaktuDariNama(n); d != "2026-11-17 10:15:30" {
		t.Fatalf("waktu dari nama = %q", d)
	}
	// nama asing dikembalikan apa adanya
	if d := WaktuDariNama("berkas-lain.gz"); d != "berkas-lain.gz" {
		t.Fatalf("nama asing harus apa adanya: %q", d)
	}
}

func TestRetensiDanDaftarUrutTerbaruDulu(t *testing.T) {
	dir := t.TempDir()
	for _, nm := range []string{
		"umkm-backup-20260101-000000.sql.gz",
		"umkm-backup-20260102-000000.sql.gz",
		"umkm-backup-20260103-000000.sql.gz",
		"lain.txt",
		"umkm-backup-beda.sql.gz", // pola sah, waktu tak dikenali
	} {
		if err := os.WriteFile(filepath.Join(dir, nm), []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	daftar, err := Daftar(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(daftar) != 4 {
		t.Fatalf("daftar harus 4 (umkm-backup-*.sql.gz), dapat %d", len(daftar))
	}
	if daftar[0].Nama != "umkm-backup-20260103-000000.sql.gz" {
		t.Fatalf("terbaru dulu: %q", daftar[0].Nama)
	}
	hapus, err := Retensi(dir, 2)
	if err != nil {
		t.Fatal(err)
	}
	if hapus != 2 {
		t.Fatalf("retensi 2 harus menghapus 2, dapat %d", hapus)
	}
	daftar, _ = Daftar(dir)
	if len(daftar) != 2 {
		t.Fatalf("setelah retensi harus 2, dapat %d", len(daftar))
	}
	// keep <= 0 tanpa retensi
	if n, _ := Retensi(dir, 0); n != 0 {
		t.Fatalf("keep 0 = tanpa retensi")
	}
}

// Nama terlalu panjang guard: Terapkan menolak nama bercacat TANPA
// menyentuh filesystem node mana pun.
func TestTerapkanNamaTidakSah(t *testing.T) {
	for _, jahat := range []string{"../etc/passwd", "a/b.sql.gz", "bukan-gz", ""} {
		if err := Terapkan(context.Background(), "x", jahat, "postgres://u:p@h/db"); err == nil {
			t.Fatalf("nama %q harus ditolak", jahat)
		}
	}
}

// DB_URL_UJI (dipasang skrip verifikasi sandbox): bila terisi, jalankan
// siklus SUNGGUHAN: dump -> daftar -> terapkan ke database uji kedua ->
// data terbaca. MURNI GO: tidak ada syarat alat eksternal.
func TestSiklusDumpTerapkanSungguhan(t *testing.T) {
	kunciNodeUji.Lock()
	defer kunciNodeUji.Unlock()
	url := os.Getenv("DB_URL_UJI")
	url2 := os.Getenv("DB_URL_UJI_2")
	if url == "" || url2 == "" {
		t.Skip("butuh DB_URL_UJI + DB_URL_UJI_2 (dua PostgreSQL uji)")
	}
	siapkanNodeUji(t, url)
	siapkanNodeUji(t, url2)

	dir := t.TempDir()
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	nama, ukuran, err := Dump(ctx, dir, url, time.Now())
	if err != nil {
		t.Fatalf("dump gagal: %v", err)
	}
	if ukuran < 100 {
		t.Fatalf("dump terlalu kecil (%d byte) — dicurigai kosong", ukuran)
	}
	if _, err := os.Stat(filepath.Join(dir, nama)); err != nil {
		t.Fatalf("berkas dump tidak ada: %v", err)
	}
	daftar, err := Daftar(dir)
	if err != nil || len(daftar) != 1 || daftar[0].Nama != nama {
		t.Fatalf("daftar harus memuat 1 berkas: %v %v", daftar, err)
	}

	// Terapkan ke node kedua: salinan menerima seluruh schema + data —
	// migrasi DDL di-emit dari paket schema (satu sumber kebenaran).
	if err := Terapkan(ctx, dir, nama, url2); err != nil {
		t.Fatalf("terapkan ke salinan gagal: %v", err)
	}

	// Idempoten-di-sisi-berkas: terapkan ULANG dump sama ke node yang
	// sudah terisi (bukti "--clean" ala Go: DROP dulu lalu isi ulang).
	if err := Terapkan(ctx, dir, nama, url2); err != nil {
		t.Fatalf("terapkan ulang ke node terisi gagal: %v", err)
	}

	// Dump kedua dari node kedua + retensi 1 -> folder tetap 1 berkas
	// (Jalankan = dump + retensi).
	if _, _, _, err := Jalankan(ctx, dir, url2, 1); err != nil {
		t.Fatalf("jalankan (dump+retensi) gagal: %v", err)
	}
	daftar, _ = Daftar(dir)
	if len(daftar) != 1 {
		t.Fatalf("retensi 1 harus menyisakan 1 berkas, dapat %d", len(daftar))
	}
	if strings.Contains(daftar[0].Nama, "tmp") {
		t.Fatalf("berkas .tmp tertinggal: %q", daftar[0].Nama)
	}
}

// TestIsiDumpMembawaDDL: dump node uji mengandung CREATE TABLE dari
// schema + DROP CASCADE + setval — bukti berkas SQL polos bisa
// diperiksa manusia (keputusan desain 2.1.0 yang dipertahankan).
// Node uji dibuat dulu lewat Terapkan dump tandon agar tes ini tidak
// bergantung pada urutan tes lain (node bisa saja dikosongkan).
func TestIsiDumpMembawaDDL(t *testing.T) {
	kunciNodeUji.Lock()
	defer kunciNodeUji.Unlock()
	url := os.Getenv("DB_URL_UJI")
	if url == "" {
		t.Skip("butuh DB_URL_UJI (PostgreSQL uji)")
	}
	// siapkan schema + satu baris data mandiri untuk tes ini
	siapkanNodeUji(t, url)
	dir := t.TempDir()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	nama, _, err := Dump(ctx, dir, url, time.Now())
	if err != nil {
		t.Fatalf("dump gagal: %v", err)
	}
	b, err := os.ReadFile(filepath.Join(dir, nama))
	if err != nil {
		t.Fatal(err)
	}
	// berkas cadangan gzip: dekompresi dulu sebelum mencari penanda SQL.
	gr, err := gzip.NewReader(bytes.NewReader(b))
	if err != nil {
		t.Fatalf("berkas bukan gzip sah: %v", err)
	}
	isiB, err := io.ReadAll(gr)
	gr.Close()
	if err != nil {
		t.Fatalf("gagal membaca isi cadangan: %v", err)
	}
	isi := string(isiB)
	for _, penanda := range []string{"DROP TABLE IF EXISTS", "CREATE TABLE IF NOT EXISTS", "INSERT INTO public.", "setval"} {
		if !strings.Contains(isi, penanda) {
			t.Fatalf("isi dump harus memuat %q", penanda)
		}
	}
}

// siapkanNodeUji: pastikan schema + minimal satu baris data ada di
// node (tes isi dump butuh INSERT nyata di keluaran). Aman dipanggil
// berulang: replay DDL (IF NOT EXISTS) + baris hanya dibuat bila
// users kosong (sisa selftest tidak diganggu).
func siapkanNodeUji(t *testing.T, url string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	// Terapkan dump "tandon" dari node itu sendiri: dump selalu membawa
	// DDL lengkap dari internal/schema apa pun isi node sekarang.
	dir := t.TempDir()
	nama, _, err := Dump(ctx, dir, url, time.Now())
	if err != nil {
		t.Fatalf("siapkan node uji (dump): %v", err)
	}
	if err := Terapkan(ctx, dir, nama, url); err != nil {
		t.Fatalf("siapkan node uji (terapkan DDL): %v", err)
	}
	conn, err := sambung(ctx, url)
	if err != nil {
		t.Fatalf("sambung node uji: %v", err)
	}
	defer conn.Close(ctx)
	var n int
	if err := conn.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&n); err != nil {
		t.Fatalf("hitung users: %v", err)
	}
	if n == 0 {
		if _, err := conn.Exec(ctx, `INSERT INTO users (name, email, password_hash, role)
			VALUES ('uji cadangan', 'uji-cadangan@umkm.local', 'x', 'OWNER')`); err != nil {
			t.Fatalf("seed baris uji: %v", err)
		}
	}
}

// TestDumpMenolakTabelLegacyPrisma (run-9): reproduksi LINGKUNGAN
// PEMILIK — pusat memuat tabel legacy public._prisma_migrations (sisa
// alat demo era lama) yang TIDAK punya CREATE di schema.Pernyataan.
// Run-8 gagal di sini: dump menulis INSERT _prisma_migrations tanpa
// CREATE-nya sehingga pemulihan ke node kosong mati 42P01. Dump kini
// menyaring tabel aplikasi saja (schema.TabelSet) — tes ini
// mengunci perilaku itu selamanya.
func TestDumpMenolakTabelLegacyPrisma(t *testing.T) {
	kunciNodeUji.Lock()
	defer kunciNodeUji.Unlock()
	url := os.Getenv("DB_URL_UJI")
	url2 := os.Getenv("DB_URL_UJI_2")
	if url == "" || url2 == "" {
		t.Skip("butuh DB_URL_UJI + DB_URL_UJI_2 (dua PostgreSQL uji)")
	}
	siapkanNodeUji(t, url)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// pasang "kotoran" era lama persis mesin pemilik
	conn, err := sambung(ctx, url)
	if err != nil {
		t.Fatalf("sambung pusat: %v", err)
	}
	defer conn.Close(ctx)
	// tabel legacy dulu sempat dibuat 3-kolom oleh skenario lain:
	// gugurkan supaya versi lengkap di bawah pasti terpasang
	// (siapkanNodeUji men-drop seluruh schema saat mulai, jadi ini
	// hanya menjaga ketika tes berjalan berulang dalam satu proses).
	if _, err := conn.Exec(ctx, `DROP TABLE IF EXISTS public._prisma_migrations`); err != nil {
		t.Fatalf("gugurkan tabel legacy lama: %v", err)
	}
	if _, err := conn.Exec(ctx, `CREATE TABLE public._prisma_migrations (
		id VARCHAR(36) NOT NULL PRIMARY KEY,
		finished_at TIMESTAMPTZ,
		migration_name VARCHAR(255),
		logs TEXT,
		rolled_back_at TIMESTAMPTZ,
		started_at TIMESTAMPTZ,
		applied_steps_count INT)`); err != nil {
		t.Fatalf("buat tabel legacy: %v", err)
	}
	if _, err := conn.Exec(ctx, `INSERT INTO public._prisma_migrations
		(id, migration_name, started_at, applied_steps_count)
		VALUES ('a1a1a1a1-1111-1111-1111-111111111111', '20240101000000_init', NOW(), 1)
		ON CONFLICT (id) DO NOTHING`); err != nil {
		t.Fatalf("isi tabel legacy: %v", err)
	}

	// salinan dikosongkan total (node baru belumlah pernah terisi)
	if err := kosongkanNode(ctx, url2); err != nil {
		t.Fatalf("kosongkan salinan: %v", err)
	}

	// DUMP pusat kotor -> dump HARUS bersih dari tabel legacy
	dir := t.TempDir()
	nama, _, err := Dump(ctx, dir, url, time.Now())
	if err != nil {
		t.Fatalf("dump gagal: %v", err)
	}
	b, err := os.ReadFile(filepath.Join(dir, nama))
	if err != nil {
		t.Fatal(err)
	}
	gr, err := gzip.NewReader(bytes.NewReader(b))
	if err != nil {
		t.Fatal(err)
	}
	isiB, err := io.ReadAll(gr)
	gr.Close()
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(isiB), "_prisma_migrations") {
		t.Fatal("dump masih memuat tabel legacy _prisma_migrations — filter TabelSet bocor")
	}

	// pemulihan ke node kosong harus SUKSES (run-8: 42P01 di sini)
	if err := Terapkan(ctx, dir, nama, url2); err != nil {
		t.Fatalf("pemulihan ke salinan kosong gagal: %v", err)
	}

	// baris aplikasi tetap sampai + legacy tidak ikut pindah
	conn2, err := sambung(ctx, url2)
	if err != nil {
		t.Fatalf("sambung salinan: %v", err)
	}
	defer conn2.Close(ctx)
	var n int
	if err := conn2.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&n); err != nil || n < 1 {
		t.Fatalf("baris users tidak sampai ke salinan (n=%d err=%v)", n, err)
	}
	var legacy bool
	if err := conn2.QueryRow(ctx, `SELECT to_regclass('public._prisma_migrations') IS NULL`).Scan(&legacy); err != nil || !legacy {
		t.Fatalf("tabel legacy ikut terbawa ke salinan (ada=%v err=%v)", !legacy, err)
	}
}

// kosongkanNode: jatuhkan seluruh skema public node uji (dipakai tes
// legacy untuk mensimulasikan node salinan baru yang belum terisi).
func kosongkanNode(ctx context.Context, url string) error {
	conn, err := sambung(ctx, url)
	if err != nil {
		return err
	}
	defer conn.Close(ctx)
	_, err = conn.Exec(ctx, `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`)
	return err
}

// TestDumpMenjaminKolomLegacyDibuat (run-10): reproduksi kedua lapisan
// drift mesin pemilik — kolom era demo (audit_logs.ip_address, TIDAK
// pernah di-CREATE oleh Pernyataan) yang BERISI DATA nyata. Dump
// memindahkan data dengan kolom-sekarangnya, pemulihan hanya
// menjalankan Pernyataan -> INSERT mati 42703 "column does not
// exist". Fix run-10: DDL cadangan BERSIFAT MENJELASKAN-DIRI — tiap
// kolom yang di-dump dijamin hadir via ALTER ADD COLUMN IF NOT
// EXISTS dengan tipe dari katalog SUMBER. Tes ini mengunci itu.
func TestDumpMenjaminKolomLegacyDibuat(t *testing.T) {
	kunciNodeUji.Lock()
	defer kunciNodeUji.Unlock()
	url := os.Getenv("DB_URL_UJI")
	url2 := os.Getenv("DB_URL_UJI_2")
	if url == "" || url2 == "" {
		t.Skip("butuh DB_URL_UJI + DB_URL_UJI_2 (dua PostgreSQL uji)")
	}
	siapkanNodeUji(t, url)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// drift persis pemilik: kolom demo ip_address di audit_logs BERISI DATA
	conn, err := sambung(ctx, url)
	if err != nil {
		t.Fatalf("sambung pusat: %v", err)
	}
	defer conn.Close(ctx)
	if _, err := conn.Exec(ctx, `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT`); err != nil {
		t.Fatalf("tanam kolom legacy: %v", err)
	}
	if _, err := conn.Exec(ctx, `INSERT INTO audit_logs (user_id, action, ip, ip_address)
		SELECT id, 'login-demo', '10.0.0.1', '192.168.1.50' FROM users LIMIT 1`); err != nil {
		t.Fatalf("isi kolom legacy: %v", err)
	}

	// salinan dikosongkan total
	if err := kosongkanNode(ctx, url2); err != nil {
		t.Fatalf("kosongkan salinan: %v", err)
	}

	// dump memuat data ip_address + ALTER penjaminnya; terapkan SUKSES
	dir := t.TempDir()
	nama, _, err := Dump(ctx, dir, url, time.Now())
	if err != nil {
		t.Fatalf("dump gagal: %v", err)
	}
	if err := Terapkan(ctx, dir, nama, url2); err != nil {
		t.Fatalf("pemulihan ke salinan gagal (run-9 mati persis di sini): %v", err)
	}

	// data legacy benar-benar terpulihkan di salinan
	conn2, err := sambung(ctx, url2)
	if err != nil {
		t.Fatalf("sambung salinan: %v", err)
	}
	defer conn2.Close(ctx)
	var n int
	if err := conn2.QueryRow(ctx, `SELECT COUNT(*) FROM audit_logs
		WHERE ip_address = '192.168.1.50'`).Scan(&n); err != nil || n < 1 {
		t.Fatalf("baris kolom legacy tidak terpulihkan (n=%d err=%v)", n, err)
	}
}
