package handler

import (
        "context"
        crypto_rand "crypto/rand"
        "errors"
        "net/http"
        "strconv"
        "strings"
        "time"

        "github.com/go-chi/chi/v5"
        "github.com/jackc/pgx/v5"
        "github.com/jackc/pgx/v5/pgconn"

        "github.com/neuralforgeio/internal/db"
        "github.com/neuralforgeio/internal/middleware"
)

// =====================================================================
// SERAH TERIMA + VERIFIKASI STRUK (v1.3.0)
//
// Konsolidasi penuh ke backend-go — sebelumnya halaman /owner/verify,
// /owner/verify/[id], dan /verify/[code] membaca tabel PascalCase Prisma
// yang TIDAK PERNAH diisi checkout Go (split-brain: antrean selalu kosong,
// reset password konsol dev tidak pernah sampai ke akun login). Kini
// seluruh penyajian, konfirmasi, dan pembantahan berjalan di tabel Go:
//
//   transactions.claim_code        kode 8 karakter (kunci interaktif)
//   transactions.handover_status   null | SERVED | CONFIRMED |
//                                  COURIER_CLAIMED | DISPUTED
//   handover_events                jejak append-only (siapa/kapan/perangkat)
//
// Filosofi v3 tetap: NOMOR STRUK hanyalah alamat baca (read-only),
// KODE KLAIM 8 karakter adalah kunci interaksi pembeli.
// =====================================================================

// dbQuerier disatukan supaya helper bisa dipakai Pool maupun Tx.
type dbQuerier interface {
        QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row
        Exec(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error)
}

// Charset tanpa karakter ambigu (tanpa 0/O/1/I) — aman dibacakan lewat
// telepon dan diketik dari struk. 32^8 = ~1,1 triliun kombinasi.
const claimCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

func randomClaimCode() string {
        b := make([]byte, 8)
        if _, err := crypto_rand.Read(b); err != nil {
                return "" // pemanggil wajib memeriksa string kosong
        }
        for i := range b {
                b[i] = claimCodeAlphabet[int(b[i])%len(claimCodeAlphabet)]
        }
        return string(b)
}

// Zona waktu warung: batas "hari ini" dihitung WIB, bukan UTC container
// (main.go menanam time/tzdata supaya LoadLocation selalu berhasil).
func jakartaTZ() *time.Location {
        loc, err := time.LoadLocation("Asia/Jakarta")
        if err != nil {
                return time.FixedZone("WIB", 7*60*60)
        }
        return loc
}

func startOfTodayWIB() time.Time {
        now := time.Now().In(jakartaTZ())
        y, m, d := now.Date()
        return time.Date(y, m, d, 0, 0, 0, 0, jakartaTZ())
}

// Validasi data URL PNG dari SignaturePad (maks ±300KB) — sama persis
// dengan isValidSignatureData() di frontend/lib/handover.ts.
func isValidSignatureData(s string) bool {
        return strings.HasPrefix(s, "data:image/png;base64,") &&
                len(s) > 100 && len(s) <= 300000
}

// Nama outlet untuk struk publik (v1.4.0): dari tabel `outlets` milik Go.
// Era transisi tetap aman — kalau tabel Prisma "Outlet" lama masih ada
// dan outlets belum terisi, namanya diambil dari sana; deployment murni
// tanpa Prisma jatuh ke "Warung".
func outletDisplayName(ctx context.Context) string {
        var name string
        if err := db.Pool.QueryRow(ctx,
                `SELECT name FROM outlets ORDER BY created_at ASC, id ASC LIMIT 1`).Scan(&name); err == nil && strings.TrimSpace(name) != "" {
                return strings.TrimSpace(name)
        }
        var hasTable *bool
        if err := db.Pool.QueryRow(ctx,
                `SELECT to_regclass('public."Outlet"') IS NOT NULL`).Scan(&hasTable); err == nil && hasTable != nil && *hasTable {
                if err := db.Pool.QueryRow(ctx,
                        `SELECT name FROM "Outlet" ORDER BY "createdAt" ASC LIMIT 1`).Scan(&name); err == nil && strings.TrimSpace(name) != "" {
                        return strings.TrimSpace(name)
                }
        }
        return "Warung"
}

