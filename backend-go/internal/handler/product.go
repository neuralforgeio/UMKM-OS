package handler

import (
    "fmt"
    "net/http"
    "strconv"
    "strings"
    "time"

    "github.com/go-chi/chi/v5"

    "github.com/neuralforgeio/internal/db"
    "github.com/neuralforgeio/internal/middleware"
)

type Product struct {
    ID        int64     `json:"id"`
    Name      string    `json:"name"`
    SKU       *string   `json:"sku"`
    Category  string    `json:"category"`
    Price     int64     `json:"price"`
    Cost      int64     `json:"cost"`
    Stock     int       `json:"stock"`
    MinStock  int       `json:"min_stock"`
    IsActive  bool      `json:"is_active"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

const productColumns = `id, name, sku, category, price, cost, stock, min_stock, is_active, created_at, updated_at`

// GET /api/v1/products?search=&category=&low_stock=true&all=true
// Kasir hanya melihat produk aktif; owner bisa tambah &all=true untuk melihat semua.
func ListProducts(w http.ResponseWriter, r *http.Request) {
    q := r.URL.Query()
    c := middleware.User(r)

    where := []string{"TRUE"}
    args := []interface{}{}

    if s := strings.TrimSpace(q.Get("search")); s != "" {
        args = append(args, "%"+s+"%")
        where = append(where, fmt.Sprintf("(name ILIKE $%d OR sku ILIKE $%d)", len(args), len(args)))
    }
    if cat := strings.TrimSpace(q.Get("category")); cat != "" {
        args = append(args, cat)
        where = append(where, fmt.Sprintf("category = $%d", len(args)))
    }
    if q.Get("low_stock") == "true" {
        where = append(where, "stock <= min_stock")
    }
    if c.Role != "OWNER" || q.Get("all") != "true" {
        where = append(where, "is_active = TRUE")
    }

    sql := `SELECT ` + productColumns + ` FROM products WHERE ` +
        strings.Join(where, " AND ") + ` ORDER BY name ASC`

    rows, err := db.Pool.Query(r.Context(), sql, args...)
    if err != nil {
        Err(w, http.StatusInternalServerError, "Gagal mengambil daftar produk")
        return
    }
    defer rows.Close()

    products := []Product{}
    for rows.Next() {
        var p Product
        if err := rows.Scan(&p.ID, &p.Name, &p.SKU, &p.Category, &p.Price, &p.Cost,
            &p.Stock, &p.MinStock, &p.IsActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
            Err(w, http.StatusInternalServerError, "Gagal membaca data produk")
            return
        }
        products = append(products, p)
    }
    if err := rows.Err(); err != nil {
        Err(w, http.StatusInternalServerError, "Gagal membaca data produk")
        return
    }
    OK(w, products)
}

// GET /api/v1/products/{id}
func GetProduct(w http.ResponseWriter, r *http.Request) {
    id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err != nil {
        Err(w, http.StatusBadRequest, "ID produk tidak valid")
        return
    }
    var p Product
    if err := db.Pool.QueryRow(r.Context(),
        `SELECT `+productColumns+` FROM products WHERE id = $1`, id,
    ).Scan(&p.ID, &p.Name, &p.SKU, &p.Category, &p.Price, &p.Cost,
        &p.Stock, &p.MinStock, &p.IsActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
        Err(w, http.StatusNotFound, "Produk tidak ditemukan")
        return
    }
    c := middleware.User(r)
    if !p.IsActive && c.Role != "OWNER" {
        Err(w, http.StatusNotFound, "Produk tidak ditemukan")
        return
    }
    OK(w, p)
}

type ProductPayload struct {
    Name     string `json:"name"`
    SKU      string `json:"sku"`
    Category string `json:"category"`
    Price    int64  `json:"price"`
    Cost     int64  `json:"cost"`
    Stock    int    `json:"stock"`
    MinStock int    `json:"min_stock"`
}

func validateProductPayload(req *ProductPayload) (string, bool) {
    req.Name = strings.TrimSpace(req.Name)
    req.Category = strings.TrimSpace(req.Category)
    req.SKU = strings.TrimSpace(req.SKU)
    if req.Category == "" {
        req.Category = "Umum"
    }
    if req.MinStock == 0 {
        req.MinStock = 5
    }
    if req.Name == "" {
        return "Nama produk wajib diisi", false
    }
    if req.Price < 0 || req.Cost < 0 || req.Stock < 0 || req.MinStock < 0 {
        return "Harga, stok, dan minimal stok tidak boleh negatif", false
    }
    return "", true
}

// POST /api/v1/products (OWNER)
func CreateProduct(w http.ResponseWriter, r *http.Request) {
    var req ProductPayload
    if err := Decode(r, &req); err != nil {
        Err(w, http.StatusBadRequest, "Body request tidak valid")
        return
    }
    if msg, ok := validateProductPayload(&req); !ok {
        Err(w, http.StatusBadRequest, msg)
        return
    }
    c := middleware.User(r)

    if req.SKU != "" {
        var exists bool
        if err := db.Pool.QueryRow(r.Context(),
            `SELECT EXISTS(SELECT 1 FROM products WHERE sku = $1)`, req.SKU).Scan(&exists); err != nil {
            Err(w, http.StatusInternalServerError, "Gagal memeriksa SKU")
            return
        }
        if exists {
            Err(w, http.StatusConflict, "SKU sudah dipakai produk lain")
            return
        }
    }

    var p Product
    err := db.Pool.QueryRow(r.Context(), `
        INSERT INTO products (name, sku, category, price, cost, stock, min_stock)
        VALUES ($1, NULLIF($2, ''), $3, $4, $5, $6, $7)
        RETURNING `+productColumns,
        req.Name, req.SKU, req.Category, req.Price, req.Cost, req.Stock, req.MinStock,
    ).Scan(&p.ID, &p.Name, &p.SKU, &p.Category, &p.Price, &p.Cost,
        &p.Stock, &p.MinStock, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
    if err != nil {
        Err(w, http.StatusInternalServerError, "Gagal membuat produk")
        return
    }

    if p.Stock > 0 {
        _, _ = db.Pool.Exec(r.Context(),
            `INSERT INTO stock_movements (product_id, type, qty, note, user_id) VALUES ($1, 'IN', $2, $3, $4)`,
            p.ID, p.Stock, "Stok awal produk", c.UserID)
    }

    LogAudit(r, c.UserID, "CREATE_PRODUCT", "product", p.ID, p.Name)
    Created(w, p)
}

// PUT /api/v1/products/{id} (OWNER)
// Perubahan stok TIDAK lewat sini, tapi lewat POST /products/{id}/stock.
func UpdateProduct(w http.ResponseWriter, r *http.Request) {
    id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err != nil {
        Err(w, http.StatusBadRequest, "ID produk tidak valid")
        return
    }
    var req ProductPayload
    if err := Decode(r, &req); err != nil {
        Err(w, http.StatusBadRequest, "Body request tidak valid")
        return
    }
    if msg, ok := validateProductPayload(&req); !ok {
        Err(w, http.StatusBadRequest, msg)
        return
    }
    c := middleware.User(r)

    if req.SKU != "" {
        var exists bool
        if err := db.Pool.QueryRow(r.Context(),
            `SELECT EXISTS(SELECT 1 FROM products WHERE sku = $1 AND id <> $2)`,
            req.SKU, id).Scan(&exists); err != nil {
            Err(w, http.StatusInternalServerError, "Gagal memeriksa SKU")
            return
        }
        if exists {
            Err(w, http.StatusConflict, "SKU sudah dipakai produk lain")
            return
        }
    }

    var p Product
    err = db.Pool.QueryRow(r.Context(), `
        UPDATE products SET
            name = $1, sku = NULLIF($2, ''), category = $3, price = $4, cost = $5,
            min_stock = $6, updated_at = NOW()
        WHERE id = $7 AND is_active = TRUE
        RETURNING `+productColumns,
        req.Name, req.SKU, req.Category, req.Price, req.Cost, req.MinStock, id,
    ).Scan(&p.ID, &p.Name, &p.SKU, &p.Category, &p.Price, &p.Cost,
        &p.Stock, &p.MinStock, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
    if err != nil {
        Err(w, http.StatusNotFound, "Produk tidak ditemukan")
        return
    }

    LogAudit(r, c.UserID, "UPDATE_PRODUCT", "product", p.ID, p.Name)
    OK(w, p)
}

// DELETE /api/v1/products/{id} (OWNER) — soft delete (nonaktifkan)
func DeleteProduct(w http.ResponseWriter, r *http.Request) {
    id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err != nil {
        Err(w, http.StatusBadRequest, "ID produk tidak valid")
        return
    }
    c := middleware.User(r)

    tag, err := db.Pool.Exec(r.Context(),
        `UPDATE products SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND is_active = TRUE`, id)
    if err != nil {
        Err(w, http.StatusInternalServerError, "Gagal menghapus produk")
        return
    }
    if tag.RowsAffected() == 0 {
        Err(w, http.StatusNotFound, "Produk tidak ditemukan")
        return
    }

    LogAudit(r, c.UserID, "DELETE_PRODUCT", "product", id, "nonaktifkan produk")
    OK(w, map[string]interface{}{"message": "Produk dinonaktifkan"})
}

type StockPayload struct {
    Type string `json:"type"` // IN (tambah) | OUT (kurangi) | ADJUST (set absolut)
    Qty  int    `json:"qty"`
    Note string `json:"note"`
}

// POST /api/v1/products/{id}/stock (OWNER) — restock / koreksi stok
func AdjustStock(w http.ResponseWriter, r *http.Request) {
    id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err != nil {
        Err(w, http.StatusBadRequest, "ID produk tidak valid")
        return
    }
    var req StockPayload
    if err := Decode(r, &req); err != nil {
        Err(w, http.StatusBadRequest, "Body request tidak valid")
        return
    }
    req.Type = strings.ToUpper(strings.TrimSpace(req.Type))
    req.Note = strings.TrimSpace(req.Note)
    if req.Type == "" {
        req.Type = "IN"
    }
    switch req.Type {
    case "IN", "OUT", "ADJUST":
    default:
        Err(w, http.StatusBadRequest, "Type harus IN, OUT, atau ADJUST")
        return
    }
    if req.Qty < 0 {
        Err(w, http.StatusBadRequest, "Qty tidak boleh negatif")
        return
    }

    c := middleware.User(r)
    ctx := r.Context()

    tx, err := db.Pool.Begin(ctx)
    if err != nil {
        Err(w, http.StatusInternalServerError, "Gagal memulai transaksi")
        return
    }
    defer tx.Rollback(ctx)

    var current int
    if err := tx.QueryRow(ctx,
        `SELECT stock FROM products WHERE id = $1 AND is_active = TRUE FOR UPDATE`, id,
    ).Scan(&current); err != nil {
        Err(w, http.StatusNotFound, "Produk tidak ditemukan")
        return
    }

    var next int
    switch req.Type {
    case "IN":
        next = current + req.Qty
    case "OUT":
        next = current - req.Qty
    case "ADJUST":
        next = req.Qty
    }
    if next < 0 {
        Err(w, http.StatusBadRequest, fmt.Sprintf("Stok tidak cukup (stok sekarang %d)", current))
        return
    }

    if _, err := tx.Exec(ctx,
        `UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2`, next, id); err != nil {
        Err(w, http.StatusInternalServerError, "Gagal mengubah stok")
        return
    }
    if _, err := tx.Exec(ctx,
        `INSERT INTO stock_movements (product_id, type, qty, note, user_id) VALUES ($1, $2, $3, $4, $5)`,
        id, req.Type, req.Qty, req.Note, c.UserID); err != nil {
        Err(w, http.StatusInternalServerError, "Gagal mencatat pergerakan stok")
        return
    }
    if err := tx.Commit(ctx); err != nil {
        Err(w, http.StatusInternalServerError, "Gagal menyimpan perubahan stok")
        return
    }

    LogAudit(r, c.UserID, "STOCK_"+req.Type, "product", id,
        fmt.Sprintf("stok %d -> %d (%s)", current, next, req.Note))
    OK(w, map[string]interface{}{
        "product_id": id, "stock_before": current, "stock_after": next,
        "type": req.Type, "qty": req.Qty, "note": req.Note,
    })
}
