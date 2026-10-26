"""MAPE (Mean Absolute Percentage Error) — matematika murni.

Kontrak backtest ML v3.0.0 (lihat app/ml/trainer.py): MAPE dihitung
HANYA atas hari dengan nilai aktual NON-ZERO. Alasannya domain, bukan
kenyamanan: hari tutup/nol membuat pembagi nol sehingga satu hari sepi
saja bisa meledakkan MAPE ratusan persen dan menghukum kedua engine
secara tidak adil — padahal kedua engine sama-sama tidak diminta
menebak hari libur. Hari nol dinilai lewat metrik lain (momen), bukan
MAPE. Bila SELURUH hari uji bernilai nol, MAPE tidak terdefinisi dan
fungsi mengembalikan None; pemanggil wajib menanganinya.

Modul ini sengaja tidak mengimpor apa pun di luar stdlib agar tetap
teruji polos (tests/test_mape.py) dan aman dipakai engine mana pun.
"""

from __future__ import annotations

from collections.abc import Sequence


def mean_absolute_percentage_error(
    actual: Sequence[float],
    predicted: Sequence[float],
) -> float | None:
    """MAPE dalam persen atas hari ber-aktual non-zero; None bila tak terdefinisi.

    - Panjang `actual` dan `predicted` harus sama (ValueError) —
      mismatch adalah bug pemanggil, bukan data.
    - Hari dengan aktual 0 DILANGKAU (lihat docstring modul).
    - Bila tidak ada satu pun hari ber-aktual non-zero → None.
    """
    if len(actual) != len(predicted):
        raise ValueError(
            f"panjang actual ({len(actual)}) != predicted ({len(predicted)})"
        )

    errors: list[float] = []
    for a, p in zip(actual, predicted):
        if a == 0:
            continue  # hari tanpa pendapatan: di luar yurisdiksi MAPE
        errors.append(abs(a - p) / abs(a))

    if not errors:
        return None
    return 100.0 * sum(errors) / len(errors)
