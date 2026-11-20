# Dokumentasi API UMKM2Shell — Lingkungan & Jaringan

> Khusus **DEVELOPER**. Ter-audit (`SHELL_ENV_*`, `SHELL_NET_*`).
> Diperkenalkan di backend **2.3.0** / UMKM2Shell run-12.

---

## GET /api/v1/shell/env?buka=KUNCI

Daftar seluruh variabel lingkungan proses backend, terurut abjad.

**Aturan rahasia** (`ApakahRahasia`, diuji): kunci yang memuat
`KEY TOKEN SECRET PASSWORD PASSWD CREDENTIAL PRIVATE CERT SIGNATURE
DSN WEBHOOK` (case-insensitive) → nilai **DIMASK** menjadi bentuk
`gsk_…(34)` (awalan 4 karakter + panjang). Pengecualian eksplisit:
`NEXT_PUBLIC_API_URL` (URL publik).

**Contoh**

```http
GET /api/v1/shell/env
Authorization: Bearer <token>
```

**Respons 200**

```json
{
  "success": true,
  "data": {
    "env": [
      { "key": "BACKUP_DIR", "value": "dumps", "rahasia": false },
      { "key": "GROQ_API_KEY", "value": "gsk_…(52)", "rahasia": true }
    ]
  }
}
```

### Membuka satu kunci

`?buka=GROQ_API_KEY` → kunci **itu saja** tampil nilai asli; permintaan
ter-audit dengan nama kuncinya (`SHELL_ENV_BUKA`) dan log `Warn`
tercetak. Semua kunci lain tetap termask. UI harus selalu meminta
konfirmasi sebelum memakai parameter ini.

---

## POST /api/v1/shell/net/ping

Ping TCP (bukan ICMP — kontainer tanpa capability raw socket) ke
`host:port`, timeout **5 detik**.

**Body**

```json
{ "host": "127.0.0.1", "port": "5432" }
```

**Respons 200**

```json
{ "success": true, "data": { "hidup": true, "latensi_ms": 0.8 } }
```

**Galat** — `400` sambungan gagal (pesan memuat penyebab).

**Dipakai untuk**: memeriksa node Postgres pusat/salinan masih hidup —
pasangan fitur failover DB dari run-7.

---

## POST /api/v1/shell/net/http

`HEAD` ringan ke URL (fallback `GET` bila server menolak HEAD),
timeout **5 detik**. Redirect **tidak diikuti** (panel tidak boleh
jadi proxy). Skema harus `http://` atau `https://`.

**Body**

```json
{ "url": "https://api.groq.com/openai/v1" }
```

**Respons 200**

```json
{ "success": true, "data": { "status": 401, "latensi_ms": 210.5 } }
```

**Galat** — `400` skema lain (`file://` dll — diuji
`TestHttpHeadTolakSkemaAneh`) atau permintaan gagal.

---

## Ringkasan seluruh pintu UMKM2Shell

| Metode | Jalur | Fitur | Dokumen |
|---|---|---|---|
| GET | `/shell/fs?path=` | ls | shell-fs.md |
| GET | `/shell/fs/cat?path=` | cat | shell-fs.md |
| GET | `/shell/fs/unduh?path=` | unduh | shell-fs.md |
| PUT | `/shell/fs` | tulis | shell-fs.md |
| DELETE | `/shell/fs?path=` | hapus | shell-fs.md |
| PUT | `/shell/fs/ganti-nama` | pindah | shell-fs.md |
| GET | `/shell/proc` | proses | shell-proc-cmd.md |
| POST | `/shell/proc/sinyal` | sinyal | shell-proc-cmd.md |
| POST | `/shell/cmd` | jalankan | shell-proc-cmd.md |
| GET | `/shell/cmd` | sejarah | shell-proc-cmd.md |
| POST | `/shell/cmd/interupsi` | batal | shell-proc-cmd.md |
| GET | `/shell/cmd/daftar` | whitelist | shell-proc-cmd.md |
| GET | `/shell/env?buka=` | env | shell-env-net.md |
| POST | `/shell/net/ping` | ping TCP | shell-env-net.md |
| POST | `/shell/net/http` | HEAD | shell-env-net.md |
