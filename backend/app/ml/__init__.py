"""Paket ML v3.0.0 — engine Prophet per-outlet untuk UMKM OS.

Anggota:
  - prophet_engine : pembungkus Prophet ber-import-guard (layanan TETAP
                     hidup walau prophet gagal terpasang/ter-import).
  - store          : artefak model joblib per outlet (atomic write).
  - trainer        : duel backtest MAPE dua engine + orkestrasi async.
  - train          : CLI manual (python -m app.ml.train --outlet 1).

Kontrak arsitektur tetap: paket ini tidak pernah membuka sesi database —
deret (date, value) diberikan router; hasilnya artefak polos.
"""
