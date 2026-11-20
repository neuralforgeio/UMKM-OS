# Dokumentasi API UMKM2Shell — Kendali & Prediksi Server

> Khusus **DEVELOPER**. Ter-audit (`SHELL_SERVER_*`, `SHELL_CMD_*`).
> Diperkenalkan di backend **2.4.0** / run-13 (audit command +
> kendali server: matikan, indikasi down, prediksi down).

---

## GET /api/v1/shell/server/kesehatan

Potret menyeluruh server **SEKARANG** — jawaban "server down atau
tidak?" dengan indikator nyata:

| Indikator | Sumber |
|---|---|
| `db_hidup` | ping 1 detik ke pool Postgres aktif |
| `rasio_error_http`, `http_500`, `total_http` | log CSV hari ini (level HTTP) |
| `p95_ms` | latensi persentil-95 dari log HTTP |
| `mem_tersedia_kb`, `mem_total_kb`, `load1` | /proc/meminfo + /proc/loadavg |
| `goroutine` | runtime server (terpasang saat boot) |
| `uptime_s` | /proc/uptime |
| `verdict` | **HIJAU** sehat / **KUNING** memburuk / **MERAH** down-ish |

**Aturan verdict** (diuji unit `TestVerdictKesehatan`):
- MERAH bila DB mati, ATAU rasio 5xx ≥ 50% (≥10 permintaan), ATAU p95 > 5 dtk.
- KUNING bila rasio 5xx > 5%, ATAU memori tersisa < 10%, ATAU load1 > 4, ATAU p95 > 2 dtk.
- HIJAU bila tidak ada alasan — `alasan` = ["semua indikator normal"].

**Contoh respons 200**

```json
{
  "success": true,
  "data": {
    "db_hidup": true, "rasio_error_http": 0.01, "total_http": 214,
    "http_500": 2, "mem_tersedia_kb": 1200000, "mem_total_kb": 4000000,
    "load1": 0.4, "goroutine": 24, "uptime_s": 86400, "p95_ms": 120,
    "verdict": "HIJAU", "alasan": ["semua indikator normal"]
  }
}
```

---

## GET /api/v1/shell/server/prediksi

**Prediksi server down** — ring sampler tiap 5 detik (maks 360 titik
= 30 menit riwayat) + **regresi linear least-squares** (murni, diuji
`TestKemiringanRegresi`) atas tiga metrik: rasio memori tersedia,
rasio error HTTP, p95 latensi. Estimasi **menit sampai ambang
kritis** (mem < 5%, error > 50%, p95 > 5 dtk).

**Contoh respons 200**

```json
{
  "success": true,
  "data": {
    "tren_mem": -0.00021, "tren_error": 0, "tren_p95_ms": 3.2,
    "menit_kritis": 12.5, "verdict": "WASPADA",
    "alasan": [
      "memori menurun 1.3%/menit (kini 40%)",
      "latensi p95 naik 192 ms/menit"
    ],
    "jumlah_sampel": 120
  }
}
```

- `verdict` **SEHAT** (tren stabil) / **WASPADA** (memburuk) /
  **KRITIS** (estimasi kritis < 10 menit) / **NA** (belum cukup 10
  sampel — sampler baru mulai).
- Diuji unit: `TestPrediksiDownButuhSampel`,
  `TestRingPrediksiDanRegresi` (tren -0.007/dtk terdeteksi persis →
  KRITIS), `TestRingMaksTerpotong` (ring 360 tidak bocor).

---

## POST /api/v1/shell/server/matikan

**Mematikan server secara graceful dari panel** — sama seperti
Ctrl+C: HTTP di-drain 5 detik, koneksi DB ditutup, log di-flush.
Di sisi backend, permintaan menembak channel `shell.Matikan` yang
ditunggu `main()` — **bukan** kill -9, jadi tidak ada data setengah
tulis.

**Body** (konfirmasi literal wajib — UI memakai dialog teks):

```json
{ "konfirmasi": "MATIKAN" }
```

**Respons 200**

```json
{ "success": true, "data": { "diminta": true, "status": "sedang-mati" } }
```

**Pagar** (diuji `TestMatikanServerSekaliSaja`):
- Konfirmasi selain `"MATIKAN"` → 400.
- Klik kedua **ditolak** (`diminta:false`) — idempoten, tidak ada
  dobel shutdown; permintaan ter-audit sebelum channel ditembak.
- Server restart = urusan docker compose / runner (panel tidak bisa
  menghidupkan lagi — itu bukan mandatnya).

---

## GET /api/v1/shell/server/status

Ringkasan murah untuk polling UI (tanpa parse log penuh):

```json
{ "success": true, "data": { "sedang_mati": false } }
```

---

## POST /api/v1/shell/cmd/validasi

**DRY-RUN validator terminal** — parser perintah dijalankan TANPA
eksekusi. Tab Terminal memakai ini memberi umpan balik sebelum tombol
Jalankan ditekan (dan untuk mengecek apakah baris akan ditolak).

**Body**

```json
{ "perintah": "find . -delete" }
```

**Respons 200 (baris ditolak)**

```json
{ "success": true, "data": {
  "valid": false, "perintah": "",
  "galat": "argumen memuat pola terlarang: -delete" } }
```

**Respons 200 (baris lolos)** — argumen sudah dijail (jalur absolut
di-rebase ke `SHELL_JAIL_ROOT`):

```json
{ "success": true, "data": {
  "valid": true, "perintah": "cat", "argumen": ["/srv/umkm/logs/x.log"] } }
```

---

## GET /api/v1/shell/cmd/tersedia

Whitelist yang binari **benar-benar ada di PATH** (LookPath saat
permintaan — 2.3.1): `netstat` umumnya tidak ada di image minimal,
UI menyembunyikannya daripada pengguna dapat `exec: not found`.

```json
{ "success": true, "data": { "perintah": {
  "ls": "daftar isi direktori", "echo": "cetak argumen", "...": "..." } } }
```

---

## Perubahan penting whitelist perintah (2.3.1 audit)

Hasil audit "check semua command" — 12 masalah nyata, semua
diperbaiki + dikunci tes regresi (`cmd_audit_test.go`, 10 tes):

| Masalah lama | Perbaikan |
|---|---|
| `node -e <kode>` = eksekusi kode arbitrer | **node & go dihapus** dari whitelist |
| `go run/build x.go` | idem |
| `env` mencetak SEMUA rahasia ke output | **env dihapus** — pakai tab Lingkungan (mask) |
| `find . -delete` menghapus isi | `-delete`/`-exec`/`-ok` diblok keras |
| `ip link set dev eth0 down` mematikan jaringan | `ip link` hanya `show`/`list` |
| `grep x /proc/self/environ` membocorkan env | `/proc /sys /dev /root /etc` diblok |
| jalur argumen TIDAK terikat jail sama sekali | SEMUA argumen jalur dijail/rebase ke `SHELL_JAIL_ROOT`; cwd exec = jail |
| `curl -O`/`wget -O` menulis file | hanya flag `-s -I --head` |
| rahasia di output masuk sejarah | output dimask (gsk_…/Bearer/password=) |
| `DATABASE_URL` tak dianggap rahasia | masuk POLA_RAHASIA (+REPLICA_URL) |
| perintah tak tersedia tetap bisa diklik | `tersedia` dinamis LookPath |
| `top`/`uname`/`nproc` tidak ada | ditambahkan (read-only) |

Whitelist kini **29 biner**: ls cat head tail wc df du free ps uptime
whoami id hostname date echo grep find stat sha256sum md5sum uname
nproc top pgrep netstat ip curl wget git.
