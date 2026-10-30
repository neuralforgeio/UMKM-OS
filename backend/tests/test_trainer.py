"""Unit tests trainer — inti murni, Prophet disuntik sebagai stub.

TIDAK menyentuh DB / FastAPI / file / jaringan. Stub prophet mengikuti
kontrak injeksi (fit(series) -> model, predict(model, dates) ->
[(point, low, high)]) sehingga test bebas dari ketersediaan paket
prophet asli: jalur statistical diuji tanpa prophet, jalur prophet
diuji dengan stub yang bisa diprogram menang/kalah/crash sesuai skenario.
"""

from datetime import date, timedelta

import pytest

from app.ml.trainer import (
    MIN_DAYS,
    MIN_NONZERO,
    TEST_MAX,
    TEST_MIN,
    WIN_MARGIN_PP,
    run_backtest,
    split_sizes,
    train_from_series,
)

MON = date(2026, 9, 7)  # Senin sungguhan


def _series(count: int, value_fn) -> list[tuple[date, float]]:
    """Deret harian gap-free mulai Senin; value_fn(index) -> nilai."""
    return [(MON + timedelta(days=i), float(value_fn(i))) for i in range(count)]


def _konstan_per_hari_minggu(count: int) -> list[tuple[date, float]]:
    """Pola konstan per hari-minggu — makanan favorit engine statistical."""

    def nilai(i: int) -> float:
        return [100.0, 200.0, 150.0, 120.0, 180.0, 400.0, 350.0][i % 7]

    return _series(count, nilai)


# ----------------------------------------------------------------------
# Stub engine "prophet" yang dapat diprogram
# ----------------------------------------------------------------------


class StubModel:
    def __init__(self, mode: str, seen: dict[date, float], oracle: dict[date, float]):
        self.mode = mode
        self.seen = seen  # data yang diterima fit() (train, atau penuh saat refit)
        self.oracle = oracle  # pengetahuan penuh deret — milik test, bukan model


def _pasangkat_stub(mode: str, fail_on_call: int = 0, oracle=None):
    """Pasangan (fit, predict) yang memprediksi 'sempurna' / 'awam'.

    `sempurna` memerlukan `oracle` = peta {tanggal: nilai} deret PENUH:
    fit() hanya menerima data train, tetapi prediksi masa uji butuh
    pengetahuan masa depan — itulah cara membuat MAPE 0 tanpa model
    sungguhan. `awam` selalu menebak 0 (MAPE 100%). `fail_on_call`
    membuat fit ke-N melempar — dipakai menguji jalur gagal-lembut.
    """
    calls = {"n": 0}

    def fit(series):
        calls["n"] += 1
        if fail_on_call and calls["n"] >= fail_on_call:
            raise RuntimeError("stub fit sengaja gagal")
        seen = {day: value for day, value in series}
        return StubModel(mode, seen, oracle if oracle is not None else seen)

    def predict(model: StubModel, dates):
        if model.mode == "sempurna":
            return [(model.oracle.get(d, 0.0), 0.0, 0.0) for d in dates]
        return [(0.0, 0.0, 0.0) for d in dates]

    return fit, predict


# ----------------------------------------------------------------------
# Gerbang data & split
# ----------------------------------------------------------------------


def test_gerbang_gagal_deret_terlalu_pendek():
    assert run_backtest(_konstan_per_hari_minggu(20)) is None


def test_gerbang_gagal_hari_berpendapatan_terlalu_jarang():
    deret = _series(70, lambda i: 100.0 if i % 6 == 0 else 0.0)  # 12 nonzero
    assert run_backtest(deret) is None


def test_gerbang_progresif_deret_satu_bulan_lolos():
    """v3.2.0: 30 hari penuh ber-pendapatan kini LULUS gerbang (28/14)."""
    assert run_backtest(_konstan_per_hari_minggu(30)) is not None


def test_konstanta_aturan_disetujui():
    assert MIN_DAYS == 28
    assert MIN_NONZERO == 14
    assert TEST_MIN == 7
    assert TEST_MAX == 45
    assert WIN_MARGIN_PP == 2.0


def test_split_ukuran():
    assert split_sizes(28) == (21, 7)    # deret pendek: lantai 7 hari uji
    assert split_sizes(30) == (22, 8)
    assert split_sizes(56) == (42, 14)   # minimum test era 56-hari
    assert split_sizes(60) == (45, 15)   # 25% bulat
    assert split_sizes(100) == (75, 25)
    assert split_sizes(200) == (155, 45)   # jepit maksimum
    assert split_sizes(1000) == (955, 45)  # tetap dijepit


# ----------------------------------------------------------------------
# Duel
# ----------------------------------------------------------------------


