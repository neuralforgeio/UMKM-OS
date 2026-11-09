package handler

import (
        "net/http"
        "strings"

        "github.com/neuralforgeio/internal/db"
)

// =====================================================================
// KONSOL VERIFIKASI STRUK (v1.6.0) — dua endpoint kecil yang mengganti
// query Prisma langsung di halaman /owner/verify.
//
// Kenapa tidak memakai GET /transactions saja? Karena konsol verifikasi
// adalah alat OUTLET-WIDE untuk semua staf yang jualan: kasir harus bisa
// mencari struk yang dibuat kasir lain di shiftnya (mis. pisah jadwal,
// ganti kasir tengah hari), sementara /transactions membatasi kasir ke
// struk miliknya sendiri. Pencarian & statistik di sini sengaja
// outlet-scope, bukan aktor-scope — persis semantik halaman lamanya.
// =====================================================================

type VerifyCounts struct {
        Waiting   int64 `json:"waiting"`   // COMPLETED + belum ada aktivitas serah terima
        Served    int64 `json:"served"`    // handover_status = SERVED
        Confirmed int64 `json:"confirmed"` // handover_status = CONFIRMED
        Disputed  int64 `json:"disputed"`  // handover_status = DISPUTED
}

// GET /api/v1/verify/today — kartu statistik hari ini (WIB) + antrean
// penyajian dalam SATU respons, ter-scope ke outlet konteks pemanggil.
// Antrean identik dengan GET /queue (dipisah hanya agar konsol verifikasi
// cukup satu panggilan saat render pertama).
func VerifyToday(w http.ResponseWriter, r *http.Request) {
        outletID, ok := resolveScopeOutlet(w, r)
        if !ok {
                return
        }

        counts := VerifyCounts{}
        // Kartu "Menunggu" mengikuti definisi antrean (status COMPLETED tanpa
        // aktivitas serah terima); tiga kartu lainnya murni dari status
        // penyajian — transaksi REFUNDED yang sempat disajikan tetap terhitung
        // di kartunya, sama dengan perilaku halaman era Prisma.
        if err := db.Pool.QueryRow(r.Context(), `
    SELECT
      COALESCE(SUM(CASE WHEN t.status = 'COMPLETED' AND t.handover_status IS NULL THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN t.handover_status = 'SERVED' THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN t.handover_status = 'CONFIRMED' THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN t.handover_status = 'DISPUTED' THEN 1 ELSE 0 END), 0)
    FROM transactions t
    WHERE t.outlet_id = $1 AND t.created_at >= $2`,
                outletID, startOfTodayWIB(),
        ).Scan(&counts.Waiting, &counts.Served, &counts.Confirmed, &counts.Disputed); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal menghitung statistik verifikasi")
                return
        }

        queue, err := loadServeQueue(r, outletID)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal mengambil antrean penyajian")
                return
        }

        OK(w, map[string]interface{}{
                "counts": counts,
                "queue":  queue,
        })
}

// GET /api/v1/verify/lookup?q=TRX-… — cari SATU struk untuk kartu hasil:
// cocok dengan nomor struk ATAU kode klaim 8 karakter (case-insensitive,
// persis semantik era Prisma: code = q / claimCode = q). Terbaru dulu
// bila kebetulan dobel. 404 kalau tidak ketemu — halaman menampilkan
// pesan "struk tidak ditemukan".
func VerifyLookup(w http.ResponseWriter, r *http.Request) {
        outletID, ok := resolveScopeOutlet(w, r)
        if !ok {
                return
        }

        q := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("q")))
        if q == "" {
                Err(w, http.StatusBadRequest, "Parameter q wajib diisi")
                return
        }

        t, err := scanTransactionSummary(db.Pool.QueryRow(r.Context(), `
    `+transactionSummarySelect+`
    WHERE t.outlet_id = $1 AND (UPPER(t.receipt_no) = $2 OR UPPER(t.claim_code) = $3)
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT 1`, outletID, q, q))
        if err != nil {
                Err(w, http.StatusNotFound, "Struk tidak ditemukan")
                return
        }

        OK(w, t)
}
