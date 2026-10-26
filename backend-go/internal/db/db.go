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
        logger.Success("[db] Schema siap (9 tabel + sequence + index + scope outlet)")
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

        // ===== 6) Serah terima + verifikasi struk (v1.3.0) =====
        // Kolom kunci di transactions: kode klaim (kunci interaktif pembeli)
        // dan status penyajian/konfirmasi. Sebelumnya hidup di tabel PascalCase
        // Prisma yang tidak pernah diisi checkout Go (split-brain).
        `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS claim_code TEXT`,
        `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS handover_status TEXT`,
        `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS handover_confirmed_at TIMESTAMPTZ`,
        `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS handover_confirmed_by BIGINT REFERENCES users(id)`,
        // Soft delete akun (v1.3.0): baris tetap ada demi FK, daftar tak
        // pernah menampilkannya lagi, email aslinya dibebaskan.
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
        // Unik sebagian (partial): banyak baris boleh NULL, kode terpakai
        // tidak boleh kembar.
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_claim_code
        ON transactions(claim_code) WHERE claim_code IS NOT NULL`,
        `CREATE INDEX IF NOT EXISTS idx_transactions_handover_status
        ON transactions(handover_status) WHERE handover_status IS NOT NULL`,
        `CREATE INDEX IF NOT EXISTS idx_transactions_cashier ON transactions(cashier_id)`,
        // Jejak serah terima — APPEND-ONLY, tidak pernah di-update/dihapus,
        // tidak bisa dimanipulasi pihak mana pun. Inilah yang menang saat
        // ada sengketa "saya tidak pernah terima".
        `CREATE TABLE IF NOT EXISTS handover_events (
        id BIGSERIAL PRIMARY KEY,
        transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('STAFF_SERVE','BUYER_CONFIRM','COURIER_CLAIM','BUYER_DISPUTE')),
        method TEXT NOT NULL DEFAULT 'IN_APP' CHECK (method IN ('IN_APP','PUBLIC')),
        actor_role TEXT,
        actor_id BIGINT REFERENCES users(id),
        buyer_name TEXT,
        signature_data TEXT,
        note TEXT,
        user_agent TEXT,
        ip TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
        `CREATE INDEX IF NOT EXISTS idx_handover_events_tx
        ON handover_events(transaction_id, created_at)`,

        // ===== 7) Outlet & ikatan akun (v1.4.0) =====
        // Identitas warung pindah dari tabel Prisma "Outlet" ke sini;
        // users.outlet_id mengikat kasir ke satu outlet (owner boleh
        // kosong = akses semua outlet, developer tidak pernah diikat).
        `CREATE TABLE IF NOT EXISTS outlets (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        logo_mime_type TEXT,
        logo_data BYTEA,
        logo_version INT NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS outlet_id BIGINT REFERENCES outlets(id)`,
        `CREATE INDEX IF NOT EXISTS idx_users_outlet ON users(outlet_id)`,
        `CREATE INDEX IF NOT EXISTS idx_outlets_name ON outlets(name)`,

        // ===== 8) Data bisnis per-outlet (v1.5.0) =====
        // Produk & transaksi kini milik satu outlet. Baris lama (era
        // single-outlet) di-backfill ke outlet utama — tidak ada data
        // yang yatim. Kolom sengaja TETAP nullable: deployment baru yang
        // belum punya outlet tidak boleh gagal boot, dan aplikasi selalu
        // mengisi outlet pada setiap INSERT baru.
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS outlet_id BIGINT REFERENCES outlets(id)`,
        `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS outlet_id BIGINT REFERENCES outlets(id)`,
        `UPDATE products SET outlet_id = (
            SELECT id FROM outlets ORDER BY created_at ASC, id ASC LIMIT 1
        ) WHERE outlet_id IS NULL`,
        `UPDATE transactions SET outlet_id = (
            SELECT id FROM outlets ORDER BY created_at ASC, id ASC LIMIT 1
        ) WHERE outlet_id IS NULL`,
        `CREATE INDEX IF NOT EXISTS idx_products_outlet ON products(outlet_id)`,
        `CREATE INDEX IF NOT EXISTS idx_transactions_outlet ON transactions(outlet_id)`,

        // ===== 9) Audit ber-outlet (v1.6.0) =====
        // Setiap aksi kini tercatat DI OUTLET mana ia terjadi, sehingga
        // konsol dev bisa memfilter per outlet dan export owner hanya
        // menampilkan jejak outletnya sendiri. Baris lama di-backfill
        // dari ikatan akun aktornya (era pra-kolom ini memang hanya punya
        // user_id); baris aktor tanpa ikatan tetap NULL = tampil "—".
        `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS outlet_id BIGINT REFERENCES outlets(id)`,
        `UPDATE audit_logs a SET outlet_id = u.outlet_id
        FROM users u
        WHERE a.user_id = u.id AND a.outlet_id IS NULL AND u.outlet_id IS NOT NULL`,
        `CREATE INDEX IF NOT EXISTS idx_audit_outlet ON audit_logs(outlet_id)`,

        // ===== 10) Era Go murni (v1.6.0) — perpisahan tabel demo Prisma =====
        // Frontend tidak lagi membaca SATU baris pun dari schema Prisma
        // (tabel PascalCase era demo yang di-reseed setiap docker compose
        // up oleh service "migrate" — service itu pun sudah pensiun).
        // Seluruh data hidup ada di tabel lowercase milik Go ini. Tabel
        // beku itu berisi data demo yang terus ditimpa seed, bukan data
        // bisnis; men DROP-nya menutup dunia-dua-meja selamanya.
        // IF EXISTS + CASCADE: aman di database yang tak pernah punya
        // service migrate sekalipun.
        `DROP TABLE IF EXISTS "HandoverEvent", "TransactionItem", "Transaction",
        "StockMovement", "ProductImage", "Product", "Unit", "Category",
        "AuditEvent", "Outlet", "User" CASCADE`,

        // ===== 11) Foto profil mandiri (v1.7.0) =====
        // Avatar pengguna (foto wajah) disimpan sebagai bytea di tabel
        // users — pola yang sama dengan logo outlet: satu kolom mime +
        // satu kolom bytea + photo_version yang naik tiap unggahan
        // supaya semua <img ?v=N> konsumen (navbar, halaman profil)
        // langsung cache-bust tanpa menunggu TTL. NULL = belum ada foto;
        // tampilan jatuh ke inisial nama.
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_mime_type TEXT`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_data BYTEA`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_version INT NOT NULL DEFAULT 0`,
}
