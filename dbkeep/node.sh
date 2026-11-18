#!/bin/sh
# UMKM OS — dbkeep/node.sh (run-7, disederhanakan run-8)
#
# Pelayani node SALINAN dari compose service "dbkeep".
#
# RUN-8: psql/pg_dump eksternal di image runtime BACKEND DIHAPUS total
# (akar kegagalan mesin pemilik: pg_dump klien Debian 15 menolak keras
# server PostgreSQL 18 "server version mismatch"). Cadangan + failover
# + sinkron balik kini MURNI GO di dalam backend (internal/backup:
# introspeksi katalog + DDL dari internal/schema), dan dbkeep TIDAK
# lagi menjalankan pg_dump sendiri. Image dbkeep = postgres:18-alpine
# yang SAMA dengan server (klien psql versinya kelasnya cocok), jadi
# satu-satunya pekerjaan SQL dbkeep adalah RE-CLONE AWAL salinan:
# membaca berkas cadangan .sql.gz TERBARU dari volume backups bersama
# (dihasilkan backend murni Go) lalu menerapkannya lewat psql stdin.
#
# Peran lain murni INFRASTRUKTUR ringan: mencatat zaman-salinan mulai
# dan berakhir di log compose (keputusan failover + sinkron balik +
# riwayat resmi di tabel dbheartbeat milik backend - satu sumber
# kebenaran). Skrip POSIX sh; aksi dikunci flock.
#
# Env (dipasang service dbkeep di docker-compose):
#   PUSAT_URL, SALINAN_URL : URL kedua node (dalam jaringan compose)
#   INTERVAL               : detik antar siklus pemeriksaan
#   BACKUP_DIR             : volume backups bersama (default /backups)

set -u

PUSAT_URL="${PUSAT_URL:-postgres://umkm:umkm@db:5432/umkmos}"
SALINAN_URL="${SALINAN_URL:-postgres://umkm:umkm@db-salinan:5432/umkmos}"
INTERVAL="${INTERVAL:-10}"
LOCK=/tmp/dbkeep.lock
BACKUP_DIR="${BACKUP_DIR:-/backups}"

log() { echo "[dbkeep] $(date '+%H:%M:%S') $*"; }

exec 9>"$LOCK"
flock 9

log "dbkeep hidup: pusat=$PUSAT_URL salinan=$SALINAN_URL interval=${INTERVAL}s"
log "cadangan + failover + sinkron balik = MURNI GO di backend (2.1.1)"

ping_psql() { psql "$1" -tAc "SELECT 1" >/dev/null 2>&1; }

# ada_tabel: 1 bila node punya skema public.users.
ada_tabel() { psql "$1" -tAc "SELECT to_regclass('public.users') IS NOT NULL" 2>/dev/null | grep -q t; }

ZAMAN_SALINAN=0
PUSAT_DULU=1

while :; do
    PUSAT_OK=0; SALINAN_OK=0
    ping_psql "$PUSAT_URL" && PUSAT_OK=1
    ping_psql "$SALINAN_URL" && SALINAN_OK=1

    # Cermin sisi infra untuk riwayat zaman-salinan (catatan resmi
    # tetap di tabel dbheartbeat milik backend).
    if [ "$PUSAT_OK" = "0" ] && [ "$SALINAN_OK" = "1" ] && [ "$PUSAT_DULU" = "1" ]; then
        log "PUSAT TIDAK TERJANGKAU — backend memfailover ke salinan (zaman-salinan dimulai)"
        PUSAT_DULU=0
        ZAMAN_SALINAN=1
    fi
    if [ "$PUSAT_OK" = "1" ] && [ "$ZAMAN_SALINAN" = "1" ]; then
        log "PUSAT PULIH — sinkron balik zaman-salinan diurus backend (murni Go)"
        ZAMAN_SALINAN=0
        PUSAT_DULU=1
    fi
    [ "$PUSAT_OK" = "1" ] && PUSAT_DULU=1

    # Re-clone awal salinan bila kosong: terapkan berkas cadangan
    # TERBARU dari volume bersama lewat psql stdin (klien psql versi
    # 18 di image ini cocok dengan server 18 — berkasnya sendiri
    # dihasilkan backend murni Go, bukan pg_dump).
    if [ "$SALINAN_OK" = "1" ] && [ "$PUSAT_OK" = "1" ] && ! ada_tabel "$SALINAN_URL"; then
        TERBARU=$(ls -1 "$BACKUP_DIR"/umkm-backup-*.sql.gz 2>/dev/null | sort | tail -1)
        if [ -n "$TERBARU" ]; then
            log "re-clone salinan dari cadangan terbaru: $TERBARU"
            if gzip -dc "$TERBARU" | psql "$SALINAN_URL" -v ON_ERROR_STOP=1 -q; then
                log "re-clone SELESAI (salinan kini menyalin pusat)"
            else
                log "re-clone GAGAL — dicoba lagi siklus berikutnya"
            fi
        else
            log "salinan kosong dan belum ada berkas cadangan di $BACKUP_DIR — tunggu backup pertama backend (loop otomatis / tombol)"
        fi
    fi

    sleep "$INTERVAL"
done
