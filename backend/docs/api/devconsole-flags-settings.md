# Dokumentasi API — Bendera Fitur & Registri Pengaturan (devconsole-flags-settings)

Khusus DEVELOPER (2.2.0).

## GET /admin/flags
Bendera TERDAFTAR + nilai terkini + siapa terakhir menyetel + keterangan.

## PUT /admin/flags
Body `{ "key", "value" }`. Kunci HARUS terdaftar (bendera yatim → 400).
Nilai dibaca per-permintaan: efek instan tanpa restart; tersimpan di
tabel `flags` (ikut cadangan). Gagal baca DB = false (fail-closed).

## GET /admin/settings
Registri kunci terdaftar: `key, type, value, default, updated_by,
updated_at, keterangan`. Nilai DB menang atas env.

## PUT /admin/settings
Body `{ "key", "value" }` (nilai string; divalidasi tipe di server:
int harus angka, bool harus true/false). Kunci di luar daftar → 400.
Rahasia (`JWT_SECRET` dsb.) sengaja TIDAK masuk registri.
