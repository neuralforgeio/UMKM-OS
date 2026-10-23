package handler

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/neuralforgeio/internal/db"
	"github.com/neuralforgeio/internal/middleware"
)

// GET /api/v1/reports/dashboard
// Kasir melihat statistik penjualannya sendiri; owner melihat statistik seluruh warung.
func Dashboard(w http.ResponseWriter, r *http.Request) {
	c := middleware.User(r)
	ctx := r.Context()

	scopeSolo := "" // untuk query tabel transactions sendirian
	scopeJoin := "" // untuk query yang JOIN users
	var args []interface{}
	if c.Role != "OWNER" {
		args = append(args, c.UserID)
		scopeSolo = " AND cashier_id = $1"
		scopeJoin = " AND t.cashier_id = $1"
	}

	var todayRevenue, todayCount int64
	if err := db.Pool.QueryRow(ctx, `
        SELECT COALESCE(SUM(total),0), COUNT(*) FROM transactions
        WHERE status = 'COMPLETED' AND created_at >= CURRENT_DATE`+scopeSolo, args...,
	).Scan(&todayRevenue, &todayCount); err != nil {
		Err(w, http.StatusInternalServerError, "Gagal menghitung penjualan hari ini")
		return
	}

	var productCount, lowStockCount int64
	if err := db.Pool.QueryRow(ctx, `
        SELECT
            (SELECT COUNT(*) FROM products WHERE is_active),
            (SELECT COUNT(*) FROM products WHERE is_active AND stock <= min_stock)`).
		Scan(&productCount, &lowStockCount); err != nil {
		Err(w, http.StatusInternalServerError, "Gagal menghitung produk")
		return
	}

	type recent struct {
		ID        int64     `json:"id"`
		ReceiptNo string    `json:"receipt_no"`
		Total     int64     `json:"total"`
		Cashier   string    `json:"cashier_name"`
		CreatedAt time.Time `json:"created_at"`
	}
	recentList := []recent{}
	rows, err := db.Pool.Query(ctx, `
        SELECT t.id, t.receipt_no, t.total, u.name, t.created_at
        FROM transactions t
        JOIN users u ON u.id = t.cashier_id
        WHERE t.created_at >= CURRENT_DATE`+scopeJoin+`
        ORDER BY t.created_at DESC
        LIMIT 5`, args...)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal mengambil transaksi terakhir")
		return
	}
	defer rows.Close()
	for rows.Next() {
		var rec recent
		if err := rows.Scan(&rec.ID, &rec.ReceiptNo, &rec.Total, &rec.Cashier, &rec.CreatedAt); err != nil {
			Err(w, http.StatusInternalServerError, "Gagal membaca transaksi terakhir")
			return
		}
		recentList = append(recentList, rec)
	}
	if err := rows.Err(); err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membaca transaksi terakhir")
		return
	}

	OK(w, map[string]interface{}{
		"role":                c.Role,
		"today_revenue":       todayRevenue,
		"today_transactions":  todayCount,
		"active_products":     productCount,
		"low_stock_products":  lowStockCount,
		"recent_transactions": recentList,
	})
}

type SalesPoint struct {
	Period  string `json:"period"`
	Revenue int64  `json:"revenue"`
	Count   int64  `json:"count"`
}

// GET /api/v1/reports/sales?period=daily|monthly (OWNER)
// daily = 30 hari terakhir, monthly = 12 bulan terakhir (tanggal kosong diisi 0).
func SalesReport(w http.ResponseWriter, r *http.Request) {
	period := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("period")))
	if period != "monthly" {
		period = "daily"
	}

	points := []SalesPoint{}

	if period == "daily" {
		rows, err := db.Pool.Query(r.Context(), `
            SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD'), COALESCE(SUM(total),0), COUNT(*)
            FROM transactions
            WHERE created_at >= CURRENT_DATE - 29
            GROUP BY 1
            ORDER BY 1`)
		if err != nil {
			Err(w, http.StatusInternalServerError, "Gagal mengambil laporan harian")
			return
		}
		defer rows.Close()
		for rows.Next() {
			var p SalesPoint
			if err := rows.Scan(&p.Period, &p.Revenue, &p.Count); err != nil {
				Err(w, http.StatusInternalServerError, "Gagal membaca laporan harian")
				return
			}
			points = append(points, p)
		}
		if err := rows.Err(); err != nil {
			Err(w, http.StatusInternalServerError, "Gagal membaca laporan harian")
			return
		}
		points = fillDailyGaps(points)
	} else {
		rows, err := db.Pool.Query(r.Context(), `
            SELECT to_char(date_trunc('month', created_at), 'YYYY-MM'), COALESCE(SUM(total),0), COUNT(*)
            FROM transactions
            WHERE created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '11 months')
            GROUP BY 1
            ORDER BY 1`)
		if err != nil {
			Err(w, http.StatusInternalServerError, "Gagal mengambil laporan bulanan")
			return
		}
		defer rows.Close()
		for rows.Next() {
			var p SalesPoint
			if err := rows.Scan(&p.Period, &p.Revenue, &p.Count); err != nil {
				Err(w, http.StatusInternalServerError, "Gagal membaca laporan bulanan")
				return
			}
			points = append(points, p)
		}
		if err := rows.Err(); err != nil {
			Err(w, http.StatusInternalServerError, "Gagal membaca laporan bulanan")
			return
		}
		points = fillMonthlyGaps(points)
	}

	OK(w, map[string]interface{}{"period": period, "points": points})
}

