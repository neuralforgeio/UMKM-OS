# Indeks Dokumentasi API — UMKM-OS Backend

Dokumentasi per keluarga fitur. Semua contoh memakai prefix
`/api/v1` dan header `Authorization: Bearer <token>` kecuali
disebut lain.

## Core (auth, transaksi, produk, stok, outlet)

| Dokumen | Isi | Sejak |
|---|---|---|
| [core-auth.md](core-auth.md) | login, sesi, profil, ganti password, foto | 1.0.0 |
| [core-transaksi.md](core-transaksi.md) | transaksi POS, struk publik, klaim QR | 1.0.0 |
| [core-produk-stok.md](core-produk-stok.md) | produk, gambar, stok, serah terima | 1.0.0 |
| [core-outlet.md](core-outlet.md) | outlet, logo, mode pemeliharaan | 1.4.0 |

## Konsol Developer (v1.6.0 - 2.2.0)

| Dokumen | Isi | Sejak |
|---|---|---|
| [devconsole-audit.md](devconsole-audit.md) | jejak audit + ekspor | 1.6.0 |
| [devconsole-sessions.md](devconsole-sessions.md) | sesi aktif + tendang | 2.2.0 |
| [devconsole-flags-settings.md](devconsole-flags-settings.md) | bendera fitur + registri pengaturan | 2.2.0 |
| [devconsole-sql-health-metrics.md](devconsole-sql-health-metrics.md) | SQL console, kesehatan, metrik | 2.2.0 |

## UMKM2Shell (2.3.0 — 2.4.0)

| Dokumen | Isi | Sejak |
|---|---|---|
| [shell-fs.md](shell-fs.md) | penjelajah filesystem (penjara jail) | 2.3.0 |
| [shell-proc-cmd.md](shell-proc-cmd.md) | manajer proses + pelari perintah | 2.3.0 |
| [shell-env-net.md](shell-env-net.md) | inspektur env + perkakas jaringan | 2.3.0 |
| [shell-server.md](shell-server.md) | kendali server: kesehatan, prediksi down, matikan, validasi dry-run, tersedia | 2.4.0 |

## Lain-lain

| Dokumen | Isi | Sejak |
|---|---|---|
| [assistant.md](assistant.md) | OSCAR asisten + konfigurasi LLM + selftest | 1.2.0 |
| [backup.md](backup.md) | cadangan, salinan, failover DB | 2.0.0 |
| [forecast.md](forecast.md) | ramalan omzet/produk | 1.3.0 |
