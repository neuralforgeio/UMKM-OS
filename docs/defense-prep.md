# Panduan Siap Sidang — UMKM OS

Dokumen internal persiapan sidang. Tiga bagian: angka hafalan, skrip demo,
dan antisipasi pertanyaan. Latih skrip demo **satu kali penuh** dengan drill
reset (bagian 4) — sehari sebelum sidang, bukan paginya.

## 1. Angka Hafalan (Cheat Sheet)

### Angka stabil — tidak berubah kapan pun seed dijalankan ulang

| Angka | Nilai | Asal |
| --- | --- | --- |
| Total transaksi seed | 568 | 42 hari, pola weekday (6 minggu penuh) |
| Total item baris | 1.557 | agregat TransactionItem |
| Total pendapatan 42 hari | Rp 29.565.500 | agregat total struk |
| Rata-rata per struk | ± Rp 52.000 | 29.565.500 / 568 |
| Produk / kategori / akun | 20 / 5 / 2 | seed deterministik |
| Produk di bawah minStock | Aqua 2, Indomie Goreng 3, Beras 4 | by design |
| Unit test layanan forecast | 17 lulus | pytest, tanpa database |
| Build image pertama vs cached | ± 3,5 menit vs ± 40 detik | layer cache |
| Akun demo | busari@warung.id / owner12345 (owner), rizky@warung.id / kasir12345 (kasir) | README |

Kenapa stabil: seed memakai PRNG ber-seed tetap dan window 42 hari selalu
berisi tepat 6x tiap hari-minggu — total di kedua sisi invarian terhadap
tanggal. Bisa dipercaya masuk slide.

### Angka harian — berotasi mengikuti tanggal, cek ulang pagi hari sidang

- Batang chart "Penjualan 7 Hari" per harinya (total 7 hari stabil di kisaran
  Rp 4,6-4,7 juta, tapi batang mana yang tinggi bergeser sesuai weekday)
- Angka ramalan harian dan total forecast 7 hari (mis. Rp 4.881.400 saat
  latihan 21 Okt — **tidak** dipakai sebagai angka hafalan)
- Saran restock ML (mis. Chitato +16) dan daftar terlaris mingguan
- Kartu "Hari ini": mulai dari Rp 0 — itu bahan pembuka demo, bukan masalah

Pagi hari sidang: buka /owner, catat 3 angka segar (total forecast, satu
angka restock, satu angka terlaris). Selesai.

### Angka desain (kalau ditanya "darimana datanya")

- 568 transaksi = 6 minggu x basis weekday (Minggu 15, Senin 9, Selasa 8,
  Rabu 10, Kamis 10, Jumat 12, Sabtu 20) + variasi acak 0-3 per hari
- Metode pembayaran: 55% Tunai / 35% QRIS / 10% Debit (per jumlah transaksi;
  tampilan dashboard membagi berdasarkan nilai rupiah)
- Jam transaksi dibatasi 08:00-20:59 WIB, timestamp aman timezone UTC/WIB

## 2. Skrip Demo (target 6-8 menit)

### Setup 10 menit sebelum

- `docker compose ps` — db healthy, migrate Exited (0), backend Up, frontend Up
- Dua jendela browser: profil biasa = **owner** (sudah login), jendela
  incognito = **kasir** (sudah login). Ganti peran cukup Alt+Tab, tanpa
  logout-login.
- Zoom browser 110-125%, sesuaikan proyektor; tab lain ditutup
- Terminal siap dengan `docker compose ps` di layar — untuk momen closing

### Alur menit-per-menit

**0:00-0:45 — Pembuka & masalah.** Mayoritas warung Indonesia masih
mencatat manual; pemilik tidak tahu produk apa yang harus dibeli ulang
minggu depan. UMKM OS: kasir digital + dashboard pemilik + peramalan
penjualan. Satu kalimat, lalu pindah.

**0:45-1:30 — Arsitektur 30 detik.** Diagram: Next.js adalah penulis data
tunggal (Prisma), FastAPI terhubung read-only untuk analitik. Kalimat kunci:
"satu penulis, banyak pembaca — jalur machine learning tidak mungkin
merusak data transaksi."

**1:30-3:00 — Demo POS live (jendela kasir).** Mulai dari kondisi kosong.
Cari "indomie" di search, tambah Indomie Goreng qty 2, tambah Aqua 1 dan
Kopi Kapal Api 2. Pilih Tunai, uang diterima Rp 20.000, kembalian
dihitung otomatis. Selesaikan transaksi. Kalimat kunci: "harga terkunci
saat penjualan — snapshot per struk — struk lama tak berubah saat harga
naik di kemudian hari."

