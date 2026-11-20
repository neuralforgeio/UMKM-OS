# Dokumentasi API — Transaksi POS & Struk (core-transaksi)

Butuh login (semua peran). Angka rupiah = integer (cent).

## POST /transactions
Body `{ outlet_id, items: [{ product_id, qty }], payment_method }`.
Server menghitung subtotal/harga — harga tidak pernah datang dari klien.
Efek: stok berkurang, `stock_movements` OUT tercatat.

## GET /transactions?dari=&hingga=&page=
Daftar ter-scope peran: OWNER outletnya, CASHIER miliknya sendiri.

## GET /transactions/{id}
Detail + item. OWNER/CASHIER/DEVELOPER.

## POST /transactions/{id}/refund (v1.3.0)
Pengembalian sebagian/sepenuhnya; butuh OWNER.

## Struk publik (v1.3.0, TANPA login)
- `GET /public/receipt/{nomor}` — pembeli membuka dari QR.
- `POST /public/receipt/{nomor}/confirm` — konfirmasi barang diterima
  (body kode klaim 8 karakter).
- `POST /public/receipt/{nomor}/dispute` — bantah (mengunci konfirmasi).
