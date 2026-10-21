"""Unit tests for the forecasting service.

The module under test is pure math — no PostgreSQL, no FastAPI app,
no fixtures. Run from backend/ with the venv active:

    pytest -q
"""

from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest

from app.services.forecast import sum_forecast, weekday_forecast, zero_fill_daily

# A real Monday — keeps weekday math below easy to verify by hand.
MON = date(2026, 9, 7)

WEEKDAY_NAMES = (
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
)


def _days(start: date, count: int) -> list[date]:
    return [start + timedelta(days=i) for i in range(count)]


# ----------------------------------------------------------------------
# zero_fill_daily
# ----------------------------------------------------------------------


def test_zero_fill_fills_every_day_in_window():
    start = date(2026, 9, 1)
    rows = [(start, Decimal("100.50")), (start + timedelta(days=2), 200)]
    series = zero_fill_daily(rows, start, start + timedelta(days=3))
    assert series == [
        (start, 100.5),
        (start + timedelta(days=1), 0.0),
        (start + timedelta(days=2), 200.0),
        (start + timedelta(days=3), 0.0),
    ]


def test_zero_fill_sums_duplicate_dates_and_converts_decimal():
    day = date(2026, 9, 1)
    series = zero_fill_daily(
        [(day, Decimal("12.25")), (day, Decimal("0.75")), (day, 7)],
        day,
        day,
    )
    assert series == [(day, 20.0)]


def test_zero_fill_drops_rows_outside_window():
    start = date(2026, 9, 2)
    end = date(2026, 9, 3)
    rows = [
        (date(2026, 9, 1), 999.0),  # before the window
        (start, 10.0),
        (end, 20.0),
        (date(2026, 9, 4), 999.0),  # after the window
    ]
    assert zero_fill_daily(rows, start, end) == [(start, 10.0), (end, 20.0)]


def test_zero_fill_inverted_window_returns_empty():
    assert zero_fill_daily([], date(2026, 9, 5), date(2026, 9, 1)) == []


def test_zero_fill_accepts_datetimes():
    day = date(2026, 9, 1)
    rows = [(datetime(2026, 9, 1, 10, 30), 25.0)]
    assert zero_fill_daily(rows, day, day) == [(day, 25.0)]


# ----------------------------------------------------------------------
# weekday_forecast
# ----------------------------------------------------------------------


def test_weekday_forecast_reproduces_perfect_weekly_pattern():
    # Mon=1000, Tue=2000, ... Sun=7000, over four full weeks: every
    # same-weekday sample is identical, so the forecast must be exact.
    start = MON
    rows = [(day, 1000 * (day.weekday() + 1)) for day in _days(start, 28)]
    forecast = weekday_forecast(rows, 14)

    assert len(forecast) == 14
    last_day = start + timedelta(days=27)
    for step, point in enumerate(forecast, start=1):
        future = last_day + timedelta(days=step)
        expected = 1000 * (future.weekday() + 1)
        assert point["date"] == future
        assert point["weekday"] == WEEKDAY_NAMES[future.weekday()]
        assert point["point"] == pytest.approx(expected)
        assert point["low"] == pytest.approx(expected)
        assert point["high"] == pytest.approx(expected)