def test_statistical_menang_bila_prophet_awam():
    deret = _konstan_per_hari_minggu(84)
    fit, predict = _pasangkat_stub("awam")
    duel = run_backtest(deret, fit, predict)
    assert duel is not None
    assert duel["winner"] == "statistical"
    assert duel["mape_statistical"] == pytest.approx(0.0)  # pola konstan
    assert duel["mape_prophet"] == pytest.approx(100.0)    # stub menebak 0


def test_prophet_menang_bila_jauh_lebih_akurat():
    # Tren naik harian — rata-rata weekday selalu tertinggal jauh.
    deret = _series(84, lambda i: 100.0 + 5.0 * i)
    oracle = {day: value for day, value in deret}
    fit, predict = _pasangkat_stub("sempurna", oracle=oracle)
    duel = run_backtest(deret, fit, predict)
    assert duel is not None
    assert duel["mape_prophet"] == pytest.approx(0.0)
    assert duel["mape_statistical"] > WIN_MARGIN_PP
    assert duel["winner"] == "prophet"


def test_margin_dua_poin_prophet_tidak_menang():
    # Prophet hanya sedikit lebih baik (selisih < 2pp) -> statistical
    # menang: kesederhanaan duluan.
    deret = _konstan_per_hari_minggu(84)
    oracle = {day: value for day, value in deret}

    def fit(series):
        return StubModel("sedikit", dict(series), oracle)

    def predict(model, dates):
        # Prediksi menyimpang 7% -> MAPE 7, statistical 0 -> margin -7
        return [(model.oracle.get(d, 0.0) * 0.93, 0.0, 0.0) for d in dates]

    duel = run_backtest(deret, fit, predict)
    assert duel["winner"] == "statistical"
    assert duel["margin_pp"] is not None and duel["margin_pp"] < WIN_MARGIN_PP


def test_prophet_crash_saat_backtest_ditoleransi():
    deret = _konstan_per_hari_minggu(84)
    fit, predict = _pasangkat_stub("sempurna", fail_on_call=1)
    duel = run_backtest(deret, fit, predict)
    assert duel is not None
    assert duel["mape_prophet"] is None
    assert duel["winner"] == "statistical"


def test_tanpa_prophet_duel_tetap_jalan():
    deret = _konstan_per_hari_minggu(84)
    duel = run_backtest(deret, None, None)
    assert duel is not None
    assert duel["winner"] == "statistical"
    assert duel["mape_prophet"] is None


# ----------------------------------------------------------------------
# Artefak train_from_series
# ----------------------------------------------------------------------


def test_artefak_pemenang_statistical_tanpa_objek_model():
    deret = _konstan_per_hari_minggu(84)
    fit, predict = _pasangkat_stub("awam")
    artefak = train_from_series(deret, fit, predict)
    assert artefak is not None
    assert artefak["winner"] == "statistical"
    assert artefak["model"] is None
    assert artefak["trained_through"] == str(deret[-1][0])
    assert artefak["backtest_days"] == 21  # 84 -> 25% = 21
    assert artefak["train_days"] == 63
    assert artefak["outlet_id"] is None


def test_artefak_pemenang_prophet_menyimpan_model_refit_penuh():
    deret = _series(84, lambda i: 100.0 + 5.0 * i)
    oracle = {day: value for day, value in deret}
    fit, predict = _pasangkat_stub("sempurna", oracle=oracle)
    artefak = train_from_series(deret, fit, predict)
    assert artefak["winner"] == "prophet"
    # Refit final = fit KEDUA (backtest atas train, lalu seluruh data).
    assert isinstance(artefak["model"], StubModel)
    assert len(artefak["model"].seen) == 84  # seluruh deret


def test_refit_gagal_menurunkan_pemenang_ke_statistical():
    deret = _series(84, lambda i: 100.0 + 5.0 * i)
    oracle = {day: value for day, value in deret}
    # Backtest (fit #1) sukses, refit final (fit #2) melempar.
    fit, predict = _pasangkat_stub("sempurna", fail_on_call=2, oracle=oracle)
    artefak = train_from_series(deret, fit, predict)
    assert artefak["winner"] == "statistical"
    assert artefak["model"] is None


def test_gerbang_gagal_tidak_menghasilkan_artefak():
    assert train_from_series(_konstan_per_hari_minggu(20)) is None


def test_artefak_trained_at_terurai_sebagai_iso_utc():
    from datetime import datetime

    deret = _konstan_per_hari_minggu(84)
    artefak = train_from_series(deret)
    parsed = datetime.fromisoformat(artefak["trained_at"])
    assert parsed.tzinfo is not None