type QueueRow struct {
        ID            int64     `json:"id"`
        ReceiptNo     string    `json:"receipt_no"`
        ClaimCode     *string   `json:"claim_code"`
        CreatedAt     time.Time `json:"created_at"`
        ItemCount     int64     `json:"item_count"` // SUM(qty) — bukan jumlah baris
        Total         int64     `json:"total"`
        PaymentMethod string    `json:"payment_method"`
}

// GET /api/v1/queue — ANTREAN PENYAJIAN (anti-lupa): transaksi HARI INI
// (WIB) yang masih COMPLETED dan belum punya aktivitas serah terima apa
// pun. Dipanggil saat render halaman kasir/konsol + di-poll tiap 30 dtk.
// v1.5.0: antrean ter-scope ke outlet konteks pemanggil.
func ServeQueue(w http.ResponseWriter, r *http.Request) {
        outletID, ok := resolveScopeOutlet(w, r)
        if !ok {
                return
        }
        rows, err := db.Pool.Query(r.Context(), `
    SELECT t.id, t.receipt_no, t.claim_code, t.created_at,
           COALESCE((SELECT SUM(ti.qty) FROM transaction_items ti WHERE ti.transaction_id = t.id), 0),
           t.total, t.payment_method
    FROM transactions t
    WHERE t.status = 'COMPLETED' AND t.handover_status IS NULL AND t.created_at >= $1 AND t.outlet_id = $2
    ORDER BY t.created_at ASC
    LIMIT 30`, startOfTodayWIB(), outletID)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal mengambil antrean penyajian")
                return
        }
        defer rows.Close()

        list := []QueueRow{}
        for rows.Next() {
                var row QueueRow
                if err := rows.Scan(&row.ID, &row.ReceiptNo, &row.ClaimCode, &row.CreatedAt,
                        &row.ItemCount, &row.Total, &row.PaymentMethod); err != nil {
                        Err(w, http.StatusInternalServerError, "Gagal membaca antrean penyajian")
                        return
                }
                list = append(list, row)
        }
        if err := rows.Err(); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal membaca antrean penyajian")
                return
        }
        OK(w, list)
}

// Body longgar untuk semua aksi serah terima — field tidak wajib.
type handoverActionInput struct {
        BuyerName     string `json:"buyer_name"`
        SignatureData string `json:"signature_data"`
        Note          string `json:"note"`
        Reason        string `json:"reason"`
}

func decodeHandoverBody(_ http.ResponseWriter, r *http.Request) *handoverActionInput {
        req := &handoverActionInput{}
        if r.Body != nil {
                _ = Decode(r, req) // body kosong/invalid diperlakukan kosong
        }
        return req
}

type handoverTarget struct {
        ID             int64
        ReceiptNo      string
        ClaimCode      *string
        Status         string
        HandoverStatus *string
}

func loadHandoverTarget(ctx context.Context, q dbQuerier, id int64, outletID int64) (*handoverTarget, error) {
        var t handoverTarget
        err := q.QueryRow(ctx,
                `SELECT id, receipt_no, claim_code, status, handover_status FROM transactions WHERE id = $1 AND outlet_id = $2`, id, outletID,
        ).Scan(&t.ID, &t.ReceiptNo, &t.ClaimCode, &t.Status, &t.HandoverStatus)
        if err != nil {
                return nil, err
        }
        return &t, nil
}

// insertHandoverEvent menulis satu baris jejak append-only. WAJIB dipanggil
// di DALAM transaksi database yang sama dengan UPDATE status supaya jejak
// dan status tidak pernah berpisah.
func insertHandoverEvent(ctx context.Context, q dbQuerier, t *handoverTarget,
        kind, method, actorRole string, actorID *int64,
        buyerName, signatureData, note, userAgent, ip string) error {
        _, err := q.Exec(ctx, `
    INSERT INTO handover_events
        (transaction_id, kind, method, actor_role, actor_id, buyer_name, signature_data, note, user_agent, ip)
    VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), NULLIF($7, ''), NULLIF($8, ''), NULLIF($9, ''), NULLIF($10, ''))`,
                t.ID, kind, method, actorRole, actorID, buyerName, signatureData, note, userAgent, ip)
        return err
}

