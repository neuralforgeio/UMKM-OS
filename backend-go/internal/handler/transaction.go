package handler

import (
    "context"
    "fmt"
    "net/http"
    "strconv"
    "strings"
    "time"

    "github.com/go-chi/chi/v5"

    "github.com/neuralforgeio/internal/db"
    "github.com/neuralforgeio/internal/middleware"
)

type TransactionSummary struct {
    ID                     int64      `json:"id"`
    ReceiptNo              string     `json:"receipt_no"`
    CashierID              int64      `json:"cashier_id"`
    CashierName            string     `json:"cashier_name"`
    ItemCount              int64      `json:"item_count"`
    Subtotal               int64      `json:"subtotal"`
    Discount               int64      `json:"discount"`
    Total                  int64      `json:"total"`
    PaymentMethod          string     `json:"payment_method"`
    PaidAmount             int64      `json:"paid_amount"`
    ChangeAmount           int64      `json:"change_amount"`
    Status                 string     `json:"status"`
    ClaimCode              *string    `json:"claim_code"`
    HandoverStatus         *string    `json:"handover_status"`
    HandoverConfirmedAt    *time.Time `json:"handover_confirmed_at"`
    HandoverConfirmedBy    *int64     `json:"handover_confirmed_by"`
    HandoverConfirmedByName *string   `json:"handover_confirmed_by_name"`
    CreatedAt              time.Time  `json:"created_at"`
}

// Daftar kolom summary yang dipakai bersama LIST dan DETAIL. Kolom serah
// terima ikut dibawa supaya halaman riwayat/konsol tidak perlu query kedua.
const transactionSummarySelect = `
    SELECT t.id, t.receipt_no, t.cashier_id, u.name,
        (SELECT COUNT(*) FROM transaction_items ti WHERE ti.transaction_id = t.id),
        t.subtotal, t.discount, t.total, t.payment_method, t.paid_amount, t.change_amount, t.status,
        t.claim_code, t.handover_status, t.handover_confirmed_at, t.handover_confirmed_by, u2.name,
        t.created_at
    FROM transactions t
    JOIN users u ON u.id = t.cashier_id
    LEFT JOIN users u2 ON u2.id = t.handover_confirmed_by`

func scanTransactionSummary(row interface {
    Scan(dest ...interface{}) error
}) (TransactionSummary, error) {
    var t TransactionSummary
    err := row.Scan(&t.ID, &t.ReceiptNo, &t.CashierID, &t.CashierName, &t.ItemCount,
        &t.Subtotal, &t.Discount, &t.Total, &t.PaymentMethod,
        &t.PaidAmount, &t.ChangeAmount, &t.Status,
        &t.ClaimCode, &t.HandoverStatus, &t.HandoverConfirmedAt, &t.HandoverConfirmedBy, &t.HandoverConfirmedByName,
        &t.CreatedAt)
    return t, err
}

type TransactionItemResponse struct {
    ID          int64  `json:"id"`
    ProductID   int64  `json:"product_id"`
    ProductName string `json:"product_name"`
    Price       int64  `json:"price"`
    Qty         int    `json:"qty"`
    Subtotal    int64  `json:"subtotal"`
}

type SaleItemPayload struct {
    ProductID int64 `json:"product_id"`
    Qty       int   `json:"qty"`
}

type SalePayload struct {
    Items         []SaleItemPayload `json:"items"`
    Discount      int64             `json:"discount"`
    PaymentMethod string            `json:"payment_method"`
    PaidAmount    int64             `json:"paid_amount"`
}

// generateUniqueClaimCode membuat kode klaim 8 karakter yang belum pernah
// terpakai (dicek di DALAM transaksi checkout yang memegang kunci tabel,
// jadi tidak ada race). Percobaan terbatas — kegagalan total (astronomi
// kecil) membatalkan checkout dengan pesan jelas, bukan data kotor.
func generateUniqueClaimCode(ctx context.Context, q dbQuerier) (string, error) {
    for attempt := 0; attempt < 8; attempt++ {
        code := randomClaimCode()
        if code == "" {
            continue
        }
        var exists bool
        if err := q.QueryRow(ctx,
            `SELECT EXISTS(SELECT 1 FROM transactions WHERE claim_code = $1)`, code).Scan(&exists); err != nil {
            return "", err
        }
        if !exists {
            return code, nil
        }
    }
    return "", fmt.Errorf("kode klaim tidak berhasil dibuat")
}

