# Dokumentasi API — Jejak Audit (devconsole-audit)

## GET /audit-logs?level=&action=&q=&page=&dari=&hingga=
DEVELOPER melihat semua outlet; OWNER ter-scope outletnya (sejak 1.6.0).
Maks 20 baris per halaman; filter hidup di URL.
Baris: `id, user_id, user_name, user_role, outlet_id, outlet_name,
action, entity, entity_id, detail, ip, geo_kota, created_at`.

## GET /audit-logs/export (v2.1.0)
Unduh XLSX jejak terfilter (dengan ringkasan + grafik tingkat).
