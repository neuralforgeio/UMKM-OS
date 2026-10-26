"""Pembungkus Prophet — import guard + konfigurasi + prediksi ber-pita.

Prophet adalah dependency BERAT (wheel memuat binary Stan ~ratusan MB)
dan kompatibilitasnya dengan versi pandas/numpy terbaru tidak pernah
dijamin. Karena itu seluruh modul ini dirancang gagal-lembut:

  - PROPHET_AVAILABLE=False bila `import prophet` (atau pandas) melempar
    apa pun — layanan FastAPI TETAP hidup dan jalur statistical tetap
    jalan penuh; statusnya jujur dilaporkan GET /forecast/models.
  - Setiap pemanggilan fit/predict dibungkus try/except oleh pemanggil
    (trainer/router) — kegagalan runtime satu outlet tidak pernah
    menjatuhkan endpoint.

Proteksi mesin kecil (Axioo Pongo 735, 8GB RAM):
  - OMP_NUM_THREADS=2 disetel docker-compose (env harus ada SEBELUM
    numpy termuat — tidak bisa diubah runtime); modul ini hanya
    membisukan log cmdstanpy yang sangat berisik.
  - Antrean serial global training ada di trainer.py.

Konfigurasi model untuk skala warung:
  - weekly_seasonality=True  — pola hari-minggu adalah sinyal utama.
  - daily_seasonality=False  — data harian, tidak ada sub-harian.
  - yearly_seasonality=False — jendela data maksimum 180 hari.
  - interval_width=0.8       — pita 80%, sama dengan z80 statistik agar
                               duel MAPE dan tampilan rentang apple-to-apple.
  - holidays Indonesia       — Lebaran/minggu panjang menggerakkan warung.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import date
from typing import Any

try:  # import guard — kegagalan APA PUN berarti jalur statistical
    import pandas as _pd
    from prophet import Prophet as _Prophet

    PROPHET_AVAILABLE = True
    PROPHET_IMPORT_ERROR: str | None = None
except Exception as exc:  # ImportError, binary ABI, dll.
    _pd = None
    _Prophet = None
    PROPHET_AVAILABLE = False
    PROPHET_IMPORT_ERROR = f"{type(exc).__name__}: {exc}"


def _quiet_stan_logs() -> None:
    """Bisukan log cmdstanpy (INFO per iterasi) agar log container bersih."""
    logging.getLogger("cmdstanpy").setLevel(logging.WARNING)


def make_model() -> Any:
    """Instance Prophet terkonfigurasi (lihat docstring modul)."""
    _quiet_stan_logs()
    model = _Prophet(
        weekly_seasonality=True,
        daily_seasonality=False,
        yearly_seasonality=False,
        interval_width=0.8,
    )
    model.add_country_holidays(country_name="ID")
    return model


def fit_model(series: Sequence[tuple[date, float]]) -> Any:
    """Latih Prophet atas deret harian (date, value); kembalikan model terfit."""
    frame = _pd.DataFrame(
        {
            "ds": _pd.to_datetime([day for day, _ in series]),
            "y": [float(value) for _, value in series],
        }
    )
    model = make_model()
    model.fit(frame)
    return model


def predict_with_bands(
    model: Any,
    dates: Sequence[date],
) -> list[tuple[float, float, float]]:
    """Prediksi ber-pita: [(point, low, high)] per tanggal.

    low dijepit >= 0 (pendapatan negatif tidak ada); high dijepit >=
    point agar pita tidak terbalik saat ketidakpastian menyusut.
    """
    future = _pd.DataFrame({"ds": _pd.to_datetime(list(dates))})
    forecast = model.predict(future)
    bands: list[tuple[float, float, float]] = []
    for yhat, low, high in zip(
        forecast["yhat"], forecast["yhat_lower"], forecast["yhat_upper"]
    ):
        point = max(0.0, float(yhat))
        bands.append((point, max(0.0, float(low)), max(point, float(high))))
    return bands


def prophet_status() -> dict[str, Any]:
    """Status import untuk GET /forecast/models (jujur, tanpa mencoba fit)."""
    return {
        "available": PROPHET_AVAILABLE,
        "import_error": PROPHET_IMPORT_ERROR,
    }
