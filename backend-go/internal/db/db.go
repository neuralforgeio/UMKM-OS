package db

import (
        "context"
        "crypto/rand"
        "errors"
        "fmt"
        "os"
        "time"

        "github.com/jackc/pgx/v5"
        "github.com/jackc/pgx/v5/pgxpool"

        "github.com/neuralforgeio/internal/auth"
        "github.com/neuralforgeio/internal/config"
        "github.com/neuralforgeio/internal/logger"
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
        if err := seedOwner(ctx); err != nil {
                fatal("[db] Gagal seed owner awal: %v", err)
        }
        if err := seedDeveloper(ctx); err != nil {
                fatal("[db] Gagal seed developer: %v", err)
        }
        warnDefaultOwnerPassword(ctx)
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
        logger.Success("[db] Schema siap (7 tabel + sequence + index)")
        return nil
}

// seedOwner membuat 1 akun OWNER kalau tabel users masih kosong.
// Password TIDAK dicatat ke log — file log harian tersimpan plain di disk.
func seedOwner(ctx context.Context) error {
        var count int
        if err := Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&count); err != nil {
                return err
        }
        if count > 0 {
                return nil
        }
        hash, err := auth.HashPassword(config.OwnerPassword())
        if err != nil {
                return err
        }
        if _, err := Pool.Exec(ctx,
                `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'OWNER')`,
                "Owner UMKM", config.OwnerEmail(), hash,
        ); err != nil {
                return err
        }
        logger.Success("[db] Owner awal dibuat -> %s (password mengikuti env OWNER_PASSWORD; segera ganti setelah login!)", config.OwnerEmail())
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
                return rotateLegacyDeveloper(ctx)
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
        return rotateLegacyDeveloper(ctx)
}

// Kredensial default lama yang pernah tercetak di repo publik — akun
// yang masih memakainya dianggap bocor dan diputar otomatis.
const (
        legacyDeveloperEmail    = ""
        legacyDeveloperPassword = ""
        defaultOwnerPassword    = ""
)

