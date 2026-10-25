package handler

import (
        "net/http"
        "strconv"
        "strings"
        "time"

        "github.com/neuralforgeio/internal/db"
)

type StockMovementRow struct {
        ID          int64     `json:"id"`
        ProductID   int64     `json:"product_id"`
        ProductName string    `json:"product_name"`
        SKU         *string   `json:"sku"`
        Unit        string    `json:"unit"`
        Type        string    `json:"type"`
        Qty         int       `json:"qty"`
        UnitCost    *int64    `json:"unit_cost"`
        Note        string    `json:"note"`
        UserName    *string   `json:"user_name"`
        ReceiptNo   *string   `json:"receipt_no"`
        CreatedAt   time.Time `json:"created_at"`
}

// GET /api/v1/stock-movements?limit=200 (OWNER/DEVELOPER)
// Kartu stok: 200 gerakan terakhir + total gerakan sepanjang masa.
// Gerakan penjualan (OUT dengan receipt_no) JOIN nomor struknya.
// v1.5.0: gerakan ter-scope ke outlet konteks pemanggil (via produk).
func ListStockMovements(w http.ResponseWriter, r *http.Request) {
        outletID, ok := resolveScopeOutlet(w, r)
        if !ok {
                return
        }

        limit := 200
        if v, err := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("limit"))); err == nil && v > 0 && v <= 1000 {
                limit = v
        }

        var total int
        if err := db.Pool.QueryRow(r.Context(), `
        SELECT COUNT(*) FROM stock_movements sm
        JOIN products p ON p.id = sm.product_id
        WHERE p.outlet_id = $1`, outletID).Scan(&total); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal menghitung gerakan stok")
                return
        }

        rows, err := db.Pool.Query(r.Context(), `
        SELECT sm.id, sm.product_id, p.name, p.sku, p.unit, sm.type,
               sm.qty, sm.unit_cost, sm.note, u.name, t.receipt_no, sm.created_at
        FROM stock_movements sm
        JOIN products p ON p.id = sm.product_id
        LEFT JOIN users u ON u.id = sm.user_id
        LEFT JOIN transactions t ON t.id = sm.transaction_id
        WHERE p.outlet_id = $1
        ORDER BY sm.created_at DESC, sm.id DESC
        LIMIT $2`, outletID, limit)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal mengambil gerakan stok")
                return
        }
        defer rows.Close()

        list := []StockMovementRow{}
        for rows.Next() {
                var row StockMovementRow
                if err := rows.Scan(&row.ID, &row.ProductID, &row.ProductName, &row.SKU, &row.Unit,
                        &row.Type, &row.Qty, &row.UnitCost, &row.Note, &row.UserName, &row.ReceiptNo, &row.CreatedAt); err != nil {
                        Err(w, http.StatusInternalServerError, "Gagal membaca gerakan stok")
                        return
                }
                list = append(list, row)
        }
        if err := rows.Err(); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal membaca gerakan stok")
                return
        }

        OK(w, map[string]interface{}{"total": total, "rows": list})
}
