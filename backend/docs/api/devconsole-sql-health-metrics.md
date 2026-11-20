# Dokumentasi API — SQL Console, Kesehatan, Metrik (devconsole-sql-health-metrics)

Khusus DEVELOPER (2.2.0).

## POST /admin/sql
Body `{ "query" }`. HANYA-BACA: satu pernyataan SELECT tanpa
titik-koma; komentar dibuang; kata tulis (insert/update/delete/drop/
alter/create/truncate/grant/revoke/copy/vacuum/reindex/comment/lock/
call/do/listen/notify/set/begin/commit/rollback/merge/replace/with)
ditolak sebagai kata utuh; LIMIT dipaksa ≤ 500 (dipasang bila tidak
ada); maks 30 kolom; blob > 64 KB disingkat. Respons: `kolom`,
`baris` (nilai JSON per tipe), `total`. TIAP kueri ter-audit
(`SQL_CONSOLE`, teks kueri terpotong 500 kar. di detail).

## GET /admin/health
`app_version, go_version, uptime_s, uptime, goroutine, mem_heap_mb,
mem_sys_mb, num_gc, node_aktif, failover_n, riwayat_pindahan,
db_sehat, sesi_hidup`.

## GET /admin/metrics
`per_outlet` (id, nama, user, produk, omzet & trx HARI INI),
`per_jam` (trx per jam hari ini), `total_produk`, `total_user`.
