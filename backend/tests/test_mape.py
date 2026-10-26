"""Unit tests MAPE — modul murni, tanpa DB, tanpa pandas.

Jalankan (lokal/container):  pytest -q
"""

from datetime import date

import pytest

from app.services.mape import mean_absolute_percentage_error


def test_mape_nilai_yang_diketahui():
    # |100-90|/100 = 0.10 ; |50-40|/50 = 0.20 ; rata-rata 0.15 -> 15%
    assert mean_absolute_percentage_error([100.0, 50.0], [90.0, 40.0]) == pytest.approx(15.0)


def test_mape_prediksi_sama_dengan_aktual():
    assert mean_absolute_percentage_error([10.0, 20.0], [10.0, 20.0]) == pytest.approx(0.0)


def test_mape_hari_nol_dilangkahi_bukan_dihukum():
    # Hari aktual 0 TIDAK masuk pembagi; hanya hari ber-pendapatan dinilai:
    # 100->90 = 10% dan 200->180 = 10% -> rata-rata 10% (tebakan 999 diabaikan).
    mape = mean_absolute_percentage_error([0.0, 100.0, 200.0], [999.0, 90.0, 180.0])
    assert mape == pytest.approx(10.0)


def test_mape_semua_aktual_nol_mengembalikan_none():
    assert mean_absolute_percentage_error([0.0, 0.0, 0.0], [5.0, 0.0, 3.0]) is None


def test_mape_tanda_negatif_aktual_diperlakukan_absolut():
    # Nilai negatif tidak lazim untuk pendapatan, tapi kontrak abs()
    # dijamin: error dihitung dari magnitudo.
    mape = mean_absolute_percentage_error([-100.0], [-90.0])
    assert mape == pytest.approx(10.0)


def test_mape_panjang_tidak_cocok_melempar_valueerror():
    with pytest.raises(ValueError):
        mean_absolute_percentage_error([1.0, 2.0], [1.0])


def test_mape_menerima_deret_kosong_tanpa_error():
    # Tidak ada hari dinilai -> None (bukan ZeroDivision).
    assert mean_absolute_percentage_error([], []) is None


def test_mape_menerima_tanggal_tidak_penting():
    # Fungsi hanya melihat angka — pemanggil boleh melewatkan value
    # langsung; tanggal tidak pernah disentuh modul ini.
    hari = [date(2026, 9, 1), date(2026, 9, 2)]
    aktual = [100.0, 0.0]
    prediksi = [110.0, 42.0]
    assert mean_absolute_percentage_error(aktual, prediksi) == pytest.approx(10.0)
    assert len(hari) == 2
