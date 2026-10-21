"""Forecasting service — pure math, zero database access.

Architecture contract (blueprint ch. 8): FastAPI is a read-only ML
service on top of a database owned by Prisma. This module never opens
a DB session — the routers feed it plain (date, value) rows and get
plain results back, which keeps the math unit-testable without
PostgreSQL (see tests/test_forecast.py).

Public API (consumed by app/api/routes/forecast.py):
  - zero_fill_daily(rows, start, end)  -> gap-free daily series
  - weekday_forecast(series, horizon)  -> list of point dicts
  - sum_forecast(points)               -> (point, low, high) totals

Method — "weekday-seasonal weighted average": every future day is
estimated from the same weekday's MAX_WEEK_SAMPLES most recent
observations, linearly weighted so the newest week counts the most.
Warung revenue is dominated by day-of-week patterns (weekend rush,
quiet midweek), so a same-weekday average beats a generic trend model
at this data scale.

Cascade rules inside weekday_forecast:
  - calendar days before the first non-zero observation are trimmed:
    they predate the first recorded sale and are not real zeros;
  - a weekday with no observed sample falls back to the overall mean;
  - an all-zero history simply forecasts zeros.

Intervals: symmetric 80% band (z = 1.2816) around the point, using the
weighted spread of the samples (the overall spread on fallback). Lows
are clamped at zero — negative revenue is not a thing.

Money contract: inputs may be Decimal / int / float (SQLAlchemy Numeric
columns arrive as Decimal); the module computes with Python floats and
the router rounds at the HTTP boundary. The frontend renders every
amount through formatRupiah(), the single site-wide money formatter.
"""

from __future__ import annotations

import math
from collections.abc import Iterable, Sequence
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

# 80% two-sided z-value for prediction intervals.
_Z80 = 1.2816

# Same-weekday observations blended per forecast day (4 = last 4 weeks).
MAX_WEEK_SAMPLES = 4

_WEEKDAY_NAMES = (
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
)


def _as_date(value: date | datetime) -> date:
    # func.date() rows are already date objects; stay tolerant anyway.
    return value.date() if isinstance(value, datetime) else value


def _weighted_mean_and_spread(
    values: Sequence[float], weights: Sequence[float]
) -> tuple[float, float]:
    """Weighted mean plus population weighted standard deviation."""
    total_weight = sum(weights)
    mean = sum(v * w for v, w in zip(values, weights)) / total_weight
    variance = sum(w * (v - mean) ** 2 for v, w in zip(values, weights)) / total_weight
    return mean, math.sqrt(variance)


def _population_spread(values: Sequence[float]) -> float:
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    return math.sqrt(sum((v - mean) ** 2 for v in values) / len(values))


def zero_fill_daily(
    rows: Iterable[tuple[date | datetime, int | float | Decimal]],
    start: date,
    end: date,
) -> list[tuple[date, float]]:
    """Normalise sparse (date, value) rows into a gap-free daily series.

    Duplicate dates are summed and rows outside [start, end] are
    dropped. Every calendar day in the window — including days with no
    recorded value — appears exactly once: a missing day is a day with
    zero revenue, not a day that never existed. An inverted window
    (start > end) yields an empty list.
    """
    buckets: dict[date, float] = {}
    for raw_day, value in rows:
        day = _as_date(raw_day)
        if day < start or day > end:
            continue
        buckets[day] = buckets.get(day, 0.0) + float(value)

    series: list[tuple[date, float]] = []
    day = start
    while day <= end:
        series.append((day, buckets.get(day, 0.0)))
        day += timedelta(days=1)
    return series


def weekday_forecast(
    series: Sequence[tuple[date | datetime, int | float | Decimal]],
    horizon: int,
) -> list[dict[str, Any]]:
    """Forecast the next `horizon` days from a daily series.

    `series` holds at most one (date, value) pair per calendar day —
    zero_fill_daily produces exactly this shape. Returns a list of
    dicts shaped for schemas.forecast.ForecastPoint:
    {"date", "weekday", "point", "low", "high"}.

    Raises ValueError when horizon is not a positive integer.
    """
    if horizon <= 0:
        raise ValueError("horizon must be a positive number of days")

    pairs = sorted(
        ((_as_date(day), float(value)) for day, value in series),
        key=lambda pair: pair[0],
    )
    if not pairs:
        return []

    # History begins at the first recorded sale: leading zero days
    # predate the warung's opening and would drag every estimate down.
    first_sale = next((i for i, (_, v) in enumerate(pairs) if v != 0.0), None)
    if first_sale is not None and first_sale > 0:
        pairs = pairs[first_sale:]

    by_weekday: dict[int, list[float]] = {w: [] for w in range(7)}
    for day, value in pairs:
        by_weekday[day.weekday()].append(value)

    values = [value for _, value in pairs]
    overall_mean = sum(values) / len(values)
    overall_spread = _population_spread(values)

    last_day = pairs[-1][0]
    forecast: list[dict[str, Any]] = []
    for step in range(1, horizon + 1):
        future = last_day + timedelta(days=step)
        weekday = future.weekday()
        samples = by_weekday[weekday][-MAX_WEEK_SAMPLES:]
        if samples:
            # Linear weights: oldest sample weighs 1, newest weighs k.
            weights = range(1, len(samples) + 1)
            point, spread = _weighted_mean_and_spread(samples, weights)
        else:
            point, spread = overall_mean, overall_spread
        point = max(point, 0.0)
        low = max(point - _Z80 * spread, 0.0)
        high = point + _Z80 * spread
        forecast.append(
            {
                "date": future,
                "weekday": _WEEKDAY_NAMES[weekday],
                "point": point,
                "low": low,
                "high": high,
            }
        )
    return forecast


def sum_forecast(points: Iterable[dict[str, Any]]) -> tuple[float, float, float]:
    """Aggregate forecast points into (point, low, high) period totals.

    Summing the per-day lows (resp. highs) yields a conservative
    worst-case band for the whole period — per-day errors may cancel,
    so the true total is expected to land inside a narrower range.
    """
    point = sum((p["point"] for p in points), 0.0)
    low = sum((p["low"] for p in points), 0.0)
    high = sum((p["high"] for p in points), 0.0)
    return point, low, high
