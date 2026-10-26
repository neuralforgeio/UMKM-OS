"""Duel dua engine via backtest MAPE — pemenang dipilih DATA, bukan asumsi.

Inti murni (run_backtest / train_from_series) TIDAK menyentuh database,
FastAPI, pydantic, maupun pengaturan — deret harian masuk, artefak polos
keluar — sehingga dapat diuji tanpa PostgreSQL (tests/test_trainer.py).
Prophet disuntik sebagai pasangan fungsi (fit/predict) supaya test
memakai stub; jalur nyata memakai app.ml.prophet_engine.

Aturan duel (disetujui user, ACC 2026-10-26):
  1. GERBANG DATA: deret < 56 hari, atau < 28 hari ber-pendapatan →
     tidak ada duel; router memakai jalur statistical in-line seperti
     sedia kala (artefak tidak dibuat).
  2. SPLIT fixed-origin: train = 75% awal, test = 25% akhir
     (dijepit 14..45 hari) — masa lalu tidak pernah bocor ke masa uji.
  3. MAPE dihitung HANYA atas hari uji ber-aktual non-zero
     (app/services/mape.py) — hari nol di luar yurisdiksi MAPE.
  4. Prophet menang HANYA bila MAPE-nya mengalahkan statistical dengan
     margin >= 2.0 poin persen — di bawah itu, kesederhanaan menang.
  5. Pemenang prophet di-REFIT atas deret penuh untuk prediksi nyata;
     kegagalan refit menurunkan pemenang ke statistical (jujur, tanpa
     melempar).

Orkestrasi async (ensure_model) menambah tiga hal di atas inti murni:
kunci per-outlet (request paralel outlet sama tidak melatih dobel),
antrean serial global (satu training pada satu waktu — RAM Pongo 735),
dan asyncio.to_thread agar event loop FastAPI tidak pernah diblokir.
Request TIDAK PERNAH menunggu training: model basi dipakai dulu, model
baru tersedia mulai request berikutnya.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable, Sequence
from datetime import date, datetime, timezone
from typing import Any

from app.ml.prophet_engine import fit_model, predict_with_bands
from app.services.forecast import weekday_forecast
from app.services.mape import mean_absolute_percentage_error

logger = logging.getLogger(__name__)

# ---- Gerbang data -------------------------------------------------------
MIN_DAYS = 56          # minimal panjang deret (hari)
MIN_NONZERO = 28       # minimal hari ber-pendapatan

# ---- Split backtest -----------------------------------------------------
TEST_FRACTION = 0.25   # porsi data akhir yang menjadi masa uji
TEST_MIN = 14          # di bawah ini hasil MAPE terlalu bising
TEST_MAX = 45          # di atas ini masa uji menjauh dari "masa kini"

# ---- Aturan pemenang ----------------------------------------------------
WIN_MARGIN_PP = 2.0    # Prophet wajib menang minimal 2.0 poin persen

# Jendela data training maksimum (dipakai router & CLI saat mengambil
# deret dari database): cukup panjang untuk musim mingguan & liburan,
# cukup pendek agar warung yang berubah pola tidak dirusak masa lalu.
MODEL_WINDOW_DAYS = 180

FitFn = Callable[[Sequence[tuple[date, float]]], Any]
PredictFn = Callable[[Any, Sequence[date]], list[tuple[float, float, float]]]

# Kunci per-outlet: request paralel outlet yang sama menunggu di sini.
_locks: dict[str, asyncio.Lock] = {}
# Antrean serial global: hanya SATU training Prophet pada satu waktu
# (proteksi RAM 8GB — lihat docstring prophet_engine).
_serial: asyncio.Semaphore = asyncio.Semaphore(1)


def split_sizes(n: int) -> tuple[int, int]:
    """(train_n, test_n) sesuai aturan split; n >= MIN_DAYS diasumsikan."""
    test_n = round(n * TEST_FRACTION)
    test_n = max(TEST_MIN, min(TEST_MAX, test_n))
    return n - test_n, test_n


def run_backtest(
    series: Sequence[tuple[date, float]],
    prophet_fit: FitFn | None = None,
    prophet_predict: PredictFn | None = None,
) -> dict[str, Any] | None:
    """Adukan kedua engine pada split yang sama; None bila gerbang gagal.

    Deret diasumsikan gap-free harian (hasil zero_fill_daily router).
    """
    pairs = sorted((day, float(value)) for day, value in series)
    n = len(pairs)
    nonzero = sum(1 for _, value in pairs if value > 0)
    if n < MIN_DAYS or nonzero < MIN_NONZERO:
        return None

    train_n, test_n = split_sizes(n)
    train = pairs[:train_n]
    test = pairs[train_n:]
    actual = [value for _, value in test]
    test_dates = [day for day, _ in test]

    # Engine statistical — engine yang sama persis dengan produksi
    # (services/forecast.weekday_forecast), dijalankan atas data train.
    stat_points = weekday_forecast(train, test_n)
    stat_pred = [p["point"] for p in stat_points]
    mape_stat = mean_absolute_percentage_error(actual, stat_pred)

    # Engine Prophet — hanya bila fungsi disuntik (None = jalur mati).
    mape_prophet: float | None = None
    if prophet_fit is not None and prophet_predict is not None:
        try:
            model = prophet_fit(train)
            bands = prophet_predict(model, test_dates)
            mape_prophet = mean_absolute_percentage_error(
                actual, [point for point, _, _ in bands]
            )
        except Exception as exc:
            logger.warning("backtest Prophet gagal: %r", exc)
            mape_prophet = None

    if (
        mape_prophet is not None
        and mape_stat is not None
        and mape_prophet < mape_stat - WIN_MARGIN_PP
    ):
        winner = "prophet"
    else:
        winner = "statistical"

    margin = (
        mape_stat - mape_prophet
        if mape_prophet is not None and mape_stat is not None
        else None
    )
    return {
        "winner": winner,
        "mape_prophet": mape_prophet,
        "mape_statistical": mape_stat,
        "margin_pp": margin,
        "backtest_days": test_n,
        "train_days": train_n,
        "min_margin_pp": WIN_MARGIN_PP,
    }


def train_from_series(
    series: Sequence[tuple[date, float]],
    prophet_fit: FitFn | None = None,
    prophet_predict: PredictFn | None = None,
) -> dict[str, Any] | None:
    """Backtest lalu (bila prophet menang) refit penuh → artefak siap simpan.

    Mengembalikan None bila gerbang data gagal. Artefak selalu mencatat
    metrik duel secara jujur — termasuk saat pemenangnya statistical.
    """
    duel = run_backtest(series, prophet_fit, prophet_predict)
    if duel is None:
        return None

    model: Any = None
    if duel["winner"] == "prophet" and prophet_fit is not None:
        try:
            # Standar praktik: backtest memilih metode, model final
            # dilatih atas SELURUH data (train + test).
            model = prophet_fit(series)
        except Exception as exc:
            logger.warning("refit final Prophet gagal: %r", exc)
            duel["winner"] = "statistical"
            duel["margin_pp"] = None

    artifact: dict[str, Any] = {
        "outlet_id": None,  # diisi pemanggil (ensure_model / CLI)
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "trained_through": str(max(day for day, _ in series)),
        **duel,
        "model": model,
    }
    return artifact


async def ensure_model(
    outlet_id: str,
    series: Sequence[tuple[date, float]],
    store: Any,
    *,
    prophet_enabled: bool = True,
    ttl_hours: int = 12,
) -> dict[str, Any] | None:
    """Pastikan artefak outlet segar; latih di background bila perlu.

    Alur keputusannya (semua jalur non-blocking):
      - artefak segar                     → langsung dipakai;
      - outlet sedang dilatih request lain → pakai artefak basi (kalau
        ada) TANPA menunggu — request berikutnya mendapat model baru;
      - Prophet dimatikan/gagal import     → None (statistical in-line);
      - gerbang data gagal                 → None (statistical in-line).
    """
    from app.ml import prophet_engine

    artifact = store.load(outlet_id)
    if artifact is not None and store.fresh(artifact, ttl_hours=ttl_hours):
        return artifact

    if not (prophet_enabled and prophet_engine.PROPHET_AVAILABLE):
        return None

    lock = _locks.setdefault(outlet_id, asyncio.Lock())
    if lock.locked():
        # Training berjalan — model basi lebih baik daripada menunggu.
        return artifact

    async with lock, _serial:
        # Cek ulang: request paralel mungkin baru saja selesai.
        artifact = store.load(outlet_id)
        if artifact is not None and store.fresh(artifact, ttl_hours=ttl_hours):
            return artifact

        trained = await asyncio.to_thread(
            train_from_series,
            series,
            prophet_engine.fit_model,
            prophet_engine.predict_with_bands,
        )
        if trained is None:
            return None

        trained["outlet_id"] = outlet_id
        try:
            store.save(outlet_id, trained)
        except Exception as exc:  # pragma: no cover — store sudah fail-safe
            logger.warning("gagal menyimpan model %s: %r", outlet_id, exc)
        return trained