// logAuditPublic mencatat aksi pembeli tanpa akun (user_id NULL) — tetap
// berjejak di audit_logs, tapi tidak pernah menggagalkan aksinya.
func logAuditPublic(r *http.Request, action, entity string, entityID int64, detail string) {
        _, err := db.Pool.Exec(r.Context(),
                `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail)
     VALUES (NULL, $1, $2, $3, $4)`,
                action, entity, strconv.FormatInt(entityID, 10), detail)
        if err != nil {
                // audit gagal tidak boleh membatalkan apa pun — cukup tercatat di log server.
                _ = err
        }
}

// ---------------------------------------------------------------------
// Aksi staf (login: OWNER / CASHIER / DEVELOPER)
// ---------------------------------------------------------------------

// POST /api/v1/transactions/{id}/serve — MARK SERVED (pintu utama v3
// dine-in): pesanan diserahkan/disajikan. SATU ARAH — tidak ada tombol
// batal; jejak STAFF_SERVE berisi siapa, kapan, dan perangkat apa.
func MarkServed(w http.ResponseWriter, r *http.Request) {
        c := middleware.User(r)
        id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
        if err != nil {
                Err(w, http.StatusBadRequest, "ID transaksi tidak valid")
                return
        }
        outletID, ok := resolveScopeOutlet(w, r)
        if !ok {
                return
        }
        req := decodeHandoverBody(w, r)
        note := strings.TrimSpace(req.Note)
        if len(note) > 200 {
                note = note[:200]
        }

        ctx := r.Context()
        tx, err := db.Pool.Begin(ctx)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal memulai transaksi")
                return
        }
        defer tx.Rollback(ctx)

        // Transisi atomik: hanya boleh dari "belum ada aktivitas" (NULL).
        tag, err := tx.Exec(ctx,
                `UPDATE transactions
     SET handover_status = 'SERVED', handover_confirmed_at = NOW(), handover_confirmed_by = $2
     WHERE id = $1 AND outlet_id = $3 AND status = 'COMPLETED' AND handover_status IS NULL`,
                id, c.UserID, outletID)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal menandai penyajian")
                return
        }
        if tag.RowsAffected() == 0 {
                t, lerr := loadHandoverTarget(ctx, tx, id, outletID)
                if lerr != nil {
                        Err(w, http.StatusNotFound, "Transaksi tidak ditemukan")
                        return
                }
                if t.Status == "REFUNDED" {
                        Err(w, http.StatusBadRequest, "Transaksi ini sudah direfund")
                        return
                }
                if t.HandoverStatus != nil {
                        switch *t.HandoverStatus {
                        case "SERVED":
                                Err(w, http.StatusBadRequest, "Pesanan ini sudah tercatat disajikan")
                                return
                        case "CONFIRMED":
                                Err(w, http.StatusBadRequest, "Sudah terverifikasi diterima pembeli — tidak perlu ditandai")
                                return
                        case "COURIER_CLAIMED":
                                Err(w, http.StatusBadRequest, "Status: diklaim kurir. Buka detail transaksi untuk mengelola")
                                return
                        case "DISPUTED":
                                Err(w, http.StatusBadRequest, "Ada pembantahan pembeli — selesaikan dulu sengketanya")
                                return
                        }
                }
                Err(w, http.StatusBadRequest, "Pesanan ini tidak bisa ditandai disajikan")
                return
        }

        var t handoverTarget
        if err := tx.QueryRow(ctx,
                `SELECT id, receipt_no, claim_code, status, handover_status FROM transactions WHERE id = $1`, id,
        ).Scan(&t.ID, &t.ReceiptNo, &t.ClaimCode, &t.Status, &t.HandoverStatus); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal membaca transaksi")
                return
        }

        if err := insertHandoverEvent(ctx, tx, &t, "STAFF_SERVE", "IN_APP", c.Role, &c.UserID,
                "", "", note, r.UserAgent(), middleware.ClientIP(r)); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal mencatat jejak penyajian")
                return
        }

        if err := tx.Commit(ctx); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal menyelesaikan penandaan")
                return
        }

        LogAudit(r, c.UserID, "HANDOVER_SERVE", "transaction", id,
                "Struk "+t.ReceiptNo+" ditandai sudah disajikan")
        OK(w, map[string]interface{}{
                "message":         "Pesanan ditandai sudah disajikan",
                "handover_status": "SERVED",
        })
}

