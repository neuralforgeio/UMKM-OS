package handler

// Endpoint ramalan (era Go murni) — port jalur statistical
// routes/forecast.py ke backend Go. Kontrak JSON sama persis dengan era
// FastAPI supaya lib/forecast.ts frontend tidak berubah bentak
// panggilannya (BACKEND_URL kini menunjuk backend Go :8080):
//
//      GET /api/v1/forecast/revenue?days=&horizon=&outlet_id=
//      GET /api/v1/forecast/products?limit=&outlet_id=
//
// Prophet pensiun bersama Python: engine selalu "statistical",
// quality = hasil backtest MAPE jujur (null bila data belum cukup).

import (
        "context"
        "encoding/json"
        "net/http"
        "strconv"
        "strings"
        "time"

        "github.com/neuralforgeio/internal/ai"
        "github.com/neuralforgeio/internal/db"
)

func paramInt(q map[string][]string, kunci string, fallback int) int {
        if len(q[kunci]) == 0 {
                return fallback
        }
        v, err := strconv.Atoi(strings.TrimSpace(q[kunci][0]))
        if err != nil || v < 1 {
                return fallback
        }
        return v
}

func paramOutlet(q map[string][]string) int64 {
        if len(q["outlet_id"]) == 0 {
                return 0
        }
        id, err := strconv.ParseInt(strings.TrimSpace(q["outlet_id"][0]), 10, 64)
        if err != nil || id < 1 {
                return 0
        }
        return id
}

func namaOutletByID(id int64) string {
        var nama string
        if err := db.Pool.QueryRow(context.Background(),
                `SELECT name FROM outlets WHERE id = $1`, id).Scan(&nama); err != nil {
                return "-"
        }
        return nama
}

func timeNowJKT() time.Time { return time.Now().In(jkt) }

type dailyRevenueJSON struct {
        Date        string `json:"date"`
        Revenue     int64  `json:"revenue"`
        Transactions int64 `json:"transactions"`
}

// ForecastRevenue: GET /api/v1/forecast/revenue.
func ForecastRevenue(w http.ResponseWriter, r *http.Request) {
        q := r.URL.Query()
        days := paramInt(q, "days", 30)
        if days > 180 {
                days = 180
        }
        horizon := paramInt(q, "horizon", 7)
        if horizon > 30 {
                horizon = 30
        }
        outletID := paramOutlet(q)
        outletStr := "0"
        nama := "Semua outlet"
        if outletID > 0 {
                outletStr = strconv.FormatInt(outletID, 10)
                nama = namaOutletByID(outletID)
        }

        deret := deretHarian(r.Context(), outletID, days)
        hariAcuan := timeNowJKT()
        if len(deret) > 0 {
                hariAcuan = deret[len(deret)-1].Tanggal
        }

        history := make([]dailyRevenueJSON, 0, len(deret))
        for _, d := range deret {
                history = append(history, dailyRevenueJSON{
                        Date: d.Tanggal.Format("2006-01-02"),
                        Revenue: int64(d.Omzet), Transactions: d.Transaksi,
                })
        }

        forecast := ai.RamalPendapatan(deret, hariAcuan, horizon)
        if forecast == nil {
                forecast = []ai.TitikRamalan{}
        }

        _ = json.NewEncoder(w).Encode(map[string]interface{}{
                "outlet_id":     outletStr,
                "outlet_name":   nama,
                "history_days":  len(history),
                "horizon_days":  horizon,
                "method":        "moving-average + weekday-factor",
                "engine":        "statistical",
                "quality":       ai.SusunKualitas(deret, hariAcuan),
                "history":       history,
                "forecast":      forecast,
        })
}

type productForecastJSON struct {
        ProductID        string  `json:"product_id"`
        Name             string  `json:"name"`
        Unit             string  `json:"unit"`
        CurrentStock     int64   `json:"current_stock"`
        MinStock         int64   `json:"min_stock"`
        Forecast7dPoint  float64 `json:"forecast_7d_point"`
        Forecast7dLow    float64 `json:"forecast_7d_low"`
        Forecast7dHigh   float64 `json:"forecast_7d_high"`
        RestockSuggestion int64  `json:"restock_suggestion"`
}

// ForecastProducts: GET /api/v1/forecast/products — saran restok produk
// dari kecepatan laku 7 hari (permintaan per produk bersifat
// intermittent, jalur tetap statistical — alasan domain yang sama
// dengan era Python).
func ForecastProducts(w http.ResponseWriter, r *http.Request) {
        q := r.URL.Query()
        limit := paramInt(q, "limit", 5)
        if limit > 50 {
                limit = 50
        }
        outletID := paramOutlet(q)
        outletStr := "0"
        nama := "Semua outlet"
        if outletID > 0 {
                outletStr = strconv.FormatInt(outletID, 10)
                nama = namaOutletByID(outletID)
        }

        type barisProduk struct {
                ID      int64
                Nama    string
                Unit    string
                Stok    int64
                MinStok int64
        }
        k := &sqlKondisi{where: []string{"p.is_active = TRUE"}}
        k.outlet("p.outlet_id", outletID)
        rows, err := db.Pool.Query(r.Context(), `
                SELECT p.id, p.name, p.unit, p.stock, p.min_stock
                FROM products p
                WHERE `+k.klausa()+`
                ORDER BY (p.stock - p.min_stock) ASC
                LIMIT `+strconv.Itoa(limit*2), k.args...)
        if err != nil {
                tulisDetail(w, http.StatusInternalServerError, "Gagal membaca produk.")
                return
        }
        defer rows.Close()

        laku := laku7Hari(r.Context(), outletID)
        produk := make([]productForecastJSON, 0, limit)
        for rows.Next() {
                var p barisProduk
                if err := rows.Scan(&p.ID, &p.Nama, &p.Unit, &p.Stok, &p.MinStok); err != nil {
                        continue
                }
                kecepatanHarian := float64(laku[p.Nama]) / 7.0
                point := kecepatanHarian * 7.0
                saran := int64(0)
                if point > 0 {
                        butuh := point + float64(p.MinStok)
                        if float64(p.Stok) < butuh {
                                saran = int64(butuh-float64(p.Stok) + 0.999)
                        }
                } else if p.Stok <= p.MinStok {
                        saran = 2*p.MinStok - p.Stok
                        if saran < 0 {
                                saran = 0
                        }
                }
                produk = append(produk, productForecastJSON{
                        ProductID:         strconv.FormatInt(p.ID, 10),
                        Name:              p.Nama,
                        Unit:              p.Unit,
                        CurrentStock:      p.Stok,
                        MinStock:          p.MinStok,
                        Forecast7dPoint:   point,
                        Forecast7dLow:     point * 0.75,
                        Forecast7dHigh:    point * 1.25,
                        RestockSuggestion: saran,
                })
                if len(produk) >= limit {
                        break
                }
        }

        _ = json.NewEncoder(w).Encode(map[string]interface{}{
                "outlet_id":   outletStr,
                "outlet_name": nama,
                "products":    produk,
        })
}
