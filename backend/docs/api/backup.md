# Dokumentasi API — Cadangan & Salinan DB

OWNER/DEVELOPER (bukan kasir).

## GET /admin/backup
Daftar berkas cadangan (nama, ukuran, waktu) + konfigurasi retensi.

## POST /admin/backup (v2.0.0)
Jalankan cadangan SEKARANG (pg_dump murni Go; tabel aplikasi saja —
tabel legacy disaring; SETIAP kolom dijamin oleh penjamin kolom 2.1.3).

## POST /admin/restore (v2.1.0)
Ganti node aktif dari berkas cadangan (siklus gantikan→sinkronkan).

## GET /admin/db-status
Node aktif + kesehatan dua node + riwayat failover + cadangan terakhir.

## POST /admin/failover (run-7)
Pindah node aktif ke salinan; pemulihan terkinci saat kembali.