// POST /api/v1/transactions/{id}/confirm — KONFIRMASI KUAT: pembeli tanda
// tangan LANGSUNG di layar staf yang sedang login (takeaway/online, atau
// menambah bukti kuat setelah pesanan disajikan).
func ConfirmHandover(w http.ResponseWriter, r *http.Request) {
        c := middleware.User(r)
        id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
        if err != nil {
                Err(w, http.StatusBadRequest, "ID transaksi tidak valid")
                return
        }
        outletID, ok := resolveScopeOutlet(w, r)
        if !ok {
                return
        }
        req := decodeHandoverBody(w, r)
        if !isValidSignatureData(req.SignatureData) {
                Err(w, http.StatusBadRequest, "Tanda tangan pembeli belum digambar")
                return
        }
        buyerName := strings.TrimSpace(req.BuyerName)
        if len(buyerName) > 40 {
                buyerName = buyerName[:40]
        }

        ctx := r.Context()
        tx, err := db.Pool.Begin(ctx)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal memulai transaksi")
                return
        }
        defer tx.Rollback(ctx)

        // Transisi atomik: boleh dari status apa pun KECUALI sudah CONFIRMED.
        tag, err := tx.Exec(ctx,
                `UPDATE transactions
     SET handover_status = 'CONFIRMED', handover_confirmed_at = NOW(), handover_confirmed_by = $2
     WHERE id = $1 AND outlet_id = $3 AND status = 'COMPLETED' AND handover_status IS DISTINCT FROM 'CONFIRMED'`,
                id, c.UserID, outletID)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal menyimpan konfirmasi")
                return
        }
        if tag.RowsAffected() == 0 {
                t, lerr := loadHandoverTarget(ctx, tx, id, outletID)
                if lerr != nil {
                        Err(w, http.StatusNotFound, "Transaksi tidak ditemukan")
                        return
                }
                if t.Status == "REFUNDED" {
                        Err(w, http.StatusBadRequest, "Transaksi ini sudah direfund")
                        return
                }
                if t.HandoverStatus != nil && *t.HandoverStatus == "CONFIRMED" {
                        Err(w, http.StatusBadRequest, "Transaksi ini sudah terverifikasi sebelumnya")
                        return
                }
                Err(w, http.StatusBadRequest, "Konfirmasi ini tidak bisa diproses")
                return
        }

        var t handoverTarget
        if err := tx.QueryRow(ctx,
                `SELECT id, receipt_no, claim_code, status, handover_status FROM transactions WHERE id = $1`, id,
        ).Scan(&t.ID, &t.ReceiptNo, &t.ClaimCode, &t.Status, &t.HandoverStatus); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal membaca transaksi")
                return
        }

        if err := insertHandoverEvent(ctx, tx, &t, "BUYER_CONFIRM", "IN_APP", c.Role, &c.UserID,
                buyerName, req.SignatureData, "", r.UserAgent(), middleware.ClientIP(r)); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal mencatat bukti serah terima")
                return
        }

        if err := tx.Commit(ctx); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal menyelesaikan konfirmasi")
                return
        }

        LogAudit(r, c.UserID, "HANDOVER_CONFIRM", "transaction", id,
                "Struk "+t.ReceiptNo+" dikonfirmasi diterima pembeli — tanda tangan digital")
        OK(w, map[string]interface{}{
                "message":         "Bukti serah terima tersimpan",
                "handover_status": "CONFIRMED",
        })
}