func fillDailyGaps(points []SalesPoint) []SalesPoint {
	byDate := map[string]SalesPoint{}
	for _, p := range points {
		byDate[p.Period] = p
	}
	out := make([]SalesPoint, 0, 30)
	for i := 29; i >= 0; i-- {
		d := time.Now().AddDate(0, 0, -i).Format("2006-01-02")
		if p, ok := byDate[d]; ok {
			out = append(out, p)
		} else {
			out = append(out, SalesPoint{Period: d})
		}
	}
	return out
}

func fillMonthlyGaps(points []SalesPoint) []SalesPoint {
	byMonth := map[string]SalesPoint{}
	for _, p := range points {
		byMonth[p.Period] = p
	}
	out := make([]SalesPoint, 0, 12)
	for i := 11; i >= 0; i-- {
		m := time.Now().AddDate(0, -i, 0).Format("2006-01")
		if p, ok := byMonth[m]; ok {
			out = append(out, p)
		} else {
			out = append(out, SalesPoint{Period: m})
		}
	}
	return out
}

// GET /api/v1/reports/top-products?days=30 (OWNER)
func TopProducts(w http.ResponseWriter, r *http.Request) {
	days := 30
	if v, err := strconv.Atoi(r.URL.Query().Get("days")); err == nil && v > 0 && v <= 365 {
		days = v
	}

	type TopProduct struct {
		ProductID   int64  `json:"product_id"`
		ProductName string `json:"product_name"`
		Qty         int64  `json:"qty"`
		Revenue     int64  `json:"revenue"`
	}
	list := []TopProduct{}

	rows, err := db.Pool.Query(r.Context(), `
        SELECT ti.product_id, ti.product_name, SUM(ti.qty), SUM(ti.subtotal)
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        WHERE t.created_at >= CURRENT_DATE - ($1 - 1)
        GROUP BY ti.product_id, ti.product_name
        ORDER BY SUM(ti.subtotal) DESC
        LIMIT 10`, days)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal mengambil produk terlaris")
		return
	}
	defer rows.Close()
	for rows.Next() {
		var tp TopProduct
		if err := rows.Scan(&tp.ProductID, &tp.ProductName, &tp.Qty, &tp.Revenue); err != nil {
			Err(w, http.StatusInternalServerError, "Gagal membaca produk terlaris")
			return
		}
		list = append(list, tp)
	}
	if err := rows.Err(); err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membaca produk terlaris")
		return
	}

	OK(w, map[string]interface{}{"days": days, "products": list})
}

// GET /api/v1/reports/low-stock (OWNER) — produk yang perlu segera di-restock
func LowStock(w http.ResponseWriter, r *http.Request) {
	type LowStockProduct struct {
		ID       int64  `json:"id"`
		Name     string `json:"name"`
		Category string `json:"category"`
		Stock    int    `json:"stock"`
		MinStock int    `json:"min_stock"`
	}
	list := []LowStockProduct{}

	rows, err := db.Pool.Query(r.Context(), `
        SELECT id, name, category, stock, min_stock
        FROM products
        WHERE is_active AND stock <= min_stock
        ORDER BY (stock - min_stock) ASC, name ASC`)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal mengambil produk stok menipis")
		return
	}
	defer rows.Close()
	for rows.Next() {
		var p LowStockProduct
		if err := rows.Scan(&p.ID, &p.Name, &p.Category, &p.Stock, &p.MinStock); err != nil {
			Err(w, http.StatusInternalServerError, "Gagal membaca produk stok menipis")
			return
		}
		list = append(list, p)
	}
	if err := rows.Err(); err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membaca produk stok menipis")
		return
	}
	OK(w, list)
}
