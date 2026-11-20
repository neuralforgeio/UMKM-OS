# Dokumentasi API UMKM2Shell — Filesystem

> Semua endpoint khusus peran **DEVELOPER** (header `Authorization: Bearer <token>`).
> Setiap panggilan tercatat di `audit_logs` (aksi `SHELL_FS_*`).
> Diperkenalkan di backend **2.3.0** / UMKM2Shell run-12.

Konsep inti: **penjara direktori (jail)**. Semua jalur dinormalkan terhadap
`SHELL_JAIL_ROOT` (default: direktori kerja proses backend). Jalur yang memuat
`..` ditolak sebelum menyentuh disk — tidak ada jalan keluar ke `/etc/passwd`.

---

## GET /api/v1/shell/fs?path=

Daftar isi satu direktori.

| Parameter | Tipe | Wajib | Ket |
|---|---|---|---|
| `path` | string | tidak | jalur relatif dalam penjara; kosong = akar |

**Contoh permintaan**

```http
GET /api/v1/shell/fs?path=logs
Authorization: Bearer <token>
```

**Respons 200**

```json
{
  "success": true,
  "data": {
    "jumlah": 2,
    "entri": [
      { "name": "sub", "path": "logs/sub", "is_dir": true, "size": 4096,
        "mode": "drwxr-xr-x", "mod_time": "2026-11-18T04:00:00Z" },
      { "name": "backend-2026-11-18.log", "path": "logs/backend-2026-11-18.log",
        "is_dir": false, "size": 12345, "mode": "-rw-r--r--",
        "mod_time": "2026-11-18T04:30:00Z" }
    ]
  }
}
```

Urutan: direktori dulu, lalu berkas, keduanya alfabetis.

**Galat**
- `400` — jalur memuat `..`, direktori tidak ada, atau di luar penjara.

---

## GET /api/v1/shell/fs/cat?path=

Baca isi berkas teks. Batas **512 KB** (`BatasBaca`); lebih dari itu dibaca
terpotong dan `terpotong: true`.

**Contoh permintaan**

```http
GET /api/v1/shell/fs/cat?path=logs/backend-2026-11-18.log
Authorization: Bearer <token>
```

**Respons 200**

```json
{ "success": true, "data": { "isi": "…isi berkas…", "terpotong": false } }
```

**Galat**
- `400` — berkas tidak ada, path direktori, atau di luar penjara.

---

## GET /api/v1/shell/fs/unduh?path=

Streaming unduh berkas (tidak dimuat ke memori). Content-Type ditebak dari
ekstensi (`.log`/`.txt` = text/plain; `.png` = image/png; dst; fallback
`application/octet-stream`). Header `Content-Disposition: attachment`.

**Contoh**

```http
GET /api/v1/shell/fs/unduh?path=dumps/cadangan-2026-11-18.sql.gz
Authorization: Bearer <token>
```

**Respons**: badan berkas (bukan JSON).

**Galat** — `400` berkas tidak ada / direktori / di luar penjara.

---

## PUT /api/v1/shell/fs

Tulis berkas teks (buat baru / timpa). Batas isi **512 KB**.

**Body**

```json
{ "path": "catatan-jaga.txt", "isi": "pompa cadangan minggu depan" }
```

**Respons 200**

```json
{ "success": true, "data": { "ditulis": "catatan-jaga.txt" } }
```

**Galat** — `400` body invalid, isi melebihi batas, atau jalur kabur.

---

## DELETE /api/v1/shell/fs?path=

Hapus berkas, atau direktori **yang kosong** (harus dikosongkan dulu —
sengaja, agar panel tidak dipakai menggerus penjara).

**Contoh**

```http
DELETE /api/v1/shell/fs?path=catatan-jaga.txt
Authorization: Bearer <token>
```

**Respons 200** — `{ "terhapus": "catatan-jaga.txt" }`

**Galat** — `400` tidak ada / direktori berisi / mencoba hapus akar penjara.

---

## PUT /api/v1/shell/fs/ganti-nama

Pindahkan/ganti nama berkas atau direktori dalam penjara.

**Body**

```json
{ "dari": "logs-lama.log", "ke": "arsip/logs-lama.log" }
```

**Respons 200** — `{ "dari": "...", "ke": "..." }`

**Galat** — `400` sumber tidak ada atau salah satu jalur kabur.

---

## Catatan keamanan

1. Jail dicek **sebelum** operasi (`Bersihkan` + tolak `..`) — diuji
   `TestBersihkanTakPernahKeluarJail`.
2. Baca dibatasi 512 KB, tulis 512 KB, unduh streaming.
3. `Tulis`/`Hapus`/`GantiNama` ter-audit dengan jalur lengkap.
4. Jalur `C:\Windows` dinormalkan backslash → slash lalu tetap
   di-`Bersihkan` sebagai jalur relatif (tidak pernah absolut).
