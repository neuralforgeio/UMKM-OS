# Dokumentasi API — Sesi Aktif & Tendang (devconsole-sessions)

Khusus DEVELOPER (2.2.0).

## GET /admin/sessions
Sesi 24 jam terakhir (hidup + baru dicabut), maks 200, terbaru dulu.
Baris: `id, user_id, user_name, user_role, ip, user_agent, created_at,
last_seen, expires_at, revoked_at`.

## DELETE /admin/sessions/{sid}
Tandang: set `revoked_at`; token ber-sid itu ditolak RequireAuth pada
permintaan BERIKUTNYA (`401 Sesi telah dicabut, silakan login ulang`) —
tanpa menunggu kadaluarsa 24 jam.
Sesi sendiri DITOLAK (`Tidak bisa menendang sesi sendiri - gunakan
logout`) supaya developer tidak mengunci diri keluar di tengah
pemeliharaan.
