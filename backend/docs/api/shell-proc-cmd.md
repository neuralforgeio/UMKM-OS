# Dokumentasi API UMKM2Shell — Proses & Perintah

> Khusus **DEVELOPER**. Ter-audit (`SHELL_PROC_*`, `SHELL_CMD_*`).
> Diperkenalkan di backend **2.3.0** / UMKM2Shell run-12.

---

## GET /api/v1/shell/proc

Daftar proses (dari `/proc`, Linux) + statistik sistem.

**Respons 200 (ringkas)**

```json
{
  "success": true,
  "data": {
    "pid_sendiri": 1234,
    "proses": [
      { "pid": 1234, "ppid": 1, "user": "uid:1000",
        "cmdline": "/app/backend", "cpu_pct": 1.5,
        "mem_kb": 24560, "state": "S" }
    ],
    "stat_sistem": {
      "mem_total_kb": 2000000, "mem_free_kb": 800000,
      "mem_available_kb": 1200000, "load1": 0.24, "load5": 0.31,
      "proses_total": 90, "uptime_s": 86400
    }
  }
}
```

- Maksimal **200 proses** (terurut memori terbesar dulu) supaya panel ringan.
- `cpu_pct` = estimasi `(utime+stime)/uptime` — murah, tanpa sampling.
- `pid_sendiri` dipakai UI untuk menolak tombol sinyal pada proses backend.

---

## POST /api/v1/shell/proc/sinyal

Kirim sinyal ke proses.

**Body**

```json
{ "pid": 5678, "sinyal": 15 }
```

| Sinyal | Nilai | Arti |
|---|---|---|
| SIGTERM | 15 | mati sopan (default) |
| SIGINT | 2 | Ctrl-C |
| SIGKILL | 9 | mati paksa |

**Pagar pengaman** (semua diuji `TestKirimSinyalDiriSendiriDitolak`):
1. `pid <= 1` DITOLAK — init/kernel.
2. `pid == pid_sendiri` DITOLAK — bunuh diri = warung + panel mati bersamaan.
3. Sinyal selain 15/2/9 DITOLAK.

**Respons 200** — `{ "pid": 5678, "sinyal": 15 }`

**Galat** — `400` salah satu pagar terlanggar atau proses sudah mati.

---

## POST /api/v1/shell/cmd

Jalankan perintah dari **daftar putih** (whitelist). Satu perintah jalan
pada satu waktu (antrian serial); batas waktu default **20 detik**
(`SHELL_CMD_TIMEOUT_S`).

**Body**

```json
{ "perintah": "df -h" }
```

**Respons 200**

```json
{
  "success": true,
  "data": {
    "id": 7, "perintah": "df -h",
    "mulai": "2026-11-18T04:40:00Z", "selesai": "2026-11-18T04:40:01Z",
    "exit_code": 0, "output": "Filesystem ...\n"
  }
}
```

**Aturan validasi** (`ValidasiPerintah`, diuji 18 kasus):
- Token pertama HARUS di daftar putih: `ls cat head tail wc df du free ps
  uptime whoami id hostname date echo grep find stat sha256sum md5sum env
  pgrep netstat ip curl wget node go git`.
- **Tanpa shell** (`sh -c` tidak pernah dipakai): argumen dipecah
  `strings.Fields` — `|` `;` `&&` `` ` `` `$(` `>` ditolak sebagai pola
  terlarang (tidak ada shell yang bisa menafsirkannya).
- Argumen memuat `../`, `/etc/shadow`, `.ssh`, `id_rsa`, `GROQ`,
  `JWT_SECRET`, `DATABASE_URL`, `DOCKER_`, `AWS_` → ditolak.
- `git` hanya `status`/`log`/`diff` (bukan push/pull yang mengubah remote).
- `curl`/`wget` hanya flag `-s` `-I` `--head` (tanpa `-X POST` dll).

**Galat** — `400` perintah tidak putih / pola terlarang / ada perintah
lain sedang jalan (pesan menyebut id-nya — interupsi dulu).

---

## GET /api/v1/shell/cmd

Sejarah (50 terakhir, terbaru dulu) + status antrian.

**Respons 200**

```json
{
  "success": true,
  "data": {
    "sedang_jalan": false, "sedang_id": 0,
    "sejarah": [ { "id": 7, "...": "..." } ]
  }
}
```

---

## POST /api/v1/shell/cmd/interupsi

Batalkan perintah yang sedang jalan (Context cancel).

**Respons 200** — `{ "diinterupsi": true }` (`false` bila tidak ada yang jalan).
Entri sejarah dicatat `exit_code: -2`, `sebab_gagal: "diinterupsi dari panel"`.

---

## GET /api/v1/shell/cmd/daftar

Daftar putih + keterangan Indonesia (dipakai UI untuk autocomplete).

```json
{ "success": true, "data": { "perintah": { "ls": "daftar isi direktori", "...": "..." } } }
```

---

## Batas waktu & output

- Batas waktu: `SHELL_CMD_TIMEOUT_S` (default 20). Lewat → proses dimatikan,
  entri `exit_code: -1`, `sebab_gagal: "batas waktu 20 detik"`.
- Output dipotong **256 KB** (`BatasOutput`) + penanda `terpotong`
  (diuji `TestPotongOutputMurni`).
