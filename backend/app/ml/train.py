"""CLI pelatihan manual — tanpa menunggu request pertama.

    python -m app.ml.train --outlet 1     # latih satu outlet
    python -m app.ml.train --all          # latih semua outlet aktif

Berguna untuk warm-up pasca-deploy, demo portfolio, atau melatih ulang
setelah import data lama. Modul ini memakai jalur yang SAMA PERSIS
dengan training lazy dari request (app.ml.trainer.ensure_model), jadi
hasil CLI dan hasil otomatis selalu identik — tidak ada logika kedua
yang bisa saling bertentangan.

Exit code 0 bahkan ketika gerbang data gagal (itu kondisi normal untuk
outlet baru: tidak ada cukup riwayat) — kegagalan sesungguhnya (DB,
settings) tetap exit 1 agar bisa dipakai skrip.
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import date, timedelta

from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import session_factory
from app.ml import prophet_engine, trainer
from app.ml.store import ModelStore
from app.models import Outlet, Transaction
from app.services.forecast import zero_fill_daily


async def _series_for_outlet(outlet_id: int) -> list[tuple[date, float]]:
    """Deret pendapatan harian outlet (jendela trainer, berakhir kemarin)."""
    today = date.today()
    yesterday = today - timedelta(days=1)
    start = today - timedelta(days=trainer.MODEL_WINDOW_DAYS - 1)
    async with session_factory() as session:
        rows = (
            await session.execute(
                select(
                    func.date(Transaction.created_at).label("d"),
                    func.sum(Transaction.total).label("revenue"),
                )
                .where(
                    Transaction.status == "COMPLETED",
                    Transaction.created_at >= start,
                    Transaction.outlet_id == outlet_id,
                )
                .group_by(func.date(Transaction.created_at))
                .order_by(func.date(Transaction.created_at))
            )
        ).all()
    return zero_fill_daily([(r.d, r.revenue or 0) for r in rows], start, yesterday)


async def _train_one(outlet_id: int, store: ModelStore) -> None:
    series = await _series_for_outlet(outlet_id)
    artifact = await trainer.ensure_model(
        str(outlet_id), series, store, prophet_enabled=settings.PROPHET_ENABLED
    )
    if artifact is None:
        days = len(series)
        nonzero = sum(1 for _, v in series if v > 0)
        print(
            f"  outlet {outlet_id}: GERBANG GAGAL — {days} hari "
            f"({nonzero} ber-pendapatan; butuh >= {trainer.MIN_DAYS} hari "
            f"dan >= {trainer.MIN_NONZERO} ber-pendapatan). "
            "Ramalan tetap jalan via jalur statistical in-line."
        )
        return
    mape_p = artifact["mape_prophet"]
    mape_s = artifact["mape_statistical"]
    print(
        f"  outlet {outlet_id}: pemenang={artifact['winner']}  "
        f"MAPE prophet={mape_p if mape_p is None else round(mape_p, 2)}%  "
        f"MAPE statistik={mape_s if mape_s is None else round(mape_s, 2)}%  "
        f"({artifact['backtest_days']} hari uji)  "
        f"tersimpan: {store.path_for(str(outlet_id)).name}"
    )


async def _run(args: argparse.Namespace) -> int:
    store = ModelStore(settings.ML_MODEL_DIR)
    status = prophet_engine.prophet_status()
    if not status["available"]:
        print(f"Prophet tidak tersedia ({status['import_error']})")
        print("Training dilewati — jalur statistical tidak butuh model.")
        return 0
    if not settings.PROPHET_ENABLED:
        print("PROPHET_ENABLED=false — tidak ada yang dilatih.")
        return 0

    if args.outlet is not None:
        print(f"Melatih outlet {args.outlet} ...")
        await _train_one(args.outlet, store)
        return 0

    async with session_factory() as session:
        outlets = (
            await session.execute(
                select(Outlet)
                .where(Outlet.is_active.is_(True))
                .order_by(Outlet.created_at, Outlet.id)
            )
        ).scalars().all()
    if not outlets:
        print("Tidak ada outlet aktif.")
        return 0
    print(f"Melatih {len(outlets)} outlet aktif ...")
    for outlet in outlets:
        await _train_one(outlet.id, store)
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Latih model ramalan per outlet (duel backtest MAPE)."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--outlet", type=int, help="id outlet (angka)")
    group.add_argument("--all", action="store_true", help="semua outlet aktif")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(_run(args)))


if __name__ == "__main__":
    main()
