# UMKM-OS

> Sistem operasi untuk warung dan UMKM Indonesia — kasir (POS), manajemen stok, laporan penjualan, dan analitik dalam satu platform.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![backend-go](https://img.shields.io/badge/backend--go-v1.2.0-00ADD8?logo=go&logoColor=white)](#versi-komponen)
[![frontend](https://img.shields.io/badge/frontend--next.js-v1.0.2-black?logo=nextdotjs)](#versi-komponen)
[![ml-service](https://img.shields.io/badge/ml--fastapi-v1.0.0-009688?logo=python&logoColor=white)](#versi-komponen)
[![Go](https://img.shields.io/badge/Go-1.27%2B-00ADD8?logo=go&logoColor=white)](backend-go/)

## Tentang

UMKM-OS dibangun untuk benar-benar dipakai oleh penjual di lapangan — bukan sekadar proyek demo. Satu aplikasi untuk menggantikan buku catatan dan kasir manual: transaksi jadi cepat, stok terkontrol, dan pemilik usaha tahu persis warungnya sehat atau tidak lewat laporan harian.

Prinsip utamanya: **satu sumber data untuk seluruh bisnis** (PostgreSQL), dengan backend Go yang cepat dan aman, frontend Next.js yang nyaman dipakai, dan layanan FastAPI untuk kecerdasan (peramalan & saran restock). Seluruh stack — database, backend Go, layanan ML, dan frontend — berjalan dalam **satu `docker compose up`**.

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
        M["Peramalan Pendapatan · Saran Restock"]
    end

    DB[("PostgreSQL — sumber data utama")]

    U --> F
    F -->|"REST /api/v1 (server-side)"| G
    F -.->|"REST (server-side)"| M
    G --> DB
    M -.-> DB
```

| Komponen   | Teknologi                    | Tanggung Jawab                                                   |
| ---------- | ---------------------------- | ---------------------------------------------------------------- |
| Frontend   | Next.js (App Router) + React | Dashboard pemilik, kasir, manajemen produk & stok                |
| Backend    | Go (chi router + pgx + JWT)  | Autentikasi, izin akses, transaksi, produk, stok, laporan, audit |
| Database   | PostgreSQL 18 (Docker)       | Satu-satunya sumber data utama seluruh bisnis                    |
| ML Service | Python + FastAPI             | Peramalan pendapatan, saran restock (baca schema Go, read-only)  |

## Fitur

**Backend API v1.2.0 — sudah jalan:**

- **Autentikasi & hak akses** — JWT, tiga peran: `OWNER` (penuh), `CASHIER` (kasir), `DEVELOPER` (konsol lintas outlet), bcrypt untuk password, ganti password mandiri
- **Manajemen pengguna** — owner membuat/mengedit/menonaktifkan akun kasir
- **Produk & stok** — CRUD produk, SKU, kategori, harga & modal, stok minimum, satuan, foto produk, riwayat pergerakan stok (`IN`/`OUT`/`ADJUST`), row-lock anti-oversell
- **Kasir (POS)** — keranjang multi-item, diskon, pembayaran `CASH`/`QRIS`/`DEBIT`, kembalian, nomor struk unik (`TRX-YYYYMMDD-00001`)
- **Laporan** — `GET /reports/dashboard` satu pintu (hari ini & kemarin, grafik 7 hari gap-free, porsi metode pembayaran, 5 produk terlaris, stok menipis + saran restok, 6 transaksi terbaru), penjualan harian/bulanan, produk terlaris, stok menipis
- **Audit log & log sistem** — setiap aksi penting tercatat; log harian `.log` + `.csv` + API log khusus owner
- **Graceful shutdown** dan **Docker penuh** — binary statis + healthcheck, siap `docker compose up --build`

**Frontend v1.0.2 — sudah jalan:** login via Go, kasir POS, kelola produk/stok/foto, dashboard owner + halaman peluncur (semua angka dari `/reports/dashboard`), widget Ramalan Pendapatan & Saran Restock (FastAPI), konsol developer. Identitas outlet (nama/logo) masih Prisma — pindah ke Go pada fase multi-outlet. Peluncur & dashboard owner kini tahan terhadap backend lama (guard bentuk respons `/reports/dashboard`).

**Roadmap:**

- [ ] Integrasi tersisa: riwayat transaksi, verifikasi struk, pengaturan, konsol developer → pindah dari Prisma ke backend-go
- [ ] Multi-outlet — 1 owner banyak cabang, kasir terikat outlet, stok per outlet
- [ ] Halaman Settings → About dengan versi per komponen
- [ ] Data demo di Docker mengisi schema Go (saat ini seed Prisma hanya mengisi identitas outlet & akun demo)
- [ ] Rename `backend/` → `ml-service/`

## Versi Komponen

Setiap komponen punya nomor versi sendiri (Semantic Versioning), independen satu sama lain:

| Komponen               | Versi   | Status                 |
| ---------------------- | ------- | ---------------------- |
| `backend-go`           | `1.2.0` | aktif — Docker + lokal |
| `frontend` (Next.js)   | `1.0.2` | migrasi berlangsung    | 
| `ml-service` (FastAPI) | `1.0.0` | aktif — baca schema Go |

**Kebijakan versi (dipatuhi ketat):**

- `PATCH` — perbaikan bug. Boleh lebih dari 10: `1.9.9 → 1.9.10 → ... → 1.9.103`
- `MINOR` — penambahan fitur. Boleh lebih dari 10: `1.9.210 → 1.10.210 → ... → 1.38.210`
- `MAJOR` — hanya untuk perombakan besar (UI, backend, bahasa pemrograman): `1.39.182 → 2.0.0`

Riwayat lengkap ada di [`backend-go/VERSIONS.csv`](backend-go/VERSIONS.csv), [`frontend/VERSIONS.csv`](frontend/VERSIONS.csv), dan [`backend/VERSIONS.csv`](backend/VERSIONS.csv). Versi backend bisa dicek runtime lewat `GET /api/v1/version` — nanti ditampilkan di halaman Settings → About. **README ini hidup: setiap perubahan sekecil apapun (bug fix maupun fitur), README dan tabel versi ikut ter-update.**

## Struktur Proyek

```
umkm-os/
├── docker-compose.yml       # stack penuh: db + migrate + backend-go + backend + frontend
├── .env.example             # template root .env (semua kredensial stack)
├── backend-go/              # REST API — Go v1.2.0
│   ├── Dockerfile           # multi-stage: binary statis + healthcheck
│   ├── VERSIONS.csv
│   └── internal/            # config, auth, db, middleware, logger, handler
├── backend/                 # ML service — FastAPI v1.0.0 (rename ke ml-service/ menyusul)
│   ├── Dockerfile
│   └── app/                 # api/routes, core, services (forecast)
├── frontend/                # Next.js v1.0.1
│   ├── Dockerfile           # standalone output
│   ├── prisma/              # migrasi + seed (identitas outlet & akun demo)
│   └── app/                 # login, cashier, owner/*, dev/*
├── LICENSE                  # MIT
└── README.md
```

## Menjalankan

### Cara A — Docker (semua service, untuk demo & developer baru)

Prasyarat: cukup Docker Desktop. Tidak perlu Go / Node / Python terpasang di host.

```powershell
# 1. Siapkan env (root proyek) — cukup sekali
Copy-Item .env.example .env
#    lalu isi .env: POSTGRES_PASSWORD, AUTH_SECRET, DEV_SEED_EMAIL, DEV_SEED_PASSWORD

# 2. Nyalakan SELURUH stack
docker compose up --build -d

# 3. Ambil password owner awal (dicetak sekali saat database baru)
docker compose logs backend-go
```

- Frontend: `http://localhost:3000` · API Go: `http://localhost:8080` · ML: `http://localhost:8000`
- PostgreSQL terekspos di host port **5433** (tidak bentrok PostgreSQL lokal 5432)
- Akun developer otomatis dibuat dari `DEV_SEED_EMAIL` / `DEV_SEED_PASSWORD` yang sama oleh seed Prisma **dan** backend-go — kredensialnya selalu sinkron
- Log harian backend-go tersimpan di volume `gologs` (bertahan lintas rebuild)
- Semua service memakai `TZ=Asia/Jakarta`, jadi "hari ini" di laporan = hari WIB

### Cara B — Development lokal (kode di host)

Jalankan tiap komponen sendiri; PostgreSQL lokal di 5432 (atau `docker compose up -d db` untuk memakai 5433).

```powershell
# backend-go
cd backend-go
Copy-Item .env.example .env    # isi DATABASE_URL (localhost:5432) & JWT_SECRET
go run .

# frontend
cd frontend
Copy-Item .env.example .env    # DATABASE_URL + AUTH_SECRET + API_URL + BACKEND_URL
npm install
npm run dev

# ML service (FastAPI)
cd backend
Copy-Item .env.example .env    # DATABASE_URL (localhost:5432)
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

**Variabel environment backend-go (`.env` lokal):**

| Variabel                                 | Default                                                      | Keterangan                                                                           |
| ---------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `PORT`                                   | `8080`                                                       | Port server API                                                                      |
| `DATABASE_URL`                           | `postgres://umkm:umkm@localhost:5432/umkmos?sslmode=disable` | Koneksi PostgreSQL                                                                   |
| `JWT_SECRET`                             | (wajib diganti)                                              | Kunci tanda tangan token — pakai string acak panjang                                 |
| `JWT_EXPIRES_H`                          | `24`                                                         | Umur token login (jam)                                                               |
| `CLIENT_URL`                             | `http://localhost:3000`                                      | Asal frontend yang diizinkan CORS                                                    |
| `OWNER_EMAIL` / `OWNER_PASSWORD`         | `owner@umkm.local` / _(kosong)_                              | Akun owner awal — kosong = password acak dicetak sekali saat boot                    |
| `DEVELOPER_EMAIL` / `DEVELOPER_PASSWORD` | _(kosong)_                                                   | Akun developer — samakan dengan `DEV_SEED_*` di root .env agar sinkron dengan Docker |
| `LOG_DIR`                                | `logs`                                                       | Folder penyimpanan file log                                                          |

> Di Docker, tabel di atas diisi otomatis oleh `docker-compose.yml` dari root `.env` — termasuk `DEVELOPER_EMAIL`/`DEVELOPER_PASSWORD` yang mengikuti `DEV_SEED_EMAIL`/`DEV_SEED_PASSWORD`.

## Dokumentasi API

Base URL: `http://localhost:8080/api/v1` — semua response berbentuk `{"success": true, "data": ...}` atau `{"success": false, "error": {"message": ...}}`. Endpoint tertanda **(OWNER)** hanya bisa diakses pemilik/developer.

| Metode & Endpoint                              | Akses     | Fungsi                                                                                                                               |
| ---------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /auth/login`                             | publik    | Login, balas token JWT + data user                                                                                                   |
| `GET /auth/me`                                 | login     | Profil user yang login                                                                                                               |
| `POST /auth/change-password`                   | login     | Ganti password sendiri                                                                                                               |
| `GET/POST /users` · `PUT/DELETE /users/{id}`   | **OWNER** | Kelola akun (kasir/owner)                                                                                                            |
| `GET /products`                                | login     | Daftar produk (filter: `search`, `category`, `low_stock`, `all`)                                                                     |
| `GET /products/{id}`                           | login     | Detail produk                                                                                                                        |
| `POST/PUT/DELETE /products/{id}`               | **OWNER** | Kelola produk                                                                                                                        |
| `POST /products/{id}/stock`                    | **OWNER** | Restock/koreksi stok (`IN`/`OUT`/`ADJUST`)                                                                                           |
| `POST /products/{id}/images`                   | **OWNER** | Unggah foto produk                                                                                                                   |
| `POST /transactions`                           | login     | Proses penjualan (keranjang, diskon, bayar, kembalian)                                                                               |
| `GET /transactions` · `GET /transactions/{id}` | login     | Riwayat transaksi (kasir hanya miliknya)                                                                                             |
| `GET /reports/dashboard`                       | login     | Satu pintu statistik dashboard: hari ini/kemarin, grafik 7 hari, metode pembayaran, produk terlaris, stok menipis, transaksi terbaru |
| `GET /reports/sales?period=daily\|monthly`     | **OWNER** | Grafik penjualan 30 hari / 12 bulan                                                                                                  |
| `GET /reports/top-products?days=30`            | **OWNER** | 10 produk terlaris                                                                                                                   |
| `GET /reports/low-stock`                       | **OWNER** | Produk yang perlu restock                                                                                                            |
| `GET /stock-movements`                         | **OWNER** | Riwayat pergerakan stok                                                                                                              |
| `GET /audit-logs`                              | **OWNER** | Jejak aksi semua user                                                                                                                |
| `GET /logs` · `GET /logs/{date}?level=&limit=` | **OWNER** | Log sistem harian (untuk halaman log)                                                                                                |
| `GET /health` · `GET /version`                 | publik    | Health check & versi backend                                                                                                         |

## Sistem Logging

Backend mencatat segalanya, dua arah sekaligus:

- **Console berwarna** — `OK` hijau (sukses), `INFO` cyan (informasi), `WARN` kuning (peringatan), `ERROR` merah (gagal), `HTTP` magenta (setiap request: status, method, path, durasi, **IP asli**, dan **user #id + nama** kalau login)
- **File harian otomatis** di `backend-go/logs/` (di Docker: volume `gologs`) — rotasi per tanggal: `backend-YYYY-MM-DD.log` (mudah dibaca) + `backend-YYYY-MM-DD.csv` (siap dibuka di Excel/Google Sheets, kolom: timestamp, level, ip, user_id, user_name, method, path, status, duration_ms, message)
- **Terbaca dari frontend** — endpoint `GET /api/v1/logs` (daftar tanggal) dan `GET /api/v1/logs/{date}` (isi log, bisa filter level) siap dipakai halaman penampil log

## Lisensi

Proyek ini dirilis di bawah [Lisensi MIT](LICENSE).