// POST /api/v1/transactions (CASHIER / OWNER) — proses penjualan di kasir.
// Stok dikunci per produk (FOR UPDATE) supaya 2 kasir tidak bisa kebablasan
// stok yang sama. Sejak v1.3.0 tiap struk membawa kode klaim 8 karakter:
// nomor struk = alamat baca publik, kode klaim = kunci interaksi pembeli.
func CreateTransaction(w http.ResponseWriter, r *http.Request) {
    var req SalePayload
    if err := Decode(r, &req); err != nil {
        Err(w, http.StatusBadRequest, "Body request tidak valid")
        return
    }
    req.PaymentMethod = strings.ToUpper(strings.TrimSpace(req.PaymentMethod))
    if req.PaymentMethod == "" {
        req.PaymentMethod = "CASH"
    }
    if len(req.Items) == 0 {
        Err(w, http.StatusBadRequest, "Keranjang kosong, tidak ada item yang dibeli")
        return
    }
    switch req.PaymentMethod {
    case "CASH", "QRIS", "DEBIT":
    default:
        Err(w, http.StatusBadRequest, "Metode bayar harus CASH, QRIS, atau DEBIT")
        return
    }
    if req.Discount < 0 {
        Err(w, http.StatusBadRequest, "Diskon tidak boleh negatif")
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

    // Nomor struk unik: TRX-YYYYMMDD-00001 (pakai sequence global)
    var seq int64
    if err := tx.QueryRow(ctx, `SELECT nextval('receipt_seq')`).Scan(&seq); err != nil {
        Err(w, http.StatusInternalServerError, "Gagal membuat nomor struk")
        return
    }
    receiptNo := fmt.Sprintf("TRX-%s-%05d", time.Now().Format("20060102"), seq)

    // Kode klaim unik untuk verifikasi serah terima (v1.3.0).
    claimCode, err := generateUniqueClaimCode(ctx, tx)
    if err != nil {
        Err(w, http.StatusInternalServerError, "Gagal membuat kode verifikasi struk")
        return
    }

    type itemRow struct {
        ProductID int64
        Name      string
        Price     int64
        Qty       int
        Subtotal  int64
    }
    items := make([]itemRow, 0, len(req.Items))
    var subtotal int64

    // Tahap 1: kunci baris produk, validasi stok, kurangi stok.
    // Gerakan stok dicatat NANTI (setelah baris transaksi ada) supaya
    // bisa terikat ke id transaksi — kartu stok menampilkan kode struk.
    for _, it := range req.Items {
        if it.Qty <= 0 {
            Err(w, http.StatusBadRequest, "Qty setiap item harus minimal 1")
            return
        }
        var row itemRow
        var stock int
        var active bool
        if err := tx.QueryRow(ctx,
            `SELECT id, name, price, stock, is_active FROM products WHERE id = $1 FOR UPDATE`,
            it.ProductID,
        ).Scan(&row.ProductID, &row.Name, &row.Price, &stock, &active); err != nil {
            Err(w, http.StatusBadRequest, fmt.Sprintf("Produk ID %d tidak ditemukan", it.ProductID))
            return
        }
        if !active {
            Err(w, http.StatusBadRequest, fmt.Sprintf("Produk %s sudah tidak aktif", row.Name))
            return
        }
        if stock < it.Qty {
            Err(w, http.StatusBadRequest, fmt.Sprintf("Stok %s tinggal %d (diminta %d)", row.Name, stock, it.Qty))
            return
        }
        row.Qty = it.Qty
        row.Subtotal = row.Price * int64(it.Qty)
        subtotal += row.Subtotal
        items = append(items, row)

        if _, err := tx.Exec(ctx,
            `UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2`,
            it.Qty, row.ProductID); err != nil {
            Err(w, http.StatusInternalServerError, "Gagal mengurangi stok")
            return
        }
    }

    if req.Discount > subtotal {
        Err(w, http.StatusBadRequest, "Diskon tidak boleh lebih besar dari subtotal")
        return
    }
    total := subtotal - req.Discount

    paid := req.PaidAmount
    if req.PaymentMethod != "CASH" {
        paid = total // non-tunai (QRIS/DEBIT) dianggap bayar pas
    }
    if paid < total {
        Err(w, http.StatusBadRequest, "Uang yang dibayar kurang dari total belanja")
        return
    }
    change := paid - total

    // Tahap 2: simpan transaksi induk.
    var trx struct {
        ID        int64
        CreatedAt time.Time
    }
    if err := tx.QueryRow(ctx, `
    INSERT INTO transactions (receipt_no, cashier_id, subtotal, discount, total, payment_method, paid_amount, change_amount, status, claim_code)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'COMPLETED', $9)
    RETURNING id, created_at`,
        receiptNo, c.UserID, subtotal, req.Discount, total, req.PaymentMethod, paid, change, claimCode,
    ).Scan(&trx.ID, &trx.CreatedAt); err != nil {
        Err(w, http.StatusInternalServerError, "Gagal menyimpan transaksi")
        return
    }

    // Tahap 3: item transaksi + gerakan stok terikat transaction_id.
    for _, row := range items {
        if _, err := tx.Exec(ctx, `
        INSERT INTO transaction_items (transaction_id, product_id, product_name, price, qty, subtotal)
        VALUES ($1, $2, $3, $4, $5, $6)`,
            trx.ID, row.ProductID, row.Name, row.Price, row.Qty, row.Subtotal); err != nil {
            Err(w, http.StatusInternalServerError, "Gagal menyimpan item transaksi")
            return
        }
        if _, err := tx.Exec(ctx,
            `INSERT INTO stock_movements (product_id, type, qty, note, user_id, transaction_id)
         VALUES ($1, 'OUT', $2, $3, $4, $5)`,
            row.ProductID, row.Qty, "Penjualan "+receiptNo, c.UserID, trx.ID); err != nil {
            Err(w, http.StatusInternalServerError, "Gagal mencatat pergerakan stok")
            return
        }
    }

    if err := tx.Commit(ctx); err != nil {
        Err(w, http.StatusInternalServerError, "Gagal menyelesaikan transaksi")
        return
    }

    LogAudit(r, c.UserID, "CREATE_TRANSACTION", "transaction", trx.ID,
        fmt.Sprintf("%s total Rp%d (%d item)", receiptNo, total, len(items)))

    itemRes := make([]TransactionItemResponse, 0, len(items))
    for _, row := range items {
        itemRes = append(itemRes, TransactionItemResponse{
            ProductID: row.ProductID, ProductName: row.Name,
            Price: row.Price, Qty: row.Qty, Subtotal: row.Subtotal,
        })
    }

    Created(w, map[string]interface{}{
        "transaction": map[string]interface{}{
            "id": trx.ID, "receipt_no": receiptNo, "cashier_id": c.UserID,
            "cashier_name": c.Name, "item_count": len(items), "subtotal": subtotal,
            "discount": req.Discount, "total": total, "payment_method": req.PaymentMethod,
            "paid_amount": paid, "change_amount": change, "status": "COMPLETED",
            "claim_code": claimCode,
            "created_at": trx.CreatedAt,
        },
        "items": itemRes,
    })
}

// GET /api/v1/transactions?q=&date_from=&date_to=&limit=&offset=
// Kasir hanya melihat transaksi miliknya sendiri; owner & developer
// (era pra-multi-outlet, DEVELOPER diperlakukan setara OWNER — sama
// dengan kebijakan di product.go) melihat semua.
// q = pencarian bebas: nomor struk (fuzzy), kode klaim (persis), atau
// nama kasir (fuzzy) — dipakai konsol verifikasi & riwayat owner.
func ListTransactions(w http.ResponseWriter, r *http.Request) {
    q := r.URL.Query()
    c := middleware.User(r)

    where := []string{"TRUE"}
    args := []interface{}{}

    if !managerRole(c.Role) {
        args = append(args, c.UserID)
        where = append(where, fmt.Sprintf("t.cashier_id = $%d", len(args)))
    }
    if v := strings.TrimSpace(q.Get("date_from")); v != "" {
        args = append(args, v)
        where = append(where, fmt.Sprintf("t.created_at >= $%d::date", len(args)))
    }
    if v := strings.TrimSpace(q.Get("date_to")); v != "" {
        args = append(args, v)
        where = append(where, fmt.Sprintf("t.created_at < ($%d::date + INTERVAL '1 day')", len(args)))
    }
    if v := strings.TrimSpace(q.Get("q")); v != "" {
        args = append(args, "%"+v+"%")
        likeIdx := len(args)
        args = append(args, strings.ToUpper(v))
        exactIdx := len(args)
        where = append(where, fmt.Sprintf(
            "(t.receipt_no ILIKE $%d OR t.claim_code = $%d OR u.name ILIKE $%d)",
            likeIdx, exactIdx, likeIdx))
    }

    limit := 50
    if v, err := strconv.Atoi(q.Get("limit")); err == nil && v > 0 && v <= 200 {
        limit = v
    }
    offset := 0
    if v, err := strconv.Atoi(q.Get("offset")); err == nil && v >= 0 {
        offset = v
    }
    args = append(args, limit, offset)

    sql := fmt.Sprintf(`
    %s
    WHERE %s
    ORDER BY t.created_at DESC
    LIMIT $%d OFFSET $%d`,
        transactionSummarySelect, strings.Join(where, " AND "), len(args)-1, len(args))

    rows, err := db.Pool.Query(r.Context(), sql, args...)
    if err != nil {
        Err(w, http.StatusInternalServerError, "Gagal mengambil daftar transaksi")
        return
    }
    defer rows.Close()

    list := []TransactionSummary{}
    for rows.Next() {
        t, err := scanTransactionSummary(rows)
        if err != nil {
            Err(w, http.StatusInternalServerError, "Gagal membaca data transaksi")
            return
        }
        list = append(list, t)
    }
    if err := rows.Err(); err != nil {
        Err(w, http.StatusInternalServerError, "Gagal membaca data transaksi")
        return
    }
    OK(w, list)
}

type HandoverEventRow struct {
    ID            int64     `json:"id"`
    TransactionID int64     `json:"transaction_id"`
    Kind          string    `json:"kind"`
    Method        string    `json:"method"`
    ActorRole     *string   `json:"actor_role"`
    ActorID       *int64    `json:"actor_id"`
    ActorName     *string   `json:"actor_name"`
    BuyerName     *string   `json:"buyer_name"`
    SignatureData *string   `json:"signature_data"`
    Note          *string   `json:"note"`
    UserAgent     *string   `json:"user_agent"`
    IP            *string   `json:"ip"`
    CreatedAt     time.Time `json:"created_at"`
}

// GET /api/v1/transactions/{id} — ringkasan + item + jejak serah terima.
// Dipakai panel detail riwayat owner dan halaman /owner/verify/[id].
func GetTransaction(w http.ResponseWriter, r *http.Request) {
    id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err != nil {
        Err(w, http.StatusBadRequest, "ID transaksi tidak valid")
        return
    }
    c := middleware.User(r)

    query := transactionSummarySelect + ` WHERE t.id = $1`
    args := []interface{}{id}
    if !managerRole(c.Role) {
        query += ` AND t.cashier_id = $2`
        args = append(args, c.UserID)
    }

    t, err := scanTransactionSummary(db.Pool.QueryRow(r.Context(), query, args...))
    if err != nil {
        Err(w, http.StatusNotFound, "Transaksi tidak ditemukan")
        return
    }

    items := []TransactionItemResponse{}
    rows, err := db.Pool.Query(r.Context(), `
    SELECT id, product_id, product_name, price, qty, subtotal
    FROM transaction_items WHERE transaction_id = $1 ORDER BY product_name ASC, id ASC`, id)
    if err != nil {
        Err(w, http.StatusInternalServerError, "Gagal mengambil item transaksi")
        return
    }
    defer rows.Close()
    for rows.Next() {
        var it TransactionItemResponse
        if err := rows.Scan(&it.ID, &it.ProductID, &it.ProductName, &it.Price, &it.Qty, &it.Subtotal); err != nil {
            Err(w, http.StatusInternalServerError, "Gagal membaca item transaksi")
            return
        }
        items = append(items, it)
    }
    if err := rows.Err(); err != nil {
        Err(w, http.StatusInternalServerError, "Gagal membaca item transaksi")
        return
    }

    // Jejak serah terima (append-only), terbaru dulu.
    events := []HandoverEventRow{}
    erows, err := db.Pool.Query(r.Context(), `
    SELECT e.id, e.transaction_id, e.kind, e.method, e.actor_role, e.actor_id, u.name,
           e.buyer_name, e.signature_data, e.note, e.user_agent, e.ip, e.created_at
    FROM handover_events e
    LEFT JOIN users u ON u.id = e.actor_id
    WHERE e.transaction_id = $1
    ORDER BY e.created_at DESC, e.id DESC`, id)
    if err != nil {
        Err(w, http.StatusInternalServerError, "Gagal mengambil jejak serah terima")
        return
    }
    defer erows.Close()
    for erows.Next() {
        var e HandoverEventRow
        if err := erows.Scan(&e.ID, &e.TransactionID, &e.Kind, &e.Method, &e.ActorRole, &e.ActorID, &e.ActorName,
            &e.BuyerName, &e.SignatureData, &e.Note, &e.UserAgent, &e.IP, &e.CreatedAt); err != nil {
            Err(w, http.StatusInternalServerError, "Gagal membaca jejak serah terima")
            return
        }
        events = append(events, e)
    }
    if err := erows.Err(); err != nil {
        Err(w, http.StatusInternalServerError, "Gagal membaca jejak serah terima")
        return
    }

    OK(w, map[string]interface{}{"transaction": t, "items": items, "events": events})
}
