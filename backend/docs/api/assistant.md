# Dokumentasi API — OSCAR Asisten & Ramalan

Gateway frontend (X-Internal-Key) — tidak dipanggil browser langsung.

## POST /assistant/chat
Percakapan multi-giliran; sejarah per pengguna.

## GET /assistant/history
Riwayat chat pemanggil.

## GET/PUT /assistant/llm-config
Model/provider/pemetaan. PUT khusus DEVELOPER; model terkunci
(`model_locked`) hanya developer boleh buka.

## POST /assistant/llm-selftest
Uji konektivitas LLM saat ini (dipakai halaman Pengaturan).

## GET /assistant/status (PUBLIK)
Status asisten tanpa key — kejujuran status > menyembunyikan.

## GET /forecast/revenue, GET /forecast/products
Ramalan omzet & produk laris ( Holt sederhana, dipakai halaman OSCAR).

## GET /assistant/oscar-developer-report[/run]
Laporan kesehatan OSCAR ber-PIN developer (dibuka dari browser dev).