// POST /api/v1/transactions/{id}/claim — KONFIRMASI LEMAH (fallback):
// staf menandai "sudah diantar" TANPA tanda tangan pembeli.
func ClaimDelivered(w http.ResponseWriter, r *http.Request) {
        c := middleware.User(r)
        id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
        if err != nil {
                Err(w, http.StatusBadRequest, "ID transaksi tidak valid")
                return
        }
        outletID, ok := resolveScopeOutlet(w, r)
        if !ok {
                return
        }
        req := decodeHandoverBody(w, r)
        note := strings.TrimSpace(req.Note)
        if len(note) > 200 {
                note = note[:200]
        }

        ctx := r.Context()
        tx, err := db.Pool.Begin(ctx)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal memulai transaksi")
                return
        }
        defer tx.Rollback(ctx)

        tag, err := tx.Exec(ctx,
                `UPDATE transactions
     SET handover_status = 'COURIER_CLAIMED'
     WHERE id = $1 AND outlet_id = $2 AND status = 'COMPLETED' AND handover_status IS NULL`,
                id, outletID)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal menyimpan klaim")
                return
        }
        if tag.RowsAffected() == 0 {
                t, lerr := loadHandoverTarget(ctx, tx, id, outletID)
                if lerr != nil {
                        Err(w, http.StatusNotFound, "Transaksi tidak ditemukan")
                        return
                }
                if t.Status == "REFUNDED" {
                        Err(w, http.StatusBadRequest, "Transaksi ini sudah direfund")
                        return
                }
                if t.HandoverStatus != nil {
                        switch *t.HandoverStatus {
                        case "SERVED":
                                Err(w, http.StatusBadRequest, "Pesanan ini sudah tercatat disajikan — buka detail untuk konfirmasi pembeli")
                                return
                        case "CONFIRMED":
                                Err(w, http.StatusBadRequest, "Sudah terverifikasi pembeli — tidak perlu klaim kurir")
                                return
                        case "COURIER_CLAIMED":
                                Err(w, http.StatusBadRequest, "Sudah pernah diklaim kurir sebelumnya")
                                return
                        case "DISPUTED":
                                Err(w, http.StatusBadRequest, "Pembeli sedang membantah pesanan ini — selesaikan dulu dengan pembeli")
                                return
                        }
                }
                Err(w, http.StatusBadRequest, "Klaim ini tidak bisa diproses")
                return
        }

        var t handoverTarget
        if err := tx.QueryRow(ctx,
                `SELECT id, receipt_no, claim_code, status, handover_status FROM transactions WHERE id = $1`, id,
        ).Scan(&t.ID, &t.ReceiptNo, &t.ClaimCode, &t.Status, &t.HandoverStatus); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal membaca transaksi")
                return
        }

        if err := insertHandoverEvent(ctx, tx, &t, "COURIER_CLAIM", "IN_APP", c.Role, &c.UserID,
                "", "", note, r.UserAgent(), middleware.ClientIP(r)); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal mencatat jejak klaim")
                return
        }

        if err := tx.Commit(ctx); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal menyelesaikan klaim")
                return
        }

        LogAudit(r, c.UserID, "HANDOVER_CLAIM", "transaction", id,
                "Struk "+t.ReceiptNo+" diklaim sudah diantar (tanpa tanda tangan pembeli)")
        OK(w, map[string]interface{}{
                "message":         "Klaim kurir tersimpan",
                "handover_status": "COURIER_CLAIMED",
        })
}

// ---------------------------------------------------------------------
// Halaman publik (TANPA login) — kode klaim adalah kuncinya
// ---------------------------------------------------------------------

type ReceiptItem struct {
        ProductName string `json:"product_name"`
        Qty         int    `json:"qty"`
        Price       int64  `json:"price"`
        Subtotal    int64  `json:"subtotal"`
}

type publicReceiptRow struct {
        ID                  int64
        ReceiptNo           string
        ClaimCode           *string
        CreatedAt           time.Time
        Total               int64
        PaymentMethod       string
        Status              string
        HandoverStatus      *string
        HandoverConfirmedAt *time.Time
        ConfirmedByName     *string
}

const publicReceiptSelect = `
    SELECT t.id, t.receipt_no, t.claim_code, t.created_at, t.total, t.payment_method,
           t.status, t.handover_status, t.handover_confirmed_at, u.name
    FROM transactions t
    LEFT JOIN users u ON u.id = t.handover_confirmed_by
    WHERE `

func scanPublicReceipt(row pgx.Row) (*publicReceiptRow, error) {
        var t publicReceiptRow
        err := row.Scan(&t.ID, &t.ReceiptNo, &t.ClaimCode, &t.CreatedAt, &t.Total, &t.PaymentMethod,
                &t.Status, &t.HandoverStatus, &t.HandoverConfirmedAt, &t.ConfirmedByName)
        if err != nil {
                return nil, err
        }
        return &t, nil
}

