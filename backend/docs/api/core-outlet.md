# Dokumentasi API — Outlet & Pemeliharaan (core-outlet)

## GET /outlets (OWNER/DEVELOPER)
Daftar outlet untuk konsol (v1.4.0).

## GET /outlets/{id} (OWNER/DEVELOPER)
Detail satu outlet.

## POST /outlets (DEVELOPER)
Outlet baru dari konsol dev: `{ name, address, phone }`.

## PUT /outlets/{id} (OWNER/DEVELOPER)
Pembaruan parsial: nama/alamat/telepon/aktif.

## Logo (v1.4.0)
- `POST /outlets/{id}/logo` — multipart (OWNER/DEVELOPER).
- `DELETE /outlets/{id}/logo`.
- `GET /outlets/{id}/logo` — **PUBLIK** (img tag).

## Mode pemeliharaan (DEVELOPER, jejak ter-audit)
- `POST /outlets/{id}/maintenance-session` — masuk mode.
- `DELETE /outlets/{id}/maintenance-session` — keluar mode.
