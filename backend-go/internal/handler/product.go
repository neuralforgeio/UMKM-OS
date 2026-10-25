package handler

import (
        "errors"
        "fmt"
        "net/http"
        "strconv"
        "strings"
        "time"

        "github.com/go-chi/chi/v5"
        "github.com/jackc/pgx/v5/pgconn"

        "github.com/neuralforgeio/internal/db"
        "github.com/neuralforgeio/internal/middleware"
)

// Referensi foto produk yang ikut terkirim di daftar produk (id + status
// thumbnail) — byte fotonya sendiri diambil lewat GET /images/{id}.
type ProductImageRef struct {
        ID      int64 `json:"id"`
        IsThumb bool  `json:"is_thumb"`
}

type Product struct {
        ID        int64             `json:"id"`
        Name      string            `json:"name"`
        SKU       *string           `json:"sku"`
        Category  string            `json:"category"`
        Price     int64             `json:"price"`
        Cost      int64             `json:"cost"`
        Stock     int               `json:"stock"`
        MinStock  int               `json:"min_stock"`
        Unit      string            `json:"unit"`
        IsActive  bool              `json:"is_active"`
        Images    []ProductImageRef `json:"images"`
        CreatedAt time.Time         `json:"created_at"`
        UpdatedAt time.Time         `json:"updated_at"`
}

const productColumns = `id, name, sku, category, price, cost, stock, min_stock, unit, is_active, created_at, updated_at`

// Era pra-multi-outlet: DEVELOPER diperlakukan setara OWNER untuk
// melihat produk nonaktif dan memakai parameter ?all=true.
func managerRole(role string) bool {
        return role == "OWNER" || role == "DEVELOPER"
}