// GET /api/v1/public/receipt/{code} — dibuka pembeli dari QR / link struk.
// Nomor struk (TRX-…) = alamat READ-ONLY; kode klaim 8 karakter = kunci
// INTERAKTIF (struk lama tetap bisa konfirmasi/bantah).
func PublicReceipt(w http.ResponseWriter, r *http.Request) {
        code := strings.ToUpper(strings.TrimSpace(chi.URLParam(r, "code")))
        if code == "" {
                Err(w, http.StatusBadRequest, "Kode struk kosong")
                return
        }
        ctx := r.Context()

        // 1) Nomor struk dulu (mode v3 read-only), 2) kode klaim (v2 interaktif).
        t, err := scanPublicReceipt(db.Pool.QueryRow(ctx,
                publicReceiptSelect+`upper(t.receipt_no) = $1`, code))
        mode := "readonly"
        if err != nil {
                t, err = scanPublicReceipt(db.Pool.QueryRow(ctx,
                        publicReceiptSelect+`upper(t.claim_code) = $1`, code))
                mode = "interactive"
        }
        if err != nil {
                if errors.Is(err, pgx.ErrNoRows) {
                        Err(w, http.StatusNotFound, "Kode tidak ditemukan. Pastikan sama persis dengan yang di struk / yang dibacakan kurir")
                        return
                }
                Err(w, http.StatusInternalServerError, "Gagal memuat struk")
                return
        }

        items := []ReceiptItem{}
        rows, err := db.Pool.Query(ctx, `
    SELECT product_name, qty, price, subtotal
    FROM transaction_items WHERE transaction_id = $1 ORDER BY id ASC`, t.ID)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal mengambil item struk")
                return
        }
        defer rows.Close()
        for rows.Next() {
                var it ReceiptItem
                if err := rows.Scan(&it.ProductName, &it.Qty, &it.Price, &it.Subtotal); err != nil {
                        Err(w, http.StatusInternalServerError, "Gagal membaca item struk")
                        return
                }
                items = append(items, it)
        }
        if err := rows.Err(); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal membaca item struk")
                return
        }

        // Konfirmasi terbaru (tanda tangan + metode) kalau sudah pernah.
        var confirmMethod, buyerName, signatureData *string
        _ = db.Pool.QueryRow(ctx, `
    SELECT method, buyer_name, signature_data
    FROM handover_events
    WHERE transaction_id = $1 AND kind = 'BUYER_CONFIRM'
    ORDER BY created_at DESC LIMIT 1`, t.ID).
                Scan(&confirmMethod, &buyerName, &signatureData)

        OK(w, map[string]interface{}{
                "mode":                  mode,
                "receipt_no":            t.ReceiptNo,
                "claim_code":            t.ClaimCode,
                "outlet_name":           outletDisplayName(ctx),
                "created_at":            t.CreatedAt,
                "items":                 items,
                "total":                 t.Total,
                "payment_method":        t.PaymentMethod,
                "status":                t.Status,
                "handover_status":       t.HandoverStatus,
                "handover_confirmed_at": t.HandoverConfirmedAt,
                "confirmed_by_name":     t.ConfirmedByName,
                "confirm_method":        confirmMethod,
                "buyer_name":            buyerName,
                "signature_data":        signatureData,
        })
}

