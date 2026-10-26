"""Unit tests ModelStore — joblib + TTL (butuh joblib; skip bila absen)."""

from datetime import datetime, timedelta, timezone

import pytest

pytest.importorskip("joblib")

from app.ml.store import ModelStore, TTL_HOURS  # noqa: E402


def _artefak(menang="prophet", usia_jam=0.0) -> dict:
    return {
        "outlet_id": "1",
        "trained_at": (
            datetime.now(timezone.utc) - timedelta(hours=usia_jam)
        ).isoformat(),
        "trained_through": "2026-10-25",
        "winner": menang,
        "mape_prophet": 8.0,
        "mape_statistical": 12.0,
        "backtest_days": 21,
        "train_days": 63,
        "model": {"tiruan": True},
    }


def test_simpan_muat_roundtrip(tmp_path):
    store = ModelStore(tmp_path)
    store.save("1", _artefak())
    muat = store.load("1")
    assert muat is not None
    assert muat["winner"] == "prophet"
    assert muat["mape_prophet"] == 8.0
    assert muat["model"] == {"tiruan": True}


def test_muat_outlet_tak_dikenal_none(tmp_path):
    assert ModelStore(tmp_path).load("99") is None


def test_file_korup_dianggap_tidak_ada(tmp_path):
    store = ModelStore(tmp_path)
    store.save("1", _artefak())
    store.path_for("1").write_bytes(b"BUKAN-JOBLIB")
    assert store.load("1") is None


def test_segarkan_baru_disimpan(tmp_path):
    store = ModelStore(tmp_path)
    store.save("1", _artefak(usia_jam=0.1))
    assert store.fresh(store.load("1")) is True


def test_basi_setelah_ttl(tmp_path):
    store = ModelStore(tmp_path)
    store.save("1", _artefak(usia_jam=TTL_HOURS + 1))
    assert store.fresh(store.load("1")) is False


def test_umur_jam_bertambah(tmp_path):
    store = ModelStore(tmp_path)
    store.save("1", _artefak(usia_jam=3.0))
    umur = store.age_hours(store.load("1"))
    assert umur is not None and 2.9 <= umur <= 3.2


def test_trained_at_rusak_tidak_segarkan(tmp_path):
    store = ModelStore(tmp_path)
    buruk = _artefak()
    buruk["trained_at"] = "bukan-iso"
    assert store.fresh(buruk) is False
    assert store.age_hours(buruk) is None


def test_nama_file_disterilkan(tmp_path):
    store = ModelStore(tmp_path)
    path = store.path_for("../../etc/passwd")
    # Karakter path separator dibuang — nama tetap di dalam direktori.
    assert path.parent == store.dir
    assert ".." not in path.name
