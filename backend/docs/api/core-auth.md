# Dokumentasi API — Autentikasi & Profil (core-auth)

Prefix `/api/v1`. Login publik; sisanya butuh `Authorization: Bearer <token>`.

## POST /auth/login
Body `{ "email", "password" }`. Respons `data.token` (JWT ber `sid` sejak 2.2.0)
+ `data.user` (id, name, email, role, outlet_id, photo_version).
Galat: 401 email/password salah; 403 akun nonaktif.
Sejak 2.2.0 tiap login membuat baris `sessions` — menendang sesi dari
konsol developer mencabut token seketika.

## GET /auth/me
Identitas pemanggil + konteks outlet.

## POST /auth/change-password
Body `{ "old_password", "new_password" }` (min 8 karakter).

## PUT /me, POST /me/photo, GET /me/photo, DELETE /me/photo
Profil mandiri (v1.7.0): hanya baris pemanggil, tanpa eskalasi peran.

## GET /my/outlet
Identitas outlet konteks pemanggil (v1.5.0).

## GET /health (PUBLIK)
`{ app_version, db_sehat }` — dipakai docker healthcheck.