// GET /api/v1/products?search=&category=&low_stock=true&all=true
// Kasir hanya melihat produk aktif; owner/developer bisa &all=true.
// Foto produk ikut terlampir (diurutkan thumbnail dulu, lalu urutan
// pengelolaan) supaya kasir dan halaman produk cukup satu panggilan.
// v1.5.0: daftar ter-scope ke outlet pemanggil (dev wajib ?outlet_id=).
func ListProducts(w http.ResponseWriter, r *http.Request) {
        q := r.URL.Query()
        c := middleware.User(r)

        outletID, ok := resolveScopeOutlet(w, r)
        if !ok {
                return
        }

        where := []string{"TRUE"}
        args := []interface{}{}

        args = append(args, outletID)
        where = append(where, fmt.Sprintf("outlet_id = $%d", len(args)))

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
        if !managerRole(c.Role) || q.Get("all") != "true" {
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
                p.Images = []ProductImageRef{}
                if err := rows.Scan(&p.ID, &p.Name, &p.SKU, &p.Category, &p.Price, &p.Cost,
                        &p.Stock, &p.MinStock, &p.Unit, &p.IsActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
                        Err(w, http.StatusInternalServerError, "Gagal membaca data produk")
                        return
                }
                products = append(products, p)
        }
        if err := rows.Err(); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal membaca data produk")
                return
        }

        // Lampirkan foto produk dalam satu query tambahan (ANY + id list).
        if len(products) > 0 {
                ids := make([]int64, len(products))
                for i := range products {
                        ids[i] = products[i].ID
                }
                imgRows, err := db.Pool.Query(r.Context(),
                        `SELECT id, product_id, is_thumb FROM product_images
             WHERE product_id = ANY($1)
             ORDER BY product_id ASC, sort_order ASC, created_at ASC`, ids)
                if err == nil {
                        byProduct := map[int64][]ProductImageRef{}
                        for imgRows.Next() {
                                var ref ProductImageRef
                                var productID int64
                                if err := imgRows.Scan(&ref.ID, &productID, &ref.IsThumb); err == nil {
                                        byProduct[productID] = append(byProduct[productID], ref)
                                }
                        }
                        imgRows.Close()
                        for i := range products {
                                if imgs, ok := byProduct[products[i].ID]; ok {
                                        products[i].Images = imgs
                                }
                        }
                }
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
        outletID, ok := resolveScopeOutlet(w, r)
        if !ok {
                return
        }
        var p Product
        p.Images = []ProductImageRef{}
        if err := db.Pool.QueryRow(r.Context(),
                `SELECT `+productColumns+` FROM products WHERE id = $1 AND outlet_id = $2`, id, outletID,
        ).Scan(&p.ID, &p.Name, &p.SKU, &p.Category, &p.Price, &p.Cost,
                &p.Stock, &p.MinStock, &p.Unit, &p.IsActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
                Err(w, http.StatusNotFound, "Produk tidak ditemukan")
                return
        }
        c := middleware.User(r)
        if !p.IsActive && !managerRole(c.Role) {
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
        Unit     string `json:"unit"`
}

func validateProductPayload(req *ProductPayload) (string, bool) {
        req.Name = strings.TrimSpace(req.Name)
        req.Category = strings.TrimSpace(req.Category)
        req.SKU = strings.TrimSpace(req.SKU)
        req.Unit = strings.TrimSpace(req.Unit)
        if req.Category == "" {
                req.Category = "Umum"
        }
        if req.MinStock == 0 {
                req.MinStock = 5
        }
        if req.Unit == "" {
                req.Unit = "pcs"
        }
        if req.Name == "" {
                return "Nama produk wajib diisi", false
        }
        if len(req.Unit) > 16 {
                return "Satuan maksimal 16 karakter", false
        }
        if req.Price < 0 || req.Cost < 0 || req.Stock < 0 || req.MinStock < 0 {
                return "Harga, stok, dan minimal stok tidak boleh negatif", false
        }
        return "", true
}

// POST /api/v1/products (OWNER/DEVELOPER)
// SKU dikirim caller (server action frontend yang menggenerasinya);
// bentrok SKU langka antara dua create bersamaan dijawab 409 supaya
// caller bisa mencoba nomor urut berikutnya.
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

        outletID, ok := resolveScopeOutlet(w, r)
        if !ok {
                return
        }

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
        p.Images = []ProductImageRef{}
        err := db.Pool.QueryRow(r.Context(), `
        INSERT INTO products (name, sku, category, price, cost, stock, min_stock, unit, outlet_id)
        VALUES ($1, NULLIF($2, ''), $3, $4, $5, $6, $7, $8, $9)
        RETURNING `+productColumns,
                req.Name, req.SKU, req.Category, req.Price, req.Cost, req.Stock, req.MinStock, req.Unit, outletID,
        ).Scan(&p.ID, &p.Name, &p.SKU, &p.Category, &p.Price, &p.Cost,
                &p.Stock, &p.MinStock, &p.Unit, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
        if err != nil {
                var pgErr *pgconn.PgError
                if errors.As(err, &pgErr) && pgErr.Code == "23505" {
                        Err(w, http.StatusConflict, "SKU sudah dipakai produk lain")
                        return
                }
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

// PUT /api/v1/products/{id} (OWNER/DEVELOPER)
// SKU IMMUTABLE di sini (design asli: SKU tidak pernah berubah setelah
// dibuat) dan stok boleh diedit langsung dari form produk — sama
// perilakunya dengan aplikasi sebelumnya. Perubahan stok yang tercatat
// di kartu stok tetap harus lewat POST /products/{id}/stock.
func UpdateProduct(w http.ResponseWriter, r *http.Request) {
        id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
        if err != nil {
                Err(w, http.StatusBadRequest, "ID produk tidak valid")
                return
        }
        outletID, ok := resolveScopeOutlet(w, r)
        if !ok {
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

        var p Product
        p.Images = []ProductImageRef{}
        err = db.Pool.QueryRow(r.Context(), `
        UPDATE products SET
            name = $1, category = $2, price = $3, cost = $4,
            min_stock = $5, stock = $6, unit = $7, updated_at = NOW()
        WHERE id = $8 AND outlet_id = $9 AND is_active = TRUE
        RETURNING `+productColumns,
                req.Name, req.Category, req.Price, req.Cost, req.MinStock, req.Stock, req.Unit, id, outletID,
        ).Scan(&p.ID, &p.Name, &p.SKU, &p.Category, &p.Price, &p.Cost,
                &p.Stock, &p.MinStock, &p.Unit, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
        if err != nil {
                Err(w, http.StatusNotFound, "Produk tidak ditemukan")
                return
        }

        c := middleware.User(r)
        LogAudit(r, c.UserID, "UPDATE_PRODUCT", "product", p.ID, p.Name)
        OK(w, p)
}

// DELETE /api/v1/products/{id} (OWNER/DEVELOPER) — soft delete (arsip)
func DeleteProduct(w http.ResponseWriter, r *http.Request) {
        id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
        if err != nil {
                Err(w, http.StatusBadRequest, "ID produk tidak valid")
                return
        }
        outletID, ok := resolveScopeOutlet(w, r)
        if !ok {
                return
        }
        c := middleware.User(r)

        tag, err := db.Pool.Exec(r.Context(),
                `UPDATE products SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND outlet_id = $2 AND is_active = TRUE`, id, outletID)
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

type ActivePayload struct {
        Active bool `json:"active"`
}

// PUT /api/v1/products/{id}/active (OWNER/DEVELOPER)
// Aktifkan kembali produk terarsip — pasangan dari DELETE di atas.
func SetProductActive(w http.ResponseWriter, r *http.Request) {
        id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
        if err != nil {
                Err(w, http.StatusBadRequest, "ID produk tidak valid")
                return
        }
        outletID, ok := resolveScopeOutlet(w, r)
        if !ok {
                return
        }
        var req ActivePayload
        if err := Decode(r, &req); err != nil {
                Err(w, http.StatusBadRequest, "Body request tidak valid")
                return
        }

        tag, err := db.Pool.Exec(r.Context(),
                `UPDATE products SET is_active = $3, updated_at = NOW() WHERE id = $1 AND outlet_id = $2`, id, outletID, req.Active)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal mengubah status produk")
                return
        }
        if tag.RowsAffected() == 0 {
                Err(w, http.StatusNotFound, "Produk tidak ditemukan")
                return
        }

        c := middleware.User(r)
        if req.Active {
                LogAudit(r, c.UserID, "PRODUCT_ACTIVATE", "product", id, "produk diaktifkan kembali")
        } else {
                LogAudit(r, c.UserID, "PRODUCT_ARCHIVE", "product", id, "produk diarsipkan")
        }
        OK(w, map[string]interface{}{"message": "Status produk diperbarui"})
}

type StockPayload struct {
        Type     string `json:"type"` // IN (restok) | OUT (kurangi) | ADJUST (opname: set absolut)
        Qty      int    `json:"qty"`
        Note     string `json:"note"`
        UnitCost int64  `json:"unit_cost"` // snapshot biaya per satuan saat restok (opsional)
}

// POST /api/v1/products/{id}/stock (OWNER/DEVELOPER) — restok / opname
func AdjustStock(w http.ResponseWriter, r *http.Request) {
        id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
        if err != nil {
                Err(w, http.StatusBadRequest, "ID produk tidak valid")
                return
        }
        outletID, ok := resolveScopeOutlet(w, r)
        if !ok {
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
                `SELECT stock FROM products WHERE id = $1 AND outlet_id = $2 AND is_active = TRUE FOR UPDATE`, id, outletID,
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

        // unit_cost hanya relevan untuk restok (snapshot biaya); gerakan lain
        // menyimpan NULL agar laporan laba tidak salah baca.
        var unitCost interface{}
        if req.Type == "IN" && req.UnitCost > 0 {
                unitCost = req.UnitCost
        }
        if _, err := tx.Exec(ctx,
                `INSERT INTO stock_movements (product_id, type, qty, unit_cost, note, user_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
                id, req.Type, req.Qty, unitCost, req.Note, c.UserID); err != nil {
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
                "type": req.Type, "qty": req.Qty, "note": req.Note, "unit_cost": unitCost,
        })
}
