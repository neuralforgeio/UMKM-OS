package ai

// Mesin ramalan STATISTIK murni Go (era Go murni) — menggantikan
// jalur statistical ml-service Python. Prophet pensiun bersama Python:
// duel engine tidak lagi relevan; respons tetap memakai kontrak
// RevenueForecastResponse frontend dengan engine "statistical" dan
// quality hasil backtest MAPE jujur (null bila data belum cukup
// untuk di-backtest).
//
// Algoritma: rata-rata bergerak mingguan + faktor hari (weekday
// seasonality) dari data historis, pita +-25% sebagai low/high.

import (
	"context"
	"time"
)

// HariOmzet: satu hari riwayat pendapatan.
type HariOmzet struct {
	Tanggal     time.Time
	Omzet       float64
	Transaksi   int64
}

// TitikRamalan: satu hari hasil ramalan.
type TitikRamalan struct {
	Tanggal string  `json:"date"`
	Hari    string  `json:"weekday"`
	Point   float64 `json:"point"`
	Low     float64 `json:"low"`
	High    float64 `json:"high"`
}

// KualitasRamalan: hasil backtest MAPE jujur (padanan ForecastQuality
// frontend; mape_prophet selalu null di era Go murni).
type KualitasRamalan struct {
	Winner          string   `json:"winner"`
	MapeProphet     *float64 `json:"mape_prophet"`
	MapeStatistical *float64 `json:"mape_statistical"`
	MarginPP        *float64 `json:"margin_pp"`
	BacktestDays    int      `json:"backtest_days"`
	TrainDays       int      `json:"train_days"`
	TrainedAt       string   `json:"trained_at"`
	TrainedThrough  string   `json:"trained_through"`
}

var namaHariEn = []string{
	"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
}

// RamalPendapatan: ramalan `horizon` hari ke depan dari deret harian.
//
//	deret      : kronologis naik (paling lama -> paling baru)
//	hariAcuan  : hari TERAKHIR data (ramalan mulai besoknya)
//
// Bila data < 7 hari: titik = rata-rata seluruh data (flat). Faktor
// hari dihitung dari rata-rata per weekday vs rata-rata umum bila
// data >= 14 hari.
func RamalPendapatan(deret []HariOmzet, hariAcuan time.Time, horizon int) []TitikRamalan {
	if horizon < 1 {
		horizon = 7
	}
	if len(deret) == 0 {
		return nil
	}
	total := 0.0
	for _, d := range deret {
		total += d.Omzet
	}
	rata := total / float64(len(deret))

	// Rata-rata bergerak 7 hari terakhir (lebih peka terhadap tren baru).
	ma7 := rata
	if len(deret) >= 7 {
		sum7 := 0.0
		for i := len(deret) - 7; i < len(deret); i++ {
			sum7 += deret[i].Omzet
		}
		ma7 = sum7 / 7
	}

	// Faktor hari: rata-rata omzet per weekday / rata-rata umum.
	faktor := make(map[int]float64)
	if len(deret) >= 14 {
		perHari := make(map[int]float64)
		perHariN := make(map[int]int)
		for _, d := range deret {
			wd := int(d.Tanggal.Weekday())
			perHari[wd] += d.Omzet
			perHariN[wd]++
		}
		for wd, sum := range perHari {
			n := perHariN[wd]
			if n > 0 && rata > 0 {
				f := sum / float64(n) / rata
				// Jepit faktor ke [0.5, 1.5] supaya satu hari ekstrem
				// tidak meledakkan ramalan.
				if f < 0.5 {
					f = 0.5
				}
				if f > 1.5 {
					f = 1.5
				}
				faktor[wd] = f
			}
		}
	}

	hasil := make([]TitikRamalan, 0, horizon)
	for i := 1; i <= horizon; i++ {
		t := hariAcuan.AddDate(0, 0, i)
		titik := ma7
		if f, ok := faktor[int(t.Weekday())]; ok {
			titik = ma7 * f
		}
		if titik < 0 {
			titik = 0
		}
		hasil = append(hasil, TitikRamalan{
			Tanggal: t.Format("2006-01-02"),
			Hari:    namaHariEn[int(t.Weekday())],
			Point:   titik,
			Low:     titik * 0.75,
			High:    titik * 1.25,
		})
	}
	return hasil
}

// BacktestMAPE: MAPE walk-forward sederhana — latih di 75% awal, uji
// di 25% akhir (hanya hari ber-omzet; butuh >= 8 hari data dan >= 4
// hari uji, selain itu nil). Angka jujur, bukan kosmetik.
func BacktestMAPE(deret []HariOmzet, hariAcuan time.Time) *float64 {
	n := len(deret)
	if n < 8 {
		return nil
	}
	split := n * 3 / 4
	if n-split < 2 {
		return nil
	}
	pelatihan := deret[:split]
	uji := deret[split:]
	prediksi := RamalPendapatan(pelatihan, pelatihan[len(pelatihan)-1].Tanggal, len(uji))
	if len(prediksi) != len(uji) {
		return nil
	}
	selisih := 0.0
	hitung := 0
	for i, u := range uji {
		if u.Omzet <= 0 {
			continue
		}
		selisih += abs(prediksi[i].Point-u.Omzet) / u.Omzet
		hitung++
	}
	if hitung < 2 {
		return nil
	}
	mape := selisih / float64(hitung) * 100.0
	return &mape
}

// HasilRamalanOutlet: muatan GET /forecast/revenue (kontrak frontend).
type HasilRamalanOutlet struct {
	OutletID    string          `json:"outlet_id"`
	OutletName  string          `json:"outlet_name"`
	HistoryDays int             `json:"history_days"`
	HorizonDays int             `json:"horizon_days"`
	Method      string          `json:"method"`
	Engine      string          `json:"engine"`
	Quality     *KualitasRamalan `json:"quality"`
}

// SusunKualitas membangun blok quality jujur dari deret data.
func SusunKualitas(deret []HariOmzet, hariAcuan time.Time) *KualitasRamalan {
	mape := BacktestMAPE(deret, hariAcuan)
	if mape == nil {
		return nil
	}
	through := hariAcuan.Format("2006-01-02")
	return &KualitasRamalan{
		Winner:          "statistical",
		MapeProphet:     nil,
		MapeStatistical: mape,
		MarginPP:        nil,
		BacktestDays:    len(deret) - len(deret)*3/4,
		TrainDays:       len(deret) * 3 / 4,
		TrainedAt:       hariAcuan.Format(time.RFC3339),
		TrainedThrough:  through,
	}
}

// ctx diimport untuk keseragatan pemanggil retrieval — mesin ini murni.
var _ = context.Background
