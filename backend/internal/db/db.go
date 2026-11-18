package db

import (
	"context"
	"crypto/rand"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/neuralforgeio/internal/auth"
	"github.com/neuralforgeio/internal/config"
	"github.com/neuralforgeio/internal/logger"
	"github.com/neuralforgeio/internal/schema"
)

// Pool = koneksi PostgreSQL yang dipakai seluruh aplikasi.
var Pool *pgxpool.Pool

func Connect() {
	logger.Info("[db] Menghubungkan ke PostgreSQL...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, config.DatabaseURL())
	if err != nil {
		fatal("[db] DATABASE_URL tidak valid: %v", err)
	}

	if err := pool.Ping(ctx); err != nil {
		fatal("[db] Gagal connect PostgreSQL: %v — pastikan container database jalan (docker compose up -d)", err)
	}
	Pool = pool
	logger.Success("[db] PostgreSQL connected")

	if err := migrate(ctx); err != nil {
		fatal("[db] Gagal migrasi schema: %v", err)
	}
	importLegacyOutlets(ctx)
	if err := seedOwner(ctx); err != nil {
		fatal("[db] Gagal seed owner awal: %v", err)
	}
	if err := seedDeveloper(ctx); err != nil {
		fatal("[db] Gagal seed developer: %v", err)
	}
	warnWeakOwnerPassword(ctx)
}

func fatal(format string, a ...interface{}) {
	logger.Error(format, a...)
	logger.Close()
	os.Exit(1)
}

func migrate(ctx context.Context) error {
	for _, stmt := range migrations {
		if _, err := Pool.Exec(ctx, stmt); err != nil {
			return err
		}
	}
	logger.Success("[db] Schema siap (11 tabel + sequence + index + scope outlet + SKU per outlet + audit IP + dbheartbeat)")
	return nil
}

// seedOwner membuat 1 akun OWNER kalau tabel users masih kosong.
// Password diambil dari env OWNER_PASSWORD; bila env kosong, dibuat
// password acak 16 karakter yang dicetak SEKALI ke layar konsol —
// sengaja tidak lewat logger supaya tidak ikut tersimpan ke file log
// harian (.log / .csv) yang bisa dibaca siapa pun yang pegang disk.
func seedOwner(ctx context.Context) error {
	var count int
	if err := Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	email := config.OwnerEmail()
	password := config.OwnerPassword()
	if password == "" {
		password = randomPassword(16)
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}
	if _, err := Pool.Exec(ctx,
		`INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'OWNER')`,
		"Owner UMKM", email, hash,
	); err != nil {
		return err
	}

	if config.OwnerPassword() == "" {
		fmt.Println()
		fmt.Println("======================================================================")
		fmt.Println(" OWNER AWAL DIBUAT (database masih kosong).")
		fmt.Printf(" Email    : %s\n", email)
		fmt.Println(" Password (acak — dicetak sekali saja, TIDAK tersimpan di log):")
		fmt.Printf("     %s\n", password)
		fmt.Println(" Salin sekarang -> login -> segera ganti ke password pilihan Anda")
		fmt.Println(" lewat POST /api/v1/auth/change-password atau menu ganti password.")
		fmt.Println(" Atur OWNER_PASSWORD di .env SEBELUM boot pertama untuk memilih")
		fmt.Println(" sendiri password awalnya.")
		fmt.Println("======================================================================")
		fmt.Println()
		logger.Success("[db] Owner awal dibuat -> %s (password acak — lihat kotak di atas)", email)
		return nil
	}
	logger.Success("[db] Owner awal dibuat -> %s (password mengikuti env OWNER_PASSWORD; segera ganti setelah login!)", email)
	return nil
}

// seedDeveloper membuat akun DEVELOPER (konsol lintas outlet) HANYA bila
// DEVELOPER_EMAIL & DEVELOPER_PASSWORD diatur di backend-go/.env — tanpa
// kredensial default yang bisa dipakai siapa pun yang membaca repo
// publik ini. Akun dibuat sekali; ganti password selanjutnya lewat menu
// ganti password biasa.
func seedDeveloper(ctx context.Context) error {
	email := config.DeveloperEmail()
	password := config.DeveloperPassword()
	if email == "" || password == "" {
		logger.Info("[db] Akun developer tidak dibuat — atur DEVELOPER_EMAIL & DEVELOPER_PASSWORD di backend-go/.env lalu restart untuk mengaktifkannya.")
		return nil
	}

	var exists bool
	if err := Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`, email).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		hash, err := auth.HashPassword(password)
		if err != nil {
			return err
		}
		tag, err := Pool.Exec(ctx,
			`INSERT INTO users (name, email, password_hash, role)
                         VALUES ($1, $2, $3, 'DEVELOPER')
                         ON CONFLICT (email) DO NOTHING`,
			"Developer", email, hash)
		if err != nil {
			return err
		}
		if tag.RowsAffected() > 0 {
			logger.Success("[db] Akun developer dibuat -> %s (password tidak pernah dicatat di log)", email)
		}
	}
	return nil
}

// warnWeakOwnerPassword mengingatkan bila OWNER_PASSWORD yang terpasang
// di .env pendek (<12 karakter) DAN itu memang password aktif akun owner
// — password pendek wajib diganti. Pemeriksaan generik: TIDAK ada nilai
// password apa pun yang tertulis di kode (repo ini publik).
func warnWeakOwnerPassword(ctx context.Context) {
	envPassword := config.OwnerPassword()
	if envPassword == "" || len(envPassword) >= 12 {
		return
	}
	var hash string
	err := Pool.QueryRow(ctx,
		`SELECT password_hash FROM users WHERE role = 'OWNER' AND email = $1 LIMIT 1`,
		config.OwnerEmail()).Scan(&hash)
	if err != nil || !auth.CheckPassword(hash, envPassword) {
		return
	}
	logger.Warn("[db] PERINGATAN: password owner saat ini kurang dari 12 karakter — segera ganti lewat POST /api/v1/auth/change-password atau menu ganti password!")
}

// randomPassword membuat password acak alfanumerik tanpa karakter yang
// mudah tertukar saat dibaca manusia (0/O, 1/l/I) — dipakai seed owner
// saat OWNER_PASSWORD tidak diatur di .env.
const passwordAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"

func randomPassword(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		fatal("[db] Gagal membuat password acak: %v", err)
	}
	for i := range b {
		b[i] = passwordAlphabet[int(b[i])%len(passwordAlphabet)]
	}
	return string(b)
}

// importLegacyOutlets (v1.4.0) — jembatan satu arah dari era Prisma.
//
// Boot PERTAMA v1.4.0 pada database lama: tabel `outlets` masih kosong,
// sedangkan identitas warung (nama/alamat/telepon/logo) hidup di tabel
// PascalCase "Outlet" milik Prisma. Identitas itu diimpor SEKALI ke
// `outlets` supaya tidak ada yang harus diatur ulang oleh pemilik.
// Karena guard "outlets sudah terisi -> lewati", boot-boot berikutnya
// (dan pembuatan outlet baru dari konsol) tidak pernah memicu ulang.
// Database baru tanpa Prisma: jatuh ke seed satu outlet "Warung".
func importLegacyOutlets(ctx context.Context) {
	var count int
	if err := Pool.QueryRow(ctx, `SELECT COUNT(*) FROM outlets`).Scan(&count); err != nil {
		fatal("[db] Gagal memeriksa tabel outlets: %v", err)
	}
	if count > 0 {
		return // sudah ada isinya — impor hanya sekali seumur hidup
	}

	var hasTable *bool
	if err := Pool.QueryRow(ctx,
		`SELECT to_regclass('public."Outlet"') IS NOT NULL`).Scan(&hasTable); err == nil &&
		hasTable != nil && *hasTable {
		tag, err := Pool.Exec(ctx, `
                        INSERT INTO outlets (name, address, phone, logo_mime_type, logo_data, logo_version, is_active, created_at)
                        SELECT "name",
                               COALESCE("address", ''),
                               COALESCE("phone", ''),
                               "logoMimeType",
                               "logoData",
                               COALESCE("logoVersion", 0),
                               COALESCE("isActive", TRUE),
                               COALESCE("createdAt", NOW())
                        FROM "Outlet"
                        ORDER BY "createdAt" ASC`)
		if err == nil && tag.RowsAffected() > 0 {
			logger.Success("[db] Identitas outlet diimpor dari tabel Prisma lama (sekali saja)")
			return
		}
	}

	if _, err := Pool.Exec(ctx, `INSERT INTO outlets (name) VALUES ('Warung')`); err != nil {
		fatal("[db] Gagal membuat outlet awal: %v", err)
	}
	logger.Success("[db] Outlet utama siap (default \"Warung\")")
}

var migrations = schema.Pernyataan
