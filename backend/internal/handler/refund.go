package handler

import (
        "fmt"
        "net/http"
        "strconv"
        "strings"

        "github.com/go-chi/chi/v5"

        "github.com/neuralforgeio/internal/db"
        "github.com/neuralforgeio/internal/middleware"
)

type RefundPayload struct {
        Reason string `json:"reason"`
}

// POST /api/v1/transactions/{id}/refund (OWNER / DEVELOPER)
//
// Refund menandai struk REFUNDED, mengembalikan stok produk, dan menulis
// gerakan IN kompensasi — semuanya dalam SATU transaksi database supaya
// kartu stok tetap bisa dijelaskan:
//
//      saldo awal + IN (restok) + IN (refund) - PENJUALAN = stok sekarang.
//
// Pembaruan status memakai UPDATE bersyarat (status harus masih
// COMPLETED) yang sekaligus menjadi penjaga konkurensi terhadap refund
// ganda dari dua tab owner yang terbuka bersamaan.
//
// Catatan desain: tabel transactions sengaja TIDAK punya kolom updated_at
// (harga yang dibayar di masa lalu tidak boleh berubah) — jangan menambah
// penugasan kolom itu di sini.
func RefundTransaction(w http.ResponseWriter, r *http.Request) {
        c := middleware.User(r)
        id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
        if err != nil {
                Err(w, http.StatusBadRequest, "ID transaksi tidak valid")
                return
        }
        var req RefundPayload
        if r.Body != nil {
                _ = Decode(r, &req) // body tanpa alasan diperlakukan kosong
        }
        reason := strings.TrimSpace(req.Reason)
        if len(reason) > 120 {
                reason = reason[:120]
        }

        ctx := r.Context()

        // v1.5.0: refund ter-scope ke outlet konteks pemanggil — struk
        // outlet lain tidak pernah bisa disentuh lewat id nebak.
        outletID, ok := resolveScopeOutlet(w, r)
        if !ok {
                return
        }

        tx, err := db.Pool.Begin(ctx)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal memulai transaksi")
                return
        }
        defer tx.Rollback(ctx)

        var receiptNo, status string
        var total int64
        var handoverStatus *string
        err = tx.QueryRow(ctx,
                `SELECT receipt_no, status, total, handover_status FROM transactions WHERE id = $1 AND outlet_id = $2 FOR UPDATE`, id, outletID,
        ).Scan(&receiptNo, &status, &total, &handoverStatus)
        if err != nil {
                Err(w, http.StatusNotFound, "Transaksi tidak ditemukan")
                return
        }

        // Refund pasca v3: struk yang SUDAH DISAJIKAN boleh direfund, tapi
        // tidak pernah diam-diam — alasannya wajib supaya pola penyalahgunaan
        // refund oleh staf terlihat di jejak audit.
        if handoverStatus != nil && *handoverStatus == "SERVED" && reason == "" {
                Err(w, http.StatusBadRequest,
                        "Struk ini tercatat SUDAH DISAJIKAN — refund wajib menyertakan alasan (mis. pesanan salah, komplain pembeli)")
                return
        }

        tag, err := tx.Exec(ctx,
                `UPDATE transactions SET status = 'REFUNDED' WHERE id = $1 AND status = 'COMPLETED'`, id)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal memproses refund")
                return
        }
        if tag.RowsAffected() == 0 {
                Err(w, http.StatusConflict, "Transaksi ini sudah direfund sebelumnya")
                return
        }

        // Kembalikan stok tiap item + tulis kartu stok IN (terikat struk).
        rows, err := tx.Query(ctx,
                `SELECT product_id, qty FROM transaction_items WHERE transaction_id = $1`, id)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal membaca item transaksi")
                return
        }
        type refundItem struct {
                ProductID int64
                Qty       int
        }
        items := []refundItem{}
        for rows.Next() {
                var it refundItem
                if err := rows.Scan(&it.ProductID, &it.Qty); err != nil {
                        rows.Close()
                        Err(w, http.StatusInternalServerError, "Gagal membaca item transaksi")
                        return
                }
                items = append(items, it)
        }
        rows.Close()
        if err := rows.Err(); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal membaca item transaksi")
                return
        }

        movementNote := "Refund " + receiptNo
        if reason != "" {
                movementNote += " — " + reason
        }
        for _, it := range items {
                tag, err := tx.Exec(ctx,
                        `UPDATE products SET stock = stock + $1 WHERE id = $2`, it.Qty, it.ProductID)
                if err != nil {
                        Err(w, http.StatusInternalServerError, "Gagal mengembalikan stok")
                        return
                }
                if tag.RowsAffected() == 0 {
                        Err(w, http.StatusBadRequest,
                                "Ada produk pada transaksi ini yang sudah tidak terdaftar — stok tidak bisa dikembalikan")
                        return
                }
                if _, err := tx.Exec(ctx,
                        `INSERT INTO stock_movements (product_id, type, qty, note, user_id, transaction_id)
             VALUES ($1, 'IN', $2, $3, $4, $5)`,
                        it.ProductID, it.Qty, movementNote, c.UserID, id); err != nil {
                        Err(w, http.StatusInternalServerError, "Gagal mencatat kartu stok refund")
                        return
                }
        }

        if err := tx.Commit(ctx); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal menyelesaikan refund")
                return
        }

        detail := fmt.Sprintf("Refund %s — Rp %d (%d item)", receiptNo, total, len(items))
        if reason != "" {
                detail += " — alasan: " + reason
        }
        LogAudit(r, c.UserID, "REFUND_TRANSACTION", "transaction", id, detail)

        OK(w, map[string]interface{}{
                "message":         "Refund selesai — stok dikembalikan dan uang dianggap kembali ke pembeli",
                "receipt_no":      receiptNo,
                "restocked_items": len(items),
        })
}