// POST /api/v1/public/receipt/{code}/confirm — konfirmasi KUAT dari HP
// pembeli (tanpa login): tanda tangan + nama + waktu + perangkat.
// Hanya kode klaim yang bisa — nomor struk memang bukan kunci.
func PublicConfirm(w http.ResponseWriter, r *http.Request) {
        code := strings.ToUpper(strings.TrimSpace(chi.URLParam(r, "code")))
        req := decodeHandoverBody(w, r)
        if !isValidSignatureData(req.SignatureData) {
                Err(w, http.StatusBadRequest, "Tanda tangan belum digambar")
                return
        }
        buyerName := strings.TrimSpace(req.BuyerName)
        if len(buyerName) > 40 {
                buyerName = buyerName[:40]
        }

        ctx := r.Context()
        tx, err := db.Pool.Begin(ctx)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal memulai transaksi")
                return
        }
        defer tx.Rollback(ctx)

        var t handoverTarget
        err = tx.QueryRow(ctx,
                `SELECT id, receipt_no, claim_code, status, handover_status
     FROM transactions WHERE upper(claim_code) = $1 FOR UPDATE`, code,
        ).Scan(&t.ID, &t.ReceiptNo, &t.ClaimCode, &t.Status, &t.HandoverStatus)
        if err != nil {
                if errors.Is(err, pgx.ErrNoRows) {
                        Err(w, http.StatusNotFound, "Kode tidak dikenali")
                        return
                }
                Err(w, http.StatusInternalServerError, "Gagal memuat struk")
                return
        }
        if t.Status == "REFUNDED" {
                Err(w, http.StatusBadRequest, "Transaksi ini sudah direfund oleh warung")
                return
        }
        if t.HandoverStatus != nil && *t.HandoverStatus == "CONFIRMED" {
                Err(w, http.StatusBadRequest, "Pesanan ini sudah terverifikasi sebelumnya")
                return
        }

        if _, err := tx.Exec(ctx,
                `UPDATE transactions
     SET handover_status = 'CONFIRMED', handover_confirmed_at = NOW(), handover_confirmed_by = NULL
     WHERE id = $1`, t.ID); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal menyimpan konfirmasi")
                return
        }
        if err := insertHandoverEvent(ctx, tx, &t, "BUYER_CONFIRM", "PUBLIC", "BUYER", nil,
                buyerName, req.SignatureData, "", r.UserAgent(), middleware.ClientIP(r)); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal mencatat konfirmasi")
                return
        }
        if err := tx.Commit(ctx); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal menyelesaikan konfirmasi")
                return
        }

        logAuditPublic(r, "PUBLIC_BUYER_CONFIRM", "transaction", t.ID,
                "Struk "+t.ReceiptNo+" dikonfirmasi dari HP pembeli (kode "+code+")")
        OK(w, map[string]interface{}{"message": "Konfirmasi penerimaan tersimpan"})
}

// POST /api/v1/public/receipt/{code}/dispute — pembeli membantah:
// "saya tidak pernah terima". Tercatat permanen dan terlihat di konsol.
func PublicDispute(w http.ResponseWriter, r *http.Request) {
        code := strings.ToUpper(strings.TrimSpace(chi.URLParam(r, "code")))
        req := decodeHandoverBody(w, r)
        reason := strings.TrimSpace(req.Reason)
        if len(reason) > 200 {
                reason = reason[:200]
        }

        ctx := r.Context()
        tx, err := db.Pool.Begin(ctx)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal memulai transaksi")
                return
        }
        defer tx.Rollback(ctx)

        var t handoverTarget
        err = tx.QueryRow(ctx,
                `SELECT id, receipt_no, claim_code, status, handover_status
     FROM transactions WHERE upper(claim_code) = $1 FOR UPDATE`, code,
        ).Scan(&t.ID, &t.ReceiptNo, &t.ClaimCode, &t.Status, &t.HandoverStatus)
        if err != nil {
                if errors.Is(err, pgx.ErrNoRows) {
                        Err(w, http.StatusNotFound, "Kode tidak dikenali")
                        return
                }
                Err(w, http.StatusInternalServerError, "Gagal memuat struk")
                return
        }
        if t.Status == "REFUNDED" {
                Err(w, http.StatusBadRequest, "Transaksi ini sudah direfund oleh warung")
                return
        }
        if t.HandoverStatus != nil {
                switch *t.HandoverStatus {
                case "DISPUTED":
                        Err(w, http.StatusBadRequest, "Pembantahan ini sudah tercatat")
                        return
                case "CONFIRMED":
                        Err(w, http.StatusBadRequest, "Pesanan ini sudah terverifikasi diterima. Hubungi toko langsung")
                        return
                }
        }

        if _, err := tx.Exec(ctx,
                `UPDATE transactions SET handover_status = 'DISPUTED' WHERE id = $1`, t.ID); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal mencatat pembantahan")
                return
        }
        if err := insertHandoverEvent(ctx, tx, &t, "BUYER_DISPUTE", "PUBLIC", "BUYER", nil,
                "", "", reason, r.UserAgent(), middleware.ClientIP(r)); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal mencatat pembantahan")
                return
        }
        if err := tx.Commit(ctx); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal menyelesaikan pembantahan")
                return
        }

        logAuditPublic(r, "PUBLIC_BUYER_DISPUTE", "transaction", t.ID,
                "Struk "+t.ReceiptNo+" DIBANTAH pembeli (kode "+code+")"+func() string {
                        if reason != "" {
                                return " — alasan: " + reason
                        }
                        return ""
                }())
        OK(w, map[string]interface{}{"message": "Pembantahan tercatat permanen"})
}
