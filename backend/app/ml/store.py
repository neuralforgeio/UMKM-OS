"""Penyimpanan artefak model per outlet — joblib + atomic replace.

Artefak (dict) berisi:
  outlet_id, trained_at (ISO UTC), trained_through (tanggal data
  terakhir), winner ("prophet"|"statistical"), mape_prophet,
  mape_statistical, margin_pp, backtest_days, train_days, min_margin_pp,
  dan "model" (objek Prophet terfit — HANYA bila winner == "prophet";
  statistical tidak menyimpan objek apa pun karena prediksinya selalu
  dihitung segar dari data terbaru oleh router).

Dirancang gagal-lembut: direktori tak bisa dibuat (FS read-only) →
mode baca-saja; file korup → dianggap tidak ada; joblib tak terpasang
→ load/save no-op. Tidak ada satu pun jalur yang melempar ke caller.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import joblib
except ImportError:  # dependency belum terpasang — mode no-op
    joblib = None

# Model dianggap segar selama ini (jam) — setelah itu request berikutnya
# melatih ulang di background. 12 jam = siklus harian ganda: pagi dan
# malam sama-sama mendapat model yang menyertakan data kemarin.
TTL_HOURS = 12


def _parse_iso(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


class ModelStore:
    """Store per-outlet di sebuah direktori (volume docker `mlmodels`)."""

    def __init__(self, directory: str | Path) -> None:
        self.dir = Path(directory)
        try:
            self.dir.mkdir(parents=True, exist_ok=True)
        except OSError:
            pass  # FS read-only / izin — load-only mode

    def path_for(self, outlet_id: str) -> Path:
        # Sanitasi nama file: outlet_id adalah angka dari BIGINT Go,
        # tapi tetap dijaga agar path tidak pernah keluar direktori.
        safe = "".join(c for c in str(outlet_id) if c.isalnum() or c in "-_")
        return self.dir / f"revenue_outlet_{safe or 'x'}.joblib"

    def save(self, outlet_id: str, artifact: dict[str, Any]) -> None:
        """Tulis atomik: dump ke .tmp lalu os.replace — pembaca tidak
        pernah melihat file setengah jadi."""
        if joblib is None:
            return
        final = self.path_for(outlet_id)
        tmp = final.with_suffix(".tmp")
        try:
            joblib.dump(artifact, tmp)
            os.replace(tmp, final)
        except OSError:
            return

    def load(self, outlet_id: str) -> dict[str, Any] | None:
        if joblib is None:
            return None
        try:
            artifact = joblib.load(self.path_for(outlet_id))
        except FileNotFoundError:
            return None
        except Exception:
            return None  # korup / versi joblib beda → anggap tidak ada
        return artifact if isinstance(artifact, dict) else None

    def age_hours(self, artifact: dict[str, Any]) -> float | None:
        trained_at = _parse_iso(artifact.get("trained_at"))
        if trained_at is None:
            return None
        return (datetime.now(timezone.utc) - trained_at).total_seconds() / 3600.0

    def fresh(
        self, artifact: dict[str, Any], ttl_hours: int = TTL_HOURS
    ) -> bool:
        age = self.age_hours(artifact)
        return age is not None and age <= ttl_hours