**3:00-4:30 — Dashboard owner (jendela owner, refresh).** Kartu "Hari ini"
melompat dari Rp 0 ke angka hasil transaksi barusan — ini momen paling
penting seluruh demo: penonton melihat jalur tulis (POS) dan jalur baca
(dashboard) tersambung live. Tunjukkan chart 7 hari dan komposisi metode
pembayaran. Catatan: angka ramalan TIDAK berubah setelah jualan baru —
model sengaja hanya melihat sampai kemarin (hari berjalan belum selesai);
kalau penguji menanyakan ini, itu poin diskusi bagus, bukan bug.

**4:30-6:00 — Forecast & restock.** Jelaskan widget ramalan 7 hari dengan
pita 80%: "rata-rata berbobot dari empat minggu terakhir untuk hari-minggu
yang sama — Sabtu diramal dari Sabtu-Sabtu sebelumnya; minggu terbaru
berbobot paling besar." Lalu dua lensa stok: kartu ML (restock berdasarkan
permintaan ramalan — Chitato bisa butuh restock walau stoknya masih 9) dan
kartu stok minimum statis (Aqua, Indomie, Beras). Kalimat kunci: "dua
definisi kehabisan stok, dua-duanya ditampilkan."

**6:00-7:00 — Engineering flex (pilih dua).** (a) Alt+Tab ke terminal:
"empat kontainer, satu perintah `docker compose up -d`, tanpa menginstal
apa pun di mesin." (b) Reset guarantee: "kalau demo kacau, dua menit saya
bisa mengembalikan seluruh sistem ke kondisi identik — datanya
deterministik." (c) "17 unit test untuk layanan peramalan, berjalan tanpa
database." (d) Riwayat git 15+ commit konvensional sebagai bukti proses.

**7:00-8:00 — Penutup & roadmap.** Multi-outlet sudah tersedia di level
schema (model Outlet, outletId di produk/transaksi), laporan mingguan
ekspor, notifikasi restock. Buka Q&A.

### Prioritas kalau waktu dipangkas

1. POS live lalu dashboard melompat (wajib)
2. Forecast + dua lensa restock
3. Sisanya bisa diceritakan tanpa demo

### Skenario darurat

| Kejadian | Respons |
| --- | --- |
| Docker Desktop mati total | Buka `docs/screenshots/` sambil menutur alurnya; tekankan README quick start 3 langkah |
| Angka beda dari latihan | Normal — angka harian berotasi dengan tanggal; total seed selalu Rp 29.565.500 |
| Login gagal | Capslock; tabel akun demo ada di README (biarkan tab README terbuka) |
| Halaman berperilaku aneh | Incognito baru; paling buruk: `docker compose restart frontend` |
| Proyektor terlalu kecil | Zoom browser; F11 fullscreen |
| Demo benar-benar hancur | `docker compose down -v` + `up -d`, tunggu ± 2 menit, kondisi identik |

## 3. Antisipasi Pertanyaan Penguji

Jawaban ditulis agar bisa diucapkan 2-3 kalimat. Latih yang bertanda [W]
(working question — hampir pasti ditanya).

**[W] Q1 — Kenapa tidak pakai model yang lebih canggih: Holt-Winters,
ARIMA, atau LSTM?**
Dengan 42 hari data — hanya enam siklus mingguan — model berparameter banyak
akan overfit dan hasilnya sulit dijelaskan ke pemilik warung. Pola paling
kuat di data warung justru musiman mingguan (akhir pekan ramai), dan
rata-rata berbobot per hari-minggu menangkapnya langsung. Metodenya murni
fungsi Python, jadi teruji 17 unit test deterministik. Naik kelas ke
Holt-Winters atau Prophet masuk roadmap begitu data melewati 3-6 bulan.

**[W] Q2 — Kenapa backend FastAPI hanya read-only?**
Schema database dimiliki frontend: Next.js lewat Prisma adalah satu-satunya
penulis. Dengan begitu tidak ada dua layanan yang sama-sama menulis
(terhindar dari race kondisi dan drift schema), dan kegagalan di sisi
analitik paling buruk menghasilkan ramalan yang salah — data transaksi
tetap utuh. Ini pola CQRS-lite: jalur tulis dan jalur baca dipisahkan.

**[W] Q3 — Kenapa Decimal, bukan Float, untuk uang?**
Bilangan floating point biner tidak bisa merepresentasikan 0.1 secara
eksak, sehingga selisih pembulatan terakumulasi lintas ribuan struk.
Skema memakai Decimal(12,2) untuk semua kolom uang, dan harga tersimpan
sebagai snapshot per struk sehingga riwayat tidak ikut berubah saat harga
produk diperbarui.

**Q4 — Kenapa dua framework, tidak satu saja?**
Karena ekosistemnya berbeda: dashboard interaktif paling produktif di
React/Next, sementara analitik dan machine learning adalah dunia Python.
Keduanya digabung lewat HTTP server-to-server; browser tidak pernah
memanggil FastAPI langsung, jadi endpoint ML tidak terekspos dan CORS tidak
relevan.

