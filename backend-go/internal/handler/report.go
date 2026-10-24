package handler

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/neuralforgeio/internal/db"
	"github.com/neuralforgeio/internal/middleware"
)

// =====================================================================
// GET /api/v1/reports/dashboard — v1.1.0
//
// Satu panggilan untuk seluruh kebutuhan dashboard owner (Tahap 4a)
// dan halaman peluncur:
//   - today / yesterday      : omzet, jumlah transaksi, item terjual
//   - week (7 hari, tertua dulu) : grafik batang harian
//   - payments               : porsi CASH/QRIS/DEBIT (jendela 7 hari)
//   - top_products           : 5 terlaris berdasarkan qty (7 hari)
//   - low_stock              : produk di bawah stok minimum + saran restok
//   - recent                 : 6 transaksi terbaru (semua status)
//
// Kasir melihat statistik penjualannya sendiri; owner & developer
// melihat statistik seluruh warung. Hari tanpa penjualan tetap muncul
// di grafik dengan nilai 0 (gap-free), mengikuti perilaku halaman asli.
// =====================================================================

type DashboardDay struct {
	Date    string `json:"date"` // YYYY-MM-DD
	Revenue int64  `json:"revenue"`
	Count   int64  `json:"count"`
}

type DashboardPayment struct {
	Method  string `json:"method"`
	Revenue int64  `json:"revenue"`
	Count   int64  `json:"count"`
}

type DashboardTopProduct struct {
	Name    string `json:"name"`
	Unit    string `json:"unit"`
	Qty     int64  `json:"qty"`
	Revenue int64  `json:"revenue"`
}

type DashboardLowStock struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	SKU      string `json:"sku"`
	Stock    int    `json:"stock"`
	MinStock int    `json:"min_stock"`
	Unit     string `json:"unit"`
	Restock  int    `json:"restock"`
}

type DashboardRecent struct {
	ID            int64     `json:"id"`
	ReceiptNo     string    `json:"receipt_no"`
	CashierName   string    `json:"cashier_name"`
	PaymentMethod string    `json:"payment_method"`
	Total         int64     `json:"total"`
	CreatedAt     time.Time `json:"created_at"`
}

