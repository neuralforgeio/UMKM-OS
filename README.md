# UMKM-OS

> Sistem operasi untuk warung dan UMKM Indonesia — kasir (POS), manajemen stok, laporan penjualan, dan analitik dalam satu platform.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![backend-go](https://img.shields.io/badge/backend--go-v1.0.0-00ADD8?logo=go&logoColor=white)](#versi-komponen)
[![frontend](https://img.shields.io/badge/frontend--next.js-v1.0.0--dev-black?logo=nextdotjs)](#versi-komponen)
[![ml-service](https://img.shields.io/badge/ml--fastapi-v1.0.0--dev-009688?logo=python&logoColor=white)](#versi-komponen)
[![Go](https://img.shields.io/badge/Go-1.27%2B-00ADD8?logo=go&logoColor=white)](backend-go/)

## Tentang

UMKM-OS dibangun untuk benar-benar dipakai oleh penjual di lapangan — bukan sekadar proyek demo. Satu aplikasi untuk menggantikan buku catatan dan kasir manual: transaksi jadi cepat, stok terkontrol, dan pemilik usaha tahu persis warungnya sehat atau tidak lewat laporan harian.

Prinsip utamanya: **satu sumber data untuk seluruh bisnis** (PostgreSQL), dengan backend Go yang cepat dan aman, frontend Next.js yang nyaman dipakai, dan layanan FastAPI untuk kecerdasan (peramalan & saran restock).

## Arsitektur

```mermaid
flowchart LR
    U[Owner / Kasir]

    subgraph FE["Frontend — Next.js + React"]
        F["Dashboard Owner · Kasir POS · Produk & Stok · Pengaturan"]
    end

    subgraph BE["Backend — Go REST API"]
        G["Auth JWT & Hak Akses · Produk & Stok · Transaksi · Laporan · Audit · Log Sistem"]
    end

    subgraph ML["ML Service — Python + FastAPI"]
        M["Peramalan Penjualan · Saran Restock · Analitik"]
    end

    DB[("PostgreSQL — sumber data utama")]

    U --> F
    F -->|"REST /api/v1"| G
    F -.->|"REST"| M
    G --> DB
    M -.-> DB
```

| Komponen   | Teknologi                    | Tanggung Jawab                                                   |
| ---------- | ---------------------------- | ---------------------------------------------------------------- |
| Frontend   | Next.js (App Router) + React | Dashboard pemilik, kasir, manajemen produk & stok                |
| Backend    | Go (chi router + pgx + JWT)  | Autentikasi, izin akses, transaksi, produk, stok, laporan, audit |
| Database   | PostgreSQL (Docker)          | Satu-satunya sumber data utama seluruh bisnis                    |
| ML Service | Python + FastAPI             | Peramalan penjualan, saran restock, analitik                     |

## Fitur

**Backend API v1.0.0 — sudah jalan:**

- **Autentikasi & hak akses** — JWT, dua peran: `OWNER` (penuh) dan `CASHIER` (kasir), bcrypt untuk password, ganti password mandiri
- **Manajemen pengguna** — owner membuat/mengedit/menonaktifkan akun kasir
- **Produk & stok** — CRUD produk, SKU, kategori, harga & modal, stok minimum, riwayat pergerakan stok (`IN`/`OUT`/`ADJUST`), penyesuaian stok dengan row-lock
- **Kasir (POS)** — keranjang multi-item, diskon, pembayaran `CASH`/`QRIS`/`DEBIT`, hitung kembalian, nomor struk unik (`TRX-YYYYMMDD-00001`), stok terkunci saat transaksi (aman untuk banyak kasir)
- **Laporan** — dashboard ringkas, penjualan harian (30 hari) & bulanan (12 bulan), produk terlaris, produk stok menipis
- **Audit log** — setiap aksi penting (login, CRUD, stok, transaksi) tercatat siapa-apa-kapan
- **Log sistem** — log berwarna di console (info/sukses/warn/error/request) + file harian `.log` & `.csv` + API log khusus owner
- **Graceful shutdown** — server berhenti dengan rapi saat Ctrl+C, tanpa proses mati paksa

**Roadmap:**

- [ ] Integrasi penuh frontend Next.js ke Go API (migrasi dari Prisma)
- [ ] Multi-outlet — 1 owner banyak cabang, kasir terikat outlet, stok per outlet
- [ ] ML Service FastAPI — peramalan penjualan & saran restock
- [ ] Dockerfile backend-go + compose produksi
- [ ] Halaman Settings → About dengan versi per komponen + penampil log sistem

## Versi Komponen

Setiap komponen punya nomor versi sendiri (Semantic Versioning), independen satu sama lain:

| Komponen               | Versi       | Status                    |
| ---------------------- | ----------- | ------------------------- |
| `backend-go`           | `1.0.0`     | aktif — development lokal |
| `frontend` (Next.js)   | `1.0.0-dev` | migrasi berlangsung       |
| `ml-service` (FastAPI) | `1.0.0-dev` | menyusul                  |

**Kebijakan versi (dipatuhi ketat):**

- `PATCH` — perbaikan bug. Boleh lebih dari 10: `1.9.9 → 1.9.10 → ... → 1.9.103`
- `MINOR` — penambahan fitur. Boleh lebih dari 10: `1.9.210 → 1.10.210 → ... → 1.38.210`
- `MAJOR` — hanya untuk perombakan besar (UI, backend, bahasa pemrograman): `1.39.182 → 2.0.0`

Riwayat lengkap versi backend ada di [`backend-go/VERSIONS.csv`](backend-go/VERSIONS.csv) (bisa dibuka di Excel/Sheets), dan versi backend bisa dicek runtime lewat `GET /api/v1/version` — nanti ditampilkan di halaman Settings → About. **README ini hidup: setiap perubahan sekecil apapun (bug fix maupun fitur), README dan tabel versi ikut ter-update.**

## Struktur Proyek

```
umkm-os/
├── backend-go/              # REST API — Go v1.0.0
│   ├── main.go              # entrypoint + graceful shutdown
│   ├── VERSIONS.csv         # riwayat versi backend (spreadsheet)
│   ├── logs/                # log harian .log + .csv (tidak masuk git)
│   └── internal/
│       ├── config/          # env + AppVersion (semver)
│       ├── auth/            # JWT (HS256) + bcrypt
│       ├── db/              # koneksi pgx + migrasi schema + seed owner
│       ├── middleware/      # CORS, logger HTTP, recoverer, auth, role
│       ├── logger/          # log berwarna + rotasi file harian
│       └── handler/         # semua endpoint (auth, user, produk, transaksi, laporan, audit, log, versi)
├── docker-compose.yaml      # PostgreSQL untuk development
├── LICENSE                  # MIT
└── README.md
```

## Menjalankan (Development)

**Prasyarat:** Docker (untuk PostgreSQL), Go 1.27+, dan nantinya Node.js untuk frontend.

```powershell
# 1. Nyalakan PostgreSQL (di root proyek)
docker compose up -d

# 2. Jalankan backend
cd backend-go
Copy-Item .env.example .env   # lalu sesuaikan DATABASE_URL & JWT_SECRET
go mod tidy
go run .

# 3. Selesai (satu kali saja) — akun owner otomatis dibuat saat database kosong:
#    email: owner@umkm.local   password: owner123
#    Segera ganti password setelah login pertama!
```

Server backend jalan di `http://localhost:8080`. Tekan `Ctrl+C` untuk berhenti — server menutup semua koneksi dengan rapi sebelum benar-benar mati.

**Variabel environment backend (`.env`):**

| Variabel                         | Default                                                      | Keterangan                                           |
| -------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| `PORT`                           | `8080`                                                       | Port server API                                      |
| `DATABASE_URL`                   | `postgres://umkm:umkm@localhost:5432/umkmos?sslmode=disable` | Koneksi PostgreSQL                                   |
| `JWT_SECRET`                     | (wajib diganti)                                              | Kunci tanda tangan token — pakai string acak panjang |
| `JWT_EXPIRES_H`                  | `24`                                                         | Umur token login (jam)                               |
| `CLIENT_URL`                     | `http://localhost:3000`                                      | Asal frontend yang diizinkan CORS                    |
| `OWNER_EMAIL` / `OWNER_PASSWORD` | `owner@umkm.local` / `owner123`                              | Akun owner awal (hanya dipakai saat database kosong) |
| `LOG_DIR`                        | `logs`                                                       | Folder penyimpanan file log                          |

## Dokumentasi API

Base URL: `http://localhost:8080/api/v1` — semua response berbentuk `{"success": true, "data": ...}` atau `{"success": false, "error": {"message": ...}}`. Endpoint tertanda **(OWNER)** hanya bisa diakses pemilik.

| Metode & Endpoint                              | Akses     | Fungsi                                                           |
| ---------------------------------------------- | --------- | ---------------------------------------------------------------- |
| `POST /auth/login`                             | publik    | Login, balas token JWT + data user                               |
| `GET /auth/me`                                 | login     | Profil user yang login                                           |
| `POST /auth/change-password`                   | login     | Ganti password sendiri                                           |
| `GET/POST /users` · `PUT/DELETE /users/{id}`   | **OWNER** | Kelola akun (kasir/owner)                                        |
| `GET /products`                                | login     | Daftar produk (filter: `search`, `category`, `low_stock`, `all`) |
| `GET /products/{id}`                           | login     | Detail produk                                                    |
| `POST/PUT/DELETE /products/{id}`               | **OWNER** | Kelola produk                                                    |
| `POST /products/{id}/stock`                    | **OWNER** | Restock/koreksi stok (`IN`/`OUT`/`ADJUST`)                       |
| `POST /transactions`                           | login     | Proses penjualan (keranjang, diskon, bayar, kembalian)           |
| `GET /transactions` · `GET /transactions/{id}` | login     | Riwayat transaksi (kasir hanya miliknya)                         |
| `GET /reports/dashboard`                       | login     | Statistik hari ini + transaksi terakhir                          |
| `GET /reports/sales?period=daily\|monthly`     | **OWNER** | Grafik penjualan 30 hari / 12 bulan                              |
| `GET /reports/top-products?days=30`            | **OWNER** | 10 produk terlaris                                               |
| `GET /reports/low-stock`                       | **OWNER** | Produk yang perlu restock                                        |
| `GET /audit-logs`                              | **OWNER** | Jejak aksi semua user                                            |
| `GET /logs` · `GET /logs/{date}?level=&limit=` | **OWNER** | Log sistem harian (untuk halaman log)                            |
| `GET /health` · `GET /version`                 | publik    | Health check & versi backend                                     |

## Sistem Logging

Backend mencatat segalanya, dua arah sekaligus:

- **Console berwarna** — `OK` hijau (sukses), `INFO` cyan (informasi), `WARN` kuning (peringatan), `ERROR` merah (gagal), `HTTP` magenta (setiap request: status, method, path, durasi, **IP asli**, dan **user #id + nama** kalau login)
- **File harian otomatis** di `backend-go/logs/` — rotasi per tanggal: `backend-YYYY-MM-DD.log` (mudah dibaca) + `backend-YYYY-MM-DD.csv` (siap dibuka di Excel/Google Sheets, kolom: timestamp, level, ip, user_id, user_name, method, path, status, duration_ms, message)
- **Terbaca dari frontend** — endpoint `GET /api/v1/logs` (daftar tanggal) dan `GET /api/v1/logs/{date}` (isi log, bisa filter level) siap dipakai halaman penampil log

## Lisensi

Proyek ini dirilis di bawah [Lisensi MIT](LICENSE).
