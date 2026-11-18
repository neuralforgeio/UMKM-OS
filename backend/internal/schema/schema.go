package schema

import "strings"

// SATU sumber kebenaran DDL (backend 2.1.1): daftar pernyataan migrasi
// yang (1) dijalankan db.Connect() saat boot, dan (2) di-emit ulang di
// dalam SETIAP berkas cadangan oleh paket backup. Dump cadangan data
// kini MURNI GO (pgx + compress/gzip) dan tidak lagi memanggil pg_dump
// eksternal - akar kegagalan Gerbang E di mesin pemilik: pg_dump klien
// Debian bookworm (15.20) menolak keras server PostgreSQL 18
// ("server version mismatch"), dan versi klien dari apt TIDAK pernah
// bisa dijamin cocok dengan versi server compose. Dengan DDL di paket
// ini, berkas cadangan memuat CREATE TABLE..IF NOT EXISTS yang bisa
// diterapkan ke node mana pun kapan pun tanpa alat luar.
// Seluruh pernyataan idempotent: replay selalu aman.
var Pernyataan = []string{
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

	// ===== 12) Riwayat Asisten AI (v1.8.0) =====
	// Tabel chat_history: percakapan pemilik dengan Asisten AI
	// (ml-service v3.1.0). DDL tetap otoritas Go; PENULIS baris
	// adalah layanan ML lewat gerbang X-Internal-Key — satu-
	// satunya pengecualian tulis di layanan itu (lainnya baca-
	// saja). ON DELETE CASCADE: riwayat ikut terhapus bersama
	// akun (privasi); outlet_id nullable untuk konteks kosong.
	`CREATE TABLE IF NOT EXISTS chat_history (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        outlet_id BIGINT REFERENCES outlets(id),
        role TEXT NOT NULL CHECK (role IN ('USER','ASSISTANT')),
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
	`CREATE INDEX IF NOT EXISTS idx_chat_history_user_time ON chat_history(user_id, created_at DESC)`,

	// ===== 13) SKU per outlet (era Go murni) =====
	// Era v1.5.0 menempelkan products.outlet_id tetapi keunikan SKU
	// masih GLOBAL (products_sku_key) — dua cabang warung tidak bisa
	// sama-sama punya "PRD-0001". Keunikan kini didefinisikan per
	// outlet (partial unique index: banyak NULL tetap boleh), persis
	// seperti pemeriksaan handler CreateProduct/UpdateProduct yang
	// memakai WHERE outlet_id = ... .
	`ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key`,
	`DROP INDEX IF EXISTS idx_products_sku`,
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_products_outlet_sku
        ON products(outlet_id, sku) WHERE sku IS NOT NULL`,

	// ===== 14) Audit ber-IP (era Go murni) =====
	// Setiap aksi tercatat dari IP mana ia dilakukan (middleware
	// ClientIP: X-Forwarded-For -> X-Real-IP -> RemoteAddr). IP
	// privat berarti "jaringan lokal warung"; bila GEO_LOOKUP_ENABLED
	// aktif, konsol dev juga melihat kota asal IP publik. Baris lama
	// tetap NULL = tampil "—" (tidak bisa direkonstruksi).
	`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip TEXT`,
	// ===== 15) Tabel dbheartbeat (run-7; resmi jadi migrasi sejak 2.1.1) =====
	// Riwayat perpindahan node aktif (failover / sinkron balik). Sebelumnya
	// tabel ini hanya dibuat runtime oleh failover - berakibat dump lama
	// memuat INSERT dbheartbeat tanpa CREATE-nya, sehingga pemulihan ke
	// node baru gagal. Sebagai migrasi resmi, replay dump ikut
	// membuatnya di mana-mana.
	`CREATE TABLE IF NOT EXISTS dbheartbeat (
        id BIGSERIAL PRIMARY KEY,
        waktu TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ke TEXT NOT NULL,
        sebab TEXT NOT NULL,
        gagal INT NOT NULL DEFAULT 0,
        baris INT NOT NULL DEFAULT 0
    )`,
}

// TabelSet: nama seluruh tabel APLIKASI yang dibuat Pernyataan di atas
// (termasuk tabel era-lama yang di-CREATE untuk kompatibilitas replay).
// Dipakai paket backup sebagai FILTER: hanya tabel aplikasi yang boleh
// masuk berkas cadangan — database warung pemilik nyatanya masih
// memuat tabel sisa alat lain (contoh nyata dari mesin produksi:
// public._prisma_migrations era demo Prisma) yang TIDAK punya CREATE
// di Pernyataan; menulis INSERT-nya tanpa CREATE membuat pemulihan ke
// node baru gagal 42P01. Sequence selaras (nama + _id_seq milik
// BIGSERIAL + receipt_seq mandiri) dihitung dari tabel yang sama.
// Satu sumber kebenaran: daftar ini SELALU diturunkan dari teks
// Pernyataan, bukan ditulis tangan terpisah.
func TabelSet() map[string]bool {
	set := map[string]bool{}
	for _, stmt := range Pernyataan {
		if nama, ok := namaTabelDariDDL(stmt); ok {
			set[nama] = true
		}
	}
	return set
}

// namaTabelDariDDL: ekstraksi nama tabel dari CREATE TABLE / DROP TABLE.
// Komentar di dalam pernyataan diabaikan (pencarian literal prefiks
// pernyataan, bukan parser penuh — DDL kita ditulis sendiri dan bentuk
// prefiksnya selalu "CREATE TABLE IF NOT EXISTS <nama> (").
func namaTabelDariDDL(stmt string) (string, bool) {
	for _, prefiks := range []string{"CREATE TABLE IF NOT EXISTS ", "CREATE TABLE "} {
		if sisa, ok := strings.CutPrefix(stmt, prefiks); ok {
			nama := sisa
			if i := strings.IndexAny(sisa, " (\n\t"); i >= 0 {
				nama = sisa[:i]
			}
			nama = strings.TrimSpace(nama)
			if nama != "" && !strings.Contains(nama, "\n") {
				return nama, true
			}
		}
	}
	return "", false
}