func Dashboard(w http.ResponseWriter, r *http.Request) {
	c := middleware.User(r)
	ctx := r.Context()
	isManager := c.Role == "OWNER" || c.Role == "DEVELOPER"

	// Kasir: batasi semua query ke transaksi miliknya sendiri.
	scopeSolo := "" // untuk query tabel transactions sendirian
	scopeJoin := "" // untuk query yang JOIN transactions (alias t)
	var scopeArgs []interface{}
	if !isManager {
		scopeArgs = append(scopeArgs, c.UserID)
		scopeSolo = " AND cashier_id = $1"
		scopeJoin = " AND t.cashier_id = $1"
	}

	// ----- Grafik 7 hari (gap-free, tertua dulu) -----
	weekByDate := map[string]DashboardDay{}
	rows, err := db.Pool.Query(ctx, `
    SELECT to_char(created_at, 'YYYY-MM-DD'), COALESCE(SUM(total),0), COUNT(*)
    FROM transactions
    WHERE status = 'COMPLETED' AND created_at >= CURRENT_DATE - 6`+scopeSolo+`
    GROUP BY 1`, scopeArgs...)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal menghitung penjualan mingguan")
		return
	}
	for rows.Next() {
		var d DashboardDay
		if err := rows.Scan(&d.Date, &d.Revenue, &d.Count); err != nil {
			rows.Close()
			Err(w, http.StatusInternalServerError, "Gagal membaca penjualan mingguan")
			return
		}
		weekByDate[d.Date] = d
	}
	if err := rows.Err(); err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membaca penjualan mingguan")
		return
	}

	week := make([]DashboardDay, 0, 7)
	for i := 6; i >= 0; i-- {
		key := time.Now().AddDate(0, 0, -i).Format("2006-01-02")
		if d, ok := weekByDate[key]; ok {
			week = append(week, d)
		} else {
			week = append(week, DashboardDay{Date: key})
		}
	}

	var weekTotal, weekCount int64
	for _, d := range week {
		weekTotal += d.Revenue
		weekCount += d.Count
	}
	today := week[len(week)-1]
	yesterday := week[len(week)-2]

	// ----- Metode pembayaran (jendela 7 hari yang sama) -----
	payByMethod := map[string]DashboardPayment{
		"CASH": {Method: "CASH"}, "QRIS": {Method: "QRIS"}, "DEBIT": {Method: "DEBIT"},
	}
	rows, err = db.Pool.Query(ctx, `
    SELECT payment_method, COALESCE(SUM(total),0), COUNT(*)
    FROM transactions
    WHERE status = 'COMPLETED' AND created_at >= CURRENT_DATE - 6`+scopeSolo+`
    GROUP BY payment_method`, scopeArgs...)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal menghitung metode pembayaran")
		return
	}
	for rows.Next() {
		var p DashboardPayment
		if err := rows.Scan(&p.Method, &p.Revenue, &p.Count); err != nil {
			rows.Close()
			Err(w, http.StatusInternalServerError, "Gagal membaca metode pembayaran")
			return
		}
		payByMethod[p.Method] = p
	}
	if err := rows.Err(); err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membaca metode pembayaran")
		return
	}
	payments := []DashboardPayment{payByMethod["CASH"], payByMethod["QRIS"], payByMethod["DEBIT"]}

	// ----- Item terjual hari ini -----
	var itemsToday int64
	if err := db.Pool.QueryRow(ctx, `
    SELECT COALESCE(SUM(ti.qty),0)
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    WHERE t.status = 'COMPLETED' AND t.created_at >= CURRENT_DATE`+scopeJoin, scopeArgs...,
	).Scan(&itemsToday); err != nil {
		Err(w, http.StatusInternalServerError, "Gagal menghitung item terjual")
		return
	}

	// ----- Produk terlaris 7 hari (berdasarkan qty) -----
	topProducts := []DashboardTopProduct{}
	rows, err = db.Pool.Query(ctx, `
    SELECT ti.product_name, COALESCE(p.unit, 'pcs'), SUM(ti.qty), SUM(ti.subtotal)
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    LEFT JOIN products p ON p.id = ti.product_id
    WHERE t.status = 'COMPLETED' AND t.created_at >= CURRENT_DATE - 6`+scopeJoin+`
    GROUP BY ti.product_id, ti.product_name, p.unit
    ORDER BY SUM(ti.qty) DESC
    LIMIT 5`, scopeArgs...)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal mengambil produk terlaris")
		return
	}
	for rows.Next() {
		var tp DashboardTopProduct
		if err := rows.Scan(&tp.Name, &tp.Unit, &tp.Qty, &tp.Revenue); err != nil {
			rows.Close()
			Err(w, http.StatusInternalServerError, "Gagal membaca produk terlaris")
			return
		}
		topProducts = append(topProducts, tp)
	}
	if err := rows.Err(); err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membaca produk terlaris")
		return
	}

	// ----- Stok menipis + jumlah produk aktif (view manajer saja) -----
	lowStock := []DashboardLowStock{}
	var activeProducts int64
	if isManager {
		rows, err = db.Pool.Query(ctx, `
        SELECT id, name, COALESCE(sku,''), stock, min_stock, COALESCE(unit,'pcs')
        FROM products
        WHERE is_active AND stock <= min_stock
        ORDER BY stock ASC, name ASC`)
		if err != nil {
			Err(w, http.StatusInternalServerError, "Gagal mengambil produk stok menipis")
			return
		}
		for rows.Next() {
			var p DashboardLowStock
			if err := rows.Scan(&p.ID, &p.Name, &p.SKU, &p.Stock, &p.MinStock, &p.Unit); err != nil {
				rows.Close()
				Err(w, http.StatusInternalServerError, "Gagal membaca produk stok menipis")
				return
			}
			// Saran restok halaman asli: minimal 2x batas minimum.
			p.Restock = p.MinStock*2 - p.Stock
			if p.Restock < 1 {
				p.Restock = 1
			}
			lowStock = append(lowStock, p)
		}
		if err := rows.Err(); err != nil {
			Err(w, http.StatusInternalServerError, "Gagal membaca produk stok menipis")
			return
		}
		if err := db.Pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM products WHERE is_active`).Scan(&activeProducts); err != nil {
			Err(w, http.StatusInternalServerError, "Gagal menghitung produk aktif")
			return
		}
	}

	// ----- 6 transaksi terbaru (nama kasir ikut dibawa) -----
	recentList := []DashboardRecent{}
	rows, err = db.Pool.Query(ctx, `
    SELECT t.id, t.receipt_no, u.name, t.payment_method, t.total, t.created_at
    FROM transactions t
    JOIN users u ON u.id = t.cashier_id
    WHERE 1=1`+scopeJoin+`
    ORDER BY t.created_at DESC
    LIMIT 6`, scopeArgs...)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal mengambil transaksi terakhir")
		return
	}
	for rows.Next() {
		var rec DashboardRecent
		if err := rows.Scan(&rec.ID, &rec.ReceiptNo, &rec.CashierName, &rec.PaymentMethod, &rec.Total, &rec.CreatedAt); err != nil {
			rows.Close()
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
		"role": c.Role,
		"today": map[string]interface{}{
			"revenue":      today.Revenue,
			"transactions": today.Count,
			"items_sold":   itemsToday,
		},
		"yesterday": map[string]interface{}{
			"revenue":      yesterday.Revenue,
			"transactions": yesterday.Count,
		},
		"week":            week,
		"week_total":      weekTotal,
		"week_count":      weekCount,
		"payments":        payments,
		"top_products":    topProducts,
		"low_stock":       lowStock,
		"active_products": activeProducts,
		"recent":          recentList,
	})
}

// =====================================================================
// Laporan lain (tetap sejak 1.0.0)
// =====================================================================

type SalesPoint struct {
	Period  string `json:"period"`
	Revenue int64  `json:"revenue"`
	Count   int64  `json:"count"`
}

// GET /api/v1/reports/sales?period=daily|monthly (OWNER/DEVELOPER)
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

// GET /api/v1/reports/top-products?days=30&limit=10 (OWNER/DEVELOPER)
// limit bisa dinaikkan (mis. 1000) untuk menghitung jumlah terjual
// 30 hari TERAKHIR untuk semua produk di halaman kelola produk.
func TopProducts(w http.ResponseWriter, r *http.Request) {
	days := 30
	if v, err := strconv.Atoi(r.URL.Query().Get("days")); err == nil && v > 0 && v <= 365 {
		days = v
	}
	limit := 10
	if v, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && v > 0 && v <= 1000 {
		limit = v
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
    LIMIT $2`, days, limit)
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

