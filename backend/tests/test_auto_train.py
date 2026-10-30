"""Test auto-train latar belakang (v3.2.0) — murni, tanpa database.

Yang diuji: keputusan skip (Prophet mati), siklus loop menghormati
sinyal stop, dan gerbang via trainer.gate_status dipakai putaran.
Jalur ber-DB (fetch_series, ensure_model nyata) tercakup pytest DALAM
container + smoke test pemilik.
"""

from __future__ import annotations

import asyncio
from datetime import date, timedelta

import pytest

from app.core.config import settings
from app.ml import auto_train, trainer


def _deret(n: int, nilai) -> list[tuple[date, float]]:
    awal = date(2026, 9, 7)
    return [(awal + timedelta(days=i), float(nilai(i))) for i in range(n)]


# ----------------------------------------------------------------------
# gate_status (jembatan kejujuran v3.2.0)
# ----------------------------------------------------------------------
def test_gate_status_ok() -> None:
    gate = trainer.gate_status(_deret(30, lambda i: 100.0))
    assert gate["ok"] is True
    assert gate["days"] == 30
    assert gate["nonzero"] == 30
    assert gate["min_days"] == 28
    assert gate["min_nonzero"] == 14


def test_gate_status_hari_kurang() -> None:
    gate = trainer.gate_status(_deret(20, lambda i: 100.0))
    assert gate["ok"] is False
    assert gate["days"] == 20


def test_gate_status_pendapatan_kurang() -> None:
    deret = _deret(60, lambda i: 100.0 if i % 6 == 0 else 0.0)  # 10 nonzero
    gate = trainer.gate_status(deret)
    assert gate["ok"] is False
    assert gate["nonzero"] == 10


def test_gate_status_batas_14_nonzero_lolos() -> None:
    deret = _deret(28, lambda i: 100.0 if i % 2 == 0 else 0.0)  # tepat 14
    gate = trainer.gate_status(deret)
    assert gate["nonzero"] == 14
    assert gate["days"] == 28
    assert gate["ok"] is True


# ----------------------------------------------------------------------
# train_all_outlets: keputusan skip tanpa menyentuh DB
# ----------------------------------------------------------------------
def test_putaran_skip_saat_prophet_dimatikan(monkeypatch) -> None:
    monkeypatch.setattr(settings, "PROPHET_ENABLED", False)
    hasil = asyncio.run(auto_train.train_all_outlets())
    assert hasil["status"] == "skip"
    assert hasil["trained"] == []
    assert hasil["skipped"] == []


def test_putaran_skip_saat_prophet_tidak_terpasang(monkeypatch) -> None:
    monkeypatch.setattr(settings, "PROPHET_ENABLED", True)
    monkeypatch.setattr(auto_train.prophet_engine, "PROPHET_AVAILABLE", False)
    hasil = asyncio.run(auto_train.train_all_outlets())
    assert hasil["status"] == "skip"


# ----------------------------------------------------------------------
# Loop menghormati sinyal stop (tidak menggantung shutdown)
# ----------------------------------------------------------------------
def test_loop_berhenti_saat_stop_dibangunkan(monkeypatch) -> None:
    panggilan = {"n": 0}

    async def _putaran_palsu(store=None):
        panggilan["n"] += 1
        return {"status": "ok", "trained": [], "skipped": []}

    monkeypatch.setattr(settings, "ML_AUTO_TRAIN_START_DELAY_S", 0)
    monkeypatch.setattr(settings, "ML_AUTO_TRAIN_INTERVAL_HOURS", 6)
    monkeypatch.setattr(auto_train, "train_all_outlets", _putaran_palsu)

    async def _jalankan() -> None:
        stop = asyncio.Event()
        tugas = asyncio.create_task(auto_train.auto_train_loop(stop))
        await asyncio.sleep(0.05)  # satu putaran pasti selesai
        stop.set()
        await asyncio.wait_for(tugas, timeout=2)

    asyncio.run(_jalankan())
    assert panggilan["n"] >= 1


def test_loop_putaran_gagal_tidak_membunuh_loop(monkeypatch) -> None:
    panggilan = {"n": 0}

    async def _putaran_melempar(store=None):
        panggilan["n"] += 1
        if panggilan["n"] == 1:
            raise RuntimeError("sengaja gagal")
        return {"status": "ok", "trained": [], "skipped": []}

    monkeypatch.setattr(settings, "ML_AUTO_TRAIN_START_DELAY_S", 0)
    monkeypatch.setattr(auto_train, "_interval_timeout", lambda: 0.02)
    monkeypatch.setattr(auto_train, "train_all_outlets", _putaran_melempar)

    async def _jalankan() -> None:
        stop = asyncio.Event()
        tugas = asyncio.create_task(auto_train.auto_train_loop(stop))
        await asyncio.sleep(0.08)
        stop.set()
        await asyncio.wait_for(tugas, timeout=2)

    asyncio.run(_jalankan())
    assert panggilan["n"] >= 2  # gagal sekali, tetap hidup