**Q5 — Kalau dua kasir bertransaksi bersamaan?**
PostgreSQL menangani insert konkuren secara native, dan kode struk memiliki
unique constraint — kalau dua transaksi kebetulan menghasilkan kode sama,
database menolaknya keras, bukan diam-diam menimpa. Secara jujur: belum
diuji beban tinggi, tapi volume warung tunggal jauh di bawah titik itu.

**Q6 — Interval 80% itu dari mana?**
z = 1.2816 untuk interval 80% dua sisi, dikali deviasi standar sampel
hari-minggu-yang-sama. 95% akan menghasilkan pita sangat lebar dengan hanya
empat sampel — tampak tidak jujur; 80% adalah kompromi coverage vs
keterbacaan untuk data sebanyak ini.

**Q7 — Kalau warung baru buka dan tidak ada data?**
Ada cascade degenerasi: hari tanpa penjualan di awal riwayat diabaikan;
kalau tidak ada sampel hari-minggu-yang-sama sama sekali, jatuh ke
rata-rata keseluruhan; riwayat kosong menghasilkan ramalan nol. Widget tetap
merender — tidak pernah crash karena data miskin.

**Q8 — Bagaimana keamanannya?**
Password ter-hash bcrypt (tidak pernah plaintext), sesi NextAuth v5
ditandatangani AUTH_SECRET, role OWNER/KASIR membatasi halaman per peran,
dan backend ML tidak terekspos ke browser sama sekali. Sebagai limitasi
yang saya akui: ini stack demo — production masih butuh rate limiting dan
rotasi secret.

**Q9 — Kenapa halaman auth memakai instant = false?**
Di Next 16 dengan cacheComponents aktif, halaman yang digerbangi sesi tidak
boleh di-prerender statis — isinya berbeda per pengguna. Penanda itu
memaksa render per-request; sementara data ramalan di-fetch dengan
revalidate 900 detik karena cukup segar untuk kebutuhan dashboard.

**Q10 — Kenapa Prisma dengan driver adapter, bukan engine bawaan?**
Prisma 7 bisa berjalan tanpa binary engine Rust: client di-generate ke
repository dan memakai driver @prisma/adapter-pg murni JavaScript. Image
Docker jadi lebih ramping dan lintas-platform, sementara Prisma CLI tetap
dipakai untuk migrasi.

**Q11 — AI-nya di mana? (kalau penguji mencari "AI")**
Ini pembelajaran statistik: model mengestimasi permintaan dari data
historis dengan bobot recency — belajar dari data tanpa label eksplisit.
Saya sengaja tidak memakai deep learning: dengan 42 hari data, jaringan
saraf akan overfit. Menurut saya kualitas sistem ML dinilai dari keputusan
metodenya sesuai ukuran data, bukan dari nama modelnya.

**Q12 — Skalabilitasnya bagaimana?**
Schema sudah multi-outlet sejak awal — model Outlet dan outletId di produk,
pengguna, dan transaksi, plus indeks [outletId, createdAt] untuk query
laporan. Jalur baca analitik bisa direplikasi terpisah tanpa menyentuh jalur
tulis. Untuk skenario warung tunggal dan segelintir outlet, satu PostgreSQL
cukup jauh.

**Q13 — Apa kontribusi baru proyek ini?**
Bukan reinvent mesin kasir — nilainya ada di integrasi: arsitektur
baca/tulis yang tegas antara aplikasi dan layanan ML, peramalan ringan yang
bisa dijelaskan ke pemilik warung, dan satu-perintah deployment deterministik.
Kombinasi itu yang jarang ada di solusi UMKM existing.

## 4. Checklist Hari-H

- [ ] H-1: drill reset penuh — `docker compose down -v` lalu `up -d`, ukur
      waktunya, login dua peran, jalankan skrip demo sekali penuh dengan
      pengaturan dua jendela browser (sambil mencatat: setelah transaksi
      POS, kartu mana yang melompat saat refresh)
- [ ] H-1: screenshot cadangan tersimpan di `docs/screenshots/` (lihat
      daftar di bawah)
- [ ] H-1: slide final — angka hafalan dari bagian 1, bukan dari screenshot lama
- [ ] Pagi-H: buka /owner, catat 3 angka segar (forecast total, satu
      restock, satu terlaris)
- [ ] H-10 menit: `docker compose ps` hijau, dua jendela login, zoom,
      tab README terbuka, tab lain ditutup
- [ ] Charger, adapter proyektor, dan kabel bawa

### Daftar screenshot cadangan (nama file bebas, simpan di docs/screenshots/)

1. `01-owner-top.png` — empat kartu statistik + chart 7 hari + metode bayar
2. `02-forecast.png` — widget ramalan lengkap dengan breakdown harian
3. `03-restock.png` — kartu saran restock ML + kartu stok kritis
4. `04-cashier.png` — grid produk + keranjang terisi beberapa item
5. `05-payment.png` — momen pembayaran tunai dengan kembalian
6. `06-compose-ps.png` — terminal `docker compose ps` semua hijau