// rotateLegacyDeveloper menutup pintu belakang versi sebelumnya: bila ada
// akun developer lama yang masih memakai password default publik
// (dev123456), passwordnya diganti ke kombinasi acak yang dicetak SEKALI
// di layar konsol — sengaja tidak lewat logger supaya tidak ikut
// tersimpan ke file log harian (.log / .csv).
func rotateLegacyDeveloper(ctx context.Context) error {
        var id int64
        var hash string
        err := Pool.QueryRow(ctx,
                `SELECT id, password_hash FROM users WHERE role = 'DEVELOPER' AND email = $1`,
                legacyDeveloperEmail).Scan(&id, &hash)
        if errors.Is(err, pgx.ErrNoRows) {
                return nil // tidak ada akun lama -> tidak ada yang perlu diputar
        }
        if err != nil {
                return err
        }
        if !auth.CheckPassword(hash, legacyDeveloperPassword) {
                return nil // password sudah diganti pemiliknya -> aman
        }

        // Bila DEVELOPER_PASSWORD diatur di .env, rotasi langsung memakai
        // password pilihan pemilik (tidak perlu dicetak lagi). Bila tidak,
        // pakai password acak yang dicetak sekali di layar konsol.
        newPassword := config.DeveloperPassword()
        if newPassword == "" {
                newPassword = randomPassword(16)
        }
        newHash, err := auth.HashPassword(newPassword)
        if err != nil {
                return err
        }
        if _, err := Pool.Exec(ctx,
                `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
                newHash, id); err != nil {
                return err
        }

        if config.DeveloperPassword() != "" {
                logger.Success("[db] Password default lama akun developer diganti mengikuti DEVELOPER_PASSWORD di .env")
                return nil
        }
        fmt.Println()
        fmt.Println("======================================================================")
        fmt.Println(" KEAMANAN: password default akun developer lama diganti otomatis.")
        fmt.Printf(" Email    : %s\n", legacyDeveloperEmail)
        fmt.Println(" Password baru (dicetak sekali saja, TIDAK tersimpan di log):")
        fmt.Printf("     %s\n", newPassword)
        fmt.Println(" Salin sekarang -> login -> ganti ke password pilihan Anda,")
        fmt.Println(" atau hapus akun ini bila tidak dipakai (menu kelola akun).")
        fmt.Println("======================================================================")
        fmt.Println()
        logger.Success("[db] Password default lama akun developer diganti ke password acak (lihat kotak di atas)")
        return nil
}

// warnDefaultOwnerPassword mengingatkan bila akun owner bootstrap masih
// memakai password default yang sama tercetak di repo publik — tidak
// dirotasi paksa (khawatir pemiliknya terkunci), cukup diberi peringatan
// nyaring setiap boot sampai diganti.
func warnDefaultOwnerPassword(ctx context.Context) {
        var hash string
        err := Pool.QueryRow(ctx,
                `SELECT password_hash FROM users WHERE role = 'OWNER' AND email = $1 LIMIT 1`,
                config.OwnerEmail()).Scan(&hash)
        if err != nil || !auth.CheckPassword(hash, defaultOwnerPassword) {
                return
        }
        logger.Warn("[db] PERINGATAN: akun owner masih memakai password default publik (tercetak di README) — segera ganti lewat menu ganti password!")
}

// randomPassword membuat password acak alfanumerik tanpa karakter yang
// mudah tertukar saat dibaca manusia (0/O, 1/l/I) — dipakai rotasi
// password bocor.
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

var migrations = []string{
        // ===== 1) Tabel (CREATE TABLE IF NOT EXISTS = no-op di DB lama) =====
        `CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'CASHIER' CHECK (role IN ('OWNER','CASHIER','DEVELOPER')),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
        `CREATE TABLE IF NOT EXISTS products (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT UNIQUE,
        category TEXT NOT NULL DEFAULT 'Umum',
        price BIGINT NOT NULL DEFAULT 0 CHECK (price >= 0),
        cost BIGINT NOT NULL DEFAULT 0 CHECK (cost >= 0),
        stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
        min_stock INT NOT NULL DEFAULT 5 CHECK (min_stock >= 0),
        unit TEXT NOT NULL DEFAULT 'pcs',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
        `CREATE TABLE IF NOT EXISTS transactions (
        id BIGSERIAL PRIMARY KEY,
        receipt_no TEXT NOT NULL UNIQUE,
        cashier_id BIGINT NOT NULL REFERENCES users(id),
        subtotal BIGINT NOT NULL DEFAULT 0,
        discount BIGINT NOT NULL DEFAULT 0,
        total BIGINT NOT NULL DEFAULT 0,
        payment_method TEXT NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH','QRIS','DEBIT')),
        paid_amount BIGINT NOT NULL DEFAULT 0,
        change_amount BIGINT NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'COMPLETED',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
        `CREATE TABLE IF NOT EXISTS transaction_items (
        id BIGSERIAL PRIMARY KEY,
        transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
        product_id BIGINT NOT NULL REFERENCES products(id),
        product_name TEXT NOT NULL,
        price BIGINT NOT NULL,
        qty INT NOT NULL CHECK (qty > 0),
        subtotal BIGINT NOT NULL
    )`,
        `CREATE TABLE IF NOT EXISTS stock_movements (
        id BIGSERIAL PRIMARY KEY,
        product_id BIGINT NOT NULL REFERENCES products(id),
        type TEXT NOT NULL CHECK (type IN ('IN','OUT','ADJUST')),
        qty INT NOT NULL,
        unit_cost BIGINT,
        note TEXT NOT NULL DEFAULT '',
        user_id BIGINT NOT NULL REFERENCES users(id),
        transaction_id BIGINT REFERENCES transactions(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
        `CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(id),
        action TEXT NOT NULL,
        entity TEXT NOT NULL DEFAULT '',
        entity_id TEXT NOT NULL DEFAULT '',
        detail TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
        `CREATE TABLE IF NOT EXISTS product_images (
        id BIGSERIAL PRIMARY KEY,
        product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
        data BYTEA NOT NULL,
        is_thumb BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

        // ===== 2) Sequence nomor struk =====
        `CREATE SEQUENCE IF NOT EXISTS receipt_seq START 1`,

        // ===== 3) Patch database lama (v1.0.0) =====
        // Kolom baru WAJIB ditambahkan SEBELUM index yang memakai kolom
        // tersebut — di 1.0.0 urutannya terbalik sehingga boot pertama di
        // database lama gagal: "column transaction_id does not exist".
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'pcs'`,
        `ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS unit_cost BIGINT`,
        `ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS transaction_id BIGINT REFERENCES transactions(id)`,

        // ===== 4) Patch constraint role lama -> izinkan DEVELOPER =====
        `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`,
        `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('OWNER','CASHIER','DEVELOPER'))`,

        // ===== 5) Index (semua kolomnya sudah pasti ada) =====
        `CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)`,
        `CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_tx_items_tx ON transaction_items(transaction_id)`,
        `CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id)`,
        `CREATE INDEX IF NOT EXISTS idx_stock_movements_tx ON stock_movements(transaction_id)`,
        `CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id)`,
        `CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC)`,
}