def test_weekday_forecast_weights_recent_weeks_more_heavily():
    # Four flat weeks: 10, 20, 30, 40. Linear weights 1:2:3:4 give
    # (1*10 + 2*20 + 3*30 + 4*40) / 10 = 30 — a flat mean would say 25.
    start = MON
    rows = [(day, 10 * (i // 7 + 1)) for i, day in enumerate(_days(start, 28))]
    for point in weekday_forecast(rows, 7):
        assert point["point"] == pytest.approx(30.0)


def test_only_the_most_recent_four_weeks_count():
    # Six flat weeks: 10, 20, 30, 40, 50, 60. Only the last four weeks
    # (30, 40, 50, 60) are blended -> (30+80+150+240)/10 = 50.
    start = MON
    rows = [(day, 10 * (i // 7 + 1)) for i, day in enumerate(_days(start, 42))]
    for point in weekday_forecast(rows, 7):
        assert point["point"] == pytest.approx(50.0)


def test_weekday_forecast_falls_back_for_unseen_weekdays():
    # Only Mon/Tue/Wed ever observed: 100, 200, 300 (mean 200). Steps
    # 1..7 from Wednesday: Thu Fri Sat Sun Mon Tue Wed.
    rows = [
        (MON, 100.0),
        (MON + timedelta(days=1), 200.0),
        (MON + timedelta(days=2), 300.0),
    ]
    forecast = weekday_forecast(rows, 7)
    expected_points = [200.0, 200.0, 200.0, 200.0, 100.0, 200.0, 300.0]
    assert [p["point"] for p in forecast] == pytest.approx(expected_points)
    for point in forecast:
        assert 0 <= point["low"] <= point["point"] <= point["high"]
    # Unseen weekdays borrow the overall spread -> non-zero interval.
    assert forecast[0]["low"] < forecast[0]["point"] < forecast[0]["high"]


def test_weekday_forecast_trims_leading_zero_days():
    # Ten zero days prepended must not change anything: they predate
    # the first recorded sale and are not real zero-revenue days.
    real = [
        (MON + timedelta(days=10), 100.0),
        (MON + timedelta(days=11), 200.0),
        (MON + timedelta(days=12), 300.0),
    ]
    padded = [(day, 0.0) for day in _days(MON, 10)] + real
    assert weekday_forecast(padded, 5) == weekday_forecast(real, 5)


def test_weekday_forecast_all_zero_history_forecasts_zero():
    rows = [(day, 0) for day in _days(MON, 14)]
    for point in weekday_forecast(rows, 5):
        assert point["point"] == 0.0
        assert point["low"] == 0.0
        assert point["high"] == 0.0


def test_forecast_invariants_on_jittery_history():
    # Deterministic pseudo-noisy series with zero-sale days mixed in.
    values = [(i * i * 7919) % 500_000 for i in range(30)]
    rows = list(zip(_days(MON, 30), values))
    forecast = weekday_forecast(rows, 7)
    previous_date = MON + timedelta(days=29)
    for point in forecast:
        assert point["date"] > previous_date
        previous_date = point["date"]
        assert 0.0 <= point["low"] <= point["point"] <= point["high"]


def test_forecast_points_carry_schema_keys():
    # The route unpacks each dict straight into ForecastPoint(**point).
    rows = [(day, 100.0) for day in _days(MON, 14)]
    point = weekday_forecast(rows, 1)[0]
    assert set(point) == {"date", "weekday", "point", "low", "high"}


def test_horizon_must_be_positive():
    rows = [(day, 100.0) for day in _days(MON, 10)]
    with pytest.raises(ValueError):
        weekday_forecast(rows, 0)
    with pytest.raises(ValueError):
        weekday_forecast(rows, -3)


# ----------------------------------------------------------------------
# sum_forecast
# ----------------------------------------------------------------------


def test_sum_forecast_aggregates_points():
    points = [
        {"date": MON, "weekday": "Monday", "point": 100.0, "low": 50.0, "high": 150.0},
        {"date": MON + timedelta(days=1), "weekday": "Tuesday", "point": 200.0, "low": 100.0, "high": 300.0},
        {"date": MON + timedelta(days=2), "weekday": "Wednesday", "point": 50.0, "low": 0.0, "high": 75.0},
    ]
    assert sum_forecast(points) == (350.0, 150.0, 525.0)


def test_sum_forecast_empty_returns_zeros():
    assert sum_forecast([]) == (0.0, 0.0, 0.0)


def test_same_input_same_output():
    rows = [(day, 50_000.0 + (i % 7) * 10_000.0) for i, day in enumerate(_days(MON, 30))]
    assert weekday_forecast(rows, 7) == weekday_forecast(rows, 7)
