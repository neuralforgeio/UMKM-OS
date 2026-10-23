package db

import (
        "context"
        "os"
        "time"

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
        logger.Success("[db] Owner awal dibuat -> %s / %s (segera ganti password setelah login!)", config.OwnerEmail(), config.OwnerPassword())
        return nil
}

// seedDeveloper membuat akun DEVELOPER (konsol lintas outlet). Berbeda
// dari seedOwner, ini selalu dijalankan dengan ON CONFLICT DO NOTHING —
// akun developer harus selalu ada meski tabel users sudah terisi.
func seedDeveloper(ctx context.Context) error {
        hash, err := auth.HashPassword(config.DeveloperPassword())
        if err != nil {
                return err
        }
        tag, err := Pool.Exec(ctx,
                `INSERT INTO users (name, email, password_hash, role)
                 VALUES ($1, $2, $3, 'DEVELOPER')
                 ON CONFLICT (email) DO NOTHING`,
                "Developer", config.DeveloperEmail(), hash,
        )
        if err != nil {
                return err
        }
        if tag.RowsAffected() > 0 {
                logger.Success("[db] Akun developer dibuat -> %s / %s (ganti lewat env DEVELOPER_EMAIL/DEVELOPER_PASSWORD)", config.DeveloperEmail(), config.DeveloperPassword())
        }
        return nil
}

var migrations = []string{
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
        `CREATE SEQUENCE IF NOT EXISTS receipt_seq START 1`,
        `CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)`,
        `CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_tx_items_tx ON transaction_items(transaction_id)`,
        `CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id)`,
        `CREATE INDEX IF NOT EXISTS idx_stock_movements_tx ON stock_movements(transaction_id)`,
        `CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id)`,
        `CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC)`,
        // Patch untuk database yang sudah ada dari versi sebelumnya:
        // kolom baru ditambahkan idempoten (aman dijalankan tiap boot).
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'pcs'`,
        `ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS unit_cost BIGINT`,
        `ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS transaction_id BIGINT REFERENCES transactions(id)`,
        // Patch constraint role lama -> izinkan DEVELOPER.
        `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`,
        `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('OWNER','CASHIER','DEVELOPER'))`,
}
