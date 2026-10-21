# UMKM OS

**Sistem operasi digital untuk warung Indonesia** — aplikasi kasir (POS), dashboard
pemilik dengan statistik penjualan, dan layanan machine learning untuk peramalan
pendapatan 7 hari ke depan beserta saran restock. Seluruh stack berjalan dengan
satu perintah `docker compose up -d`.

Dibangun sebagai proyek portfolio dengan pendekaran full-stack modern:
**Next.js 16 (App Router) + FastAPI + PostgreSQL 18 + Prisma 7**, dipisahkan
dengan arsitektur baca/tulis yang tegas (lihat [Arsitektur](#arsitektur)).

![Next.js](https://img.shields.io/badge/Next.js%2016-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![React 19](https://img.shields.io/badge/React%2019-61DAFB?style=flat-square&logo=react&logoColor=000000)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL%2018-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma%207-2D3748?style=flat-square&logo=prisma&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

## Fitur

**Pemilik (Owner)**

- Dashboard harian: omzet, jumlah transaksi, item terjual, rata-rata per struk
- Grafik penjualan 7 hari + komposisi metode pembayaran (Tunai / QRIS / Debit)
- Ramalan pendapatan 7 hari dengan pita ketidakpastian 80% — dihitung layanan ML FastAPI
- Saran restock berbasis permintaan ramalan, bukan sekadar stok di bawah minimum
- Produk terlaris mingguan, daftar stok kritis, riwayat transaksi terbaru

**Kasir (POS)**

- Pencatatan transaksi penjualan dengan kode struk unik per hari
- Pembayaran Tunai / QRIS / Debit dengan perhitungan kembalian otomatis
- Harga terkunci saat penjualan (snapshot `priceAtSale`) — struk lama tidak
  berubah ketika harga produk naik

**Akun demo (data seed)**

| Peran  | Email             | Password    |
| ------ | ----------------- | ----------- |
| Pemilik | `busari@warung.id` | `owner12345` |
| Kasir   | `rizky@warung.id`  | `kasir12345` |

## Arsitektur

```mermaid
flowchart LR
    B["Browser"] --> F["Next.js 16 (frontend :3000)"]
    F -- "Prisma 7 (tulis)" --> D[("PostgreSQL 18 (:5432)")]
    F -- "fetch server-side" --> A["FastAPI (backend :8000)"]
    A -- "SQLAlchemy (read-only)" --> D
```

Prinsip utama: **schema database dimiliki frontend**. Aplikasi Next.js adalah
satu-satunya penulis data (lewat Prisma), sementara layanan FastAPI terhubung
**read-only** untuk query analitik dan peramalan. Pola CQRS-lite ini memberi
kepemilikan data yang jelas: tidak ada dua sisi yang sama-sama menulis, tidak
ada risiko drift schema, dan jalur ML tidak pernah bisa merusak data transaksi.

Konsekuensi praktisnya: browser tidak pernah memanggil FastAPI langsung —
semua request ML berjalan server-to-server dari Next.js ke `BACKEND_URL`,
sehingga CORS tidak relevan dan endpoint ML tidak terekspos ke publik.

## Tech Stack

| Layer        | Teknologi                                                                  |
| ------------ | -------------------------------------------------------------------------- |
| Frontend     | Next.js 16.4.2 (App Router, React 19, Turbopack), NextAuth v5, Tailwind CSS |
| ORM frontend | Prisma 7.10.1 + driver adapter `@prisma/adapter-pg` (tanpa binary engine Rust) |
| Backend ML   | FastAPI, SQLAlchemy 2 async (psycopg 3), Pydantic v2                        |
| Database     | PostgreSQL 18                                                               |
| Deployment   | Docker Compose — image multi-stage, Next.js standalone, non-root user       |
| Testing      | pytest — 17 unit test layanan peramalan, tanpa perlu database               |

## Quick Start (Docker)

Prasyarat: Docker. Tidak perlu Node, Python, maupun PostgreSQL di host.

1. Salin template environment lalu isi dua nilai:

   ```powershell
   Copy-Item .env.example .env        # Windows
   # cp .env.example .env             # Linux / macOS
   ```

   Edit `.env` — ganti `AUTH_SECRET` dengan string acak, contoh generator:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   # python -c "import secrets,base64;print(base64.b64encode(secrets.token_bytes(32)).decode())"
   ```

   `POSTGRES_PASSWORD` hanya untuk database demo — bebas diganti.

2. Nyalakan stack:

   ```powershell
   docker compose up -d
   ```

   Urutan otomatis: `db` menunggu healthy → job `migrate` menjalankan
   `prisma migrate deploy` + seed data demo → `backend` dan `frontend` start.

3. Cek kesiapan lalu buka aplikasi:

   ```powershell
   docker compose ps     # migrate harus "Exited (0)", frontend "Up"
   ```

   Buka `http://localhost:3000` dan login dengan akun demo di atas.

Catatan perilaku stack:

- Service `migrate` tampil `Exited (0)` selamanya di `docker compose ps` — itu
  normal: dia job sekali-jalan, bukan server.
- Setiap `docker compose up -d` menjalankan ulang seed, sehingga **data demo
  kembali ke kondisi awal** (deterministik — angkanya selalu identik).
  Transaksi yang kamu buat lewat POS akan ter-reset. Reset penuh termasuk
  volume: `docker compose down -v`.
- Stack memakai port host 3000 (frontend), 8000 (backend), 5433 (db).

## Menjalankan Tanpa Docker (Local Dev)

Prasyarat: Node 24, Python 3.12, PostgreSQL lokal berjalan di `:5432`.

Siapkan database (sekali, sebagai superuser):

```sql
CREATE USER umkm WITH PASSWORD 'umkmindo45';
CREATE DATABASE umkmos OWNER umkm;
```

Backend — `backend/.env` (scheme `psycopg_async` wajib untuk engine async):

```env
DATABASE_URL=postgresql+psycopg_async://umkm:umkmindo45@localhost:5432/umkmos
```

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1      # Windows
pip install -r requirements.txt
python run.py                   # http://localhost:8000
```

Frontend — `frontend/.env` (dibaca Prisma CLI dan seed) serta
`frontend/.env.local` (dibaca Next.js):

```env
# frontend/.env
DATABASE_URL="postgresql://umkm:umkmindo45@localhost:5432/umkmos"
```

```env
# frontend/.env.local
AUTH_SECRET=<hasil generator di atas>
AUTH_TRUST_HOST=true
```

```powershell
cd frontend
npm ci
npx prisma generate
npx prisma migrate deploy
npx tsx prisma/seed.ts          # isi data demo, membaca .env otomatis
npm run dev                     # http://localhost:3000
```

Testing backend (tanpa database):

```powershell
cd backend
pytest                          # 17 passed
```

Catatan: stack Docker dan dev lokal memakai port 3000/8000 yang sama —
jalankan `docker compose down` sebelum menyalakan keduanya bersamaan.

## Metode Peramalan

Layanan ML meramalkan pendapatan per hari (demo memakai horizon 7 hari):

- **Weekday-seasonal weighted average** — untuk tiap hari ramalan, diambil
  hingga 4 sampel hari-minggu-yang-sama terbaru dari riwayat. Warung punya
  pola mingguan yang kuat (akhir pekan ramai), jadi musiman per hari dalam
  minggu adalah sinyal paling informatif.
- **Bobot linear 1:2:3:4** — sampel terbaru berbobot paling besar, meredam
  minggu-minggu anomali (misal hari besar yang hanya terjadi sekali).
- **Pita prediksi 80%** — batas bawah/atas = titik ramalan ± z·σ dengan
  z = 1.2816, ditampilkan sebagai area pada grafik dashboard.
- **Cascade degenerasi** — hari tanpa penjualan di awal riwayat diabaikan;
  jika tidak ada sampel same-weekday sama sekali, jatuh ke rata-rata
  keseluruhan; jika riwayat kosong, ramalan bernilai nol.
- **Integritas data** — input model berhenti di kemarin: hari berjalan tidak
  masuk sebagai sampel karena penjualannya belum selesai.

Saran restock memakai ramalan yang sama: kebutuhan N hari ke depan per produk
dihitung dari permintaan ramalan, lalu dikurangi stok saat ini — hanya produk
dengan selisih positif yang ditampilkan. Ini membedakannya dari alert stok
minimum statis: produk bisa justru perlu restock lebih awal karena ramalan
permintaannya tinggi.

Kenapa bukan Holt-Winters? Dengan data demo 6 minggu, pola mingguan jauh lebih
dominan daripada tren level, dan rata-rata berbobot per hari-minggu lebih
mudah dijelaskan dan diuji — metode ini juga **murni fungsi Python tanpa
database**, sehingga teruji 17 unit test secara deterministik.

## Struktur Repo

```
umkm-os/
├─ docker-compose.yml          # stack demo: db + migrate + backend + frontend
├─ .env.example                # template environment untuk compose
├─ backend/
│  ├─ app/
│  │  ├─ api/routes/           # endpoint health + forecast
│  │  ├─ services/forecast.py  # layanan peramalan (murni, mudah diuji)
│  │  ├─ models/               # model SQLAlchemy read-only
│  │  ├─ schemas/              # skema respons Pydantic
│  │  └─ core/                 # konfigurasi + koneksi database
│  ├─ tests/                   # 17 unit test pytest
│  └─ Dockerfile               # image produksi dua-stage
└─ frontend/
   ├─ app/                     # halaman: auth, kasir POS, dashboard owner
   ├─ components/              # widget forecast, grafik SVG, kartu dashboard
   ├─ lib/                     # prisma client, auth, format Rupiah, klien forecast
   ├─ prisma/                  # schema, migrasi, seed data demo
   └─ Dockerfile               # image standalone tiga-stage
```

## API Backend

| Endpoint                                    | Fungsi                                             |
| ------------------------------------------- | -------------------------------------------------- |
| `GET /api/v1/health`                        | Health check layanan                               |
| `GET /api/v1/forecast/revenue?days&horizon` | Riwayat harian + ramalan pendapatan                |
| `GET /api/v1/forecast/products?limit`       | Produk + permintaan ramalan untuk saran restock    |