// GET /api/v1/reports/low-stock (OWNER/DEVELOPER) — produk yang perlu segera di-restock
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

// =====================================================================
// GET /api/v1/reports/profit (v1.3.0) — laba kotor untuk halaman
// riwayat owner: omzet − HPP. HPP mengalikan jumlah terjual dengan biaya
// beli SAAT INI (biaya tidak di-snapshot saat jual) — angka jujur yang
// disingkat jelas "perkiraan" di UI. Bentuk respons camelCase PERSIS
// ProfitSummary di frontend/app/owner/transactions/types.ts sehingga
// halaman memakai data langsung tanpa mapper.
// Uang refund TIDAK dihitung: hanya status COMPLETED yang masuk omzet.
// =====================================================================

type ProfitProductRow struct {
	ProductID     int64    `json:"productId"`
	Name          string   `json:"name"`
	Unit          string   `json:"unit"`
	SoldQuantity  int64    `json:"soldQuantity"`
	RevenueRupiah int64    `json:"revenueRupiah"`
	CostRupiah    int64    `json:"costRupiah"`
	ProfitRupiah  int64    `json:"profitRupiah"`
	MarginPct     *float64 `json:"marginPct"`
}

type ProfitSummary struct {
	PeriodDays       int                `json:"periodDays"`
	TransactionCount int64              `json:"transactionCount"`
	OmzetRupiah      int64              `json:"omzetRupiah"`
	CostRupiah       int64              `json:"costRupiah"`
	ProfitRupiah     int64              `json:"profitRupiah"`
	MarginPct        *float64           `json:"marginPct"`
	Rows             []ProfitProductRow `json:"rows"`
}

func buildProfitSummary(ctx context.Context, days int) (ProfitSummary, error) {
	s := ProfitSummary{PeriodDays: days, Rows: []ProfitProductRow{}}
	since := startOfTodayWIB().AddDate(0, 0, -(days - 1))

	if err := db.Pool.QueryRow(ctx, `
    SELECT COUNT(*), COALESCE(SUM(total), 0)
    FROM transactions
    WHERE status = 'COMPLETED' AND created_at >= $1`, since).
		Scan(&s.TransactionCount, &s.OmzetRupiah); err != nil {
		return s, err
	}

	rows, err := db.Pool.Query(ctx, `
    SELECT ti.product_id, COALESCE(p.name, ti.product_name), COALESCE(p.unit, 'pcs'),
           SUM(ti.qty), SUM(ti.subtotal), SUM(ti.qty * COALESCE(p.cost, 0))
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    LEFT JOIN products p ON p.id = ti.product_id
    WHERE t.status = 'COMPLETED' AND t.created_at >= $1
    GROUP BY ti.product_id, p.name, p.unit, ti.product_name
    ORDER BY SUM(ti.subtotal) DESC`, since)
	if err != nil {
		return s, err
	}
	defer rows.Close()

	for rows.Next() {
		var pr ProfitProductRow
		if err := rows.Scan(&pr.ProductID, &pr.Name, &pr.Unit,
			&pr.SoldQuantity, &pr.RevenueRupiah, &pr.CostRupiah); err != nil {
			return s, err
		}
		pr.ProfitRupiah = pr.RevenueRupiah - pr.CostRupiah
		if pr.RevenueRupiah > 0 {
			m := float64(pr.ProfitRupiah) / float64(pr.RevenueRupiah) * 100
			pr.MarginPct = &m
		}
		s.Rows = append(s.Rows, pr)
		s.CostRupiah += pr.CostRupiah
	}
	if err := rows.Err(); err != nil {
		return s, err
	}

	s.ProfitRupiah = s.OmzetRupiah - s.CostRupiah
	if s.OmzetRupiah > 0 {
		m := float64(s.ProfitRupiah) / float64(s.OmzetRupiah) * 100
		s.MarginPct = &m
	}
	return s, nil
}

// GET /api/v1/reports/profit (OWNER / DEVELOPER) — ringkasan 7 hari +
// 30 hari dalam SATU panggilan: {"week": ProfitSummary, "month": ...}.
func Profit(w http.ResponseWriter, r *http.Request) {
	week, err := buildProfitSummary(r.Context(), 7)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal menghitung laba 7 hari")
		return
	}
	month, err := buildProfitSummary(r.Context(), 30)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal menghitung laba 30 hari")
		return
	}
	OK(w, map[string]interface{}{"week": week, "month": month})
}
