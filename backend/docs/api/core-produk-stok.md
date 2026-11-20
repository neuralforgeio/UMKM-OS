# Dokumentasi API — Produk, Gambar, Stok (core-produk-stok)

## GET /products?outlet_id=&q=&low_stock=
Daftar produk; `low_stock=1` menyaring di bawah ambang.

## GET /products/{id}
Detail satu produk.

## (Produk tulis: POST/PUT/DELETE /products — OWNER/DEVELOPER via
konsol; frontend memakai pintu yang sama sejak era Go murni.)

## Gambar produk (OWNER/DEVELOPER)
- `POST /products/{id}/images` — multipart `file` (jpg/png/webp, maks 5 MB).
- `DELETE /images/{id}`
- `PUT /images/{id}/thumb` — jadikan thumbnail.
- `PUT /images/{id}/move` — geser urutan slot.
- `GET /images/{id}` — **PUBLIK** (img tag tanpa header).

## Stok
- `POST /stock/movements` — IN/OUT/ADJUST + catatan.
- `GET /stock/movements?product_id=` — jejak per produk.

## Serah terima barang (handover, v1.3.1)
- `POST /handover/start` — kasir mulai serah terima (kode + barang).
- `POST /handover/verify` — owner memverifikasi kode klaim.
