package handler

import (
        "context"
        "fmt"
        "io"
        "net/http"
        "strconv"
        "strings"

        "github.com/go-chi/chi/v5"
        "github.com/jackc/pgx/v5"

        "github.com/neuralforgeio/internal/db"
        "github.com/neuralforgeio/internal/middleware"
)

// Foto produk disimpan sebagai bytea di PostgreSQL — sederhana, ikut
// terbackup bersama database, dan cukup cepat untuk ukuran warung.
const (
        maxImagesPerProduct = 6
        maxImageBytes       = 3 * 1024 * 1024 // 3 MB
)

var allowedImageTypes = map[string]bool{
        "image/jpeg": true,
        "image/png":  true,
        "image/webp": true,
}

// GET /api/v1/images/{id} — PUBLIK.
// Struk & POS menampilkan foto lewat tag <img> yang tidak bisa membawa
// header Authorization, jadi endpoint ini memang tanpa login (sama
// dengan era sebelumnya); id numerik dipakai bersama cache immutable
// di proxy Next.js sehingga foto tidak diunduh ulang.
func ServeImage(w http.ResponseWriter, r *http.Request) {
        id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
        if err != nil {
                Err(w, http.StatusBadRequest, "ID foto tidak valid")
                return
        }

        var mimeType string
        var data []byte
        if err := db.Pool.QueryRow(r.Context(),
                `SELECT mime_type, data FROM product_images WHERE id = $1`, id,
        ).Scan(&mimeType, &data); err != nil {
                Err(w, http.StatusNotFound, "Foto tidak ditemukan")
                return
        }

        w.Header().Set("Content-Type", mimeType)
        w.Header().Set("Content-Length", strconv.Itoa(len(data)))
        w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
        w.WriteHeader(http.StatusOK)
        _, _ = w.Write(data)
}

// POST /api/v1/products/{id}/images (OWNER/DEVELOPER) — multipart "file".
// Foto PERTAMA sebuah produk otomatis jadi thumbnail; batas jumlah dan
// ukuran sama dengan aplikasi sebelumnya.
func AddProductImage(w http.ResponseWriter, r *http.Request) {
        productID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
        if err != nil {
                Err(w, http.StatusBadRequest, "ID produk tidak valid")
                return
        }

        outletID, ok := resolveScopeOutlet(w, r)
        if !ok {
                return
        }

        var exists bool
        if err := db.Pool.QueryRow(r.Context(),
                `SELECT EXISTS(SELECT 1 FROM products WHERE id = $1 AND outlet_id = $2)`, productID, outletID).Scan(&exists); err != nil || !exists {
                Err(w, http.StatusNotFound, "Produk tidak ditemukan")
                return
        }

        if err := r.ParseMultipartForm(maxImageBytes); err != nil {
                Err(w, http.StatusBadRequest, "Berkas foto tidak valid")
                return
        }
        file, header, err := r.FormFile("file")
        if err != nil {
                Err(w, http.StatusBadRequest, "Berkas foto tidak valid")
                return
        }
        defer file.Close()

        if header.Size > maxImageBytes {
                Err(w, http.StatusBadRequest, "Foto terlalu besar (maks. 3 MB)")
                return
        }
        mimeType := header.Header.Get("Content-Type")
        if !allowedImageTypes[mimeType] {
                mimeType = "image/jpeg"
        }

        bytes, err := io.ReadAll(io.LimitReader(file, maxImageBytes+1))
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal membaca berkas foto")
                return
        }
        if len(bytes) > maxImageBytes {
                Err(w, http.StatusBadRequest, "Foto terlalu besar (maks. 3 MB)")
                return
        }
        if len(bytes) == 0 {
                Err(w, http.StatusBadRequest, "Berkas foto kosong")
                return
        }

        var count int
        if err := db.Pool.QueryRow(r.Context(),
                `SELECT COUNT(*) FROM product_images WHERE product_id = $1`, productID).Scan(&count); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal menghitung foto produk")
                return
        }
        if count >= maxImagesPerProduct {
                Err(w, http.StatusBadRequest, fmt.Sprintf("Maksimal %d foto per produk.", maxImagesPerProduct))
                return
        }

        isThumb := count == 0
        var imageID int64
        if err := db.Pool.QueryRow(r.Context(),
                `INSERT INTO product_images (product_id, mime_type, data, is_thumb, sort_order)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                productID, mimeType, bytes, isThumb, count).Scan(&imageID); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal menyimpan foto")
                return
        }

        c := middleware.User(r)
        LogAudit(r, c.UserID, "ADD_IMAGE", "product", productID, header.Filename)
        Created(w, map[string]interface{}{
                "id": imageID, "product_id": productID, "is_thumb": isThumb,
                "sort_order": count, "image_count": count + 1,
        })
}

// scopedImageProduct memvalidasi bahwa foto berada di produk milik outlet
// konteks pemanggil — dipakai semua aksi manajemen foto (v1.5.0).
// Mengembalikan 0 + false bila foto/produk tidak ada di scope.
func scopedImageProduct(ctx context.Context, imageID int64, outletID int64) (int64, bool) {
        var productID int64
        if err := db.Pool.QueryRow(ctx, `
        SELECT pi.product_id
        FROM product_images pi
        JOIN products p ON p.id = pi.product_id
        WHERE pi.id = $1 AND p.outlet_id = $2`, imageID, outletID,
        ).Scan(&productID); err != nil {
                return 0, false
        }
        return productID, true
}

// DELETE /api/v1/images/{id} (OWNER/DEVELOPER).
// Kalau foto yang dihapus adalah thumbnail, foto tersisa pertama
// dipromosikan — invariant "ada thumbnail selama ada foto" selalu jalan.
func DeleteImage(w http.ResponseWriter, r *http.Request) {
        imageID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
        if err != nil {
                Err(w, http.StatusBadRequest, "ID foto tidak valid")
                return
        }
        ctx := r.Context()
        c := middleware.User(r)

        outletID, ok := resolveScopeOutlet(w, r)
        if !ok {
                return
        }
        productID, ok := scopedImageProduct(ctx, imageID, outletID)
        if !ok {
                Err(w, http.StatusNotFound, "Foto tidak ditemukan")
                return
        }

        tx, err := db.Pool.Begin(ctx)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal memulai transaksi")
                return
        }
        defer tx.Rollback(ctx)

        var isThumb bool
        if err := tx.QueryRow(ctx,
                `SELECT is_thumb FROM product_images WHERE id = $1`, imageID,
        ).Scan(&isThumb); err != nil {
                Err(w, http.StatusNotFound, "Foto tidak ditemukan")
                return
        }

        if _, err := tx.Exec(ctx, `DELETE FROM product_images WHERE id = $1`, imageID); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal menghapus foto")
                return
        }
        if isThumb {
                var nextID int64
                err := tx.QueryRow(ctx,
                        `SELECT id FROM product_images WHERE product_id = $1
             ORDER BY sort_order ASC, created_at ASC LIMIT 1`, productID).Scan(&nextID)
                if err == nil {
                        if _, err := tx.Exec(ctx,
                                `UPDATE product_images SET is_thumb = TRUE WHERE id = $1`, nextID); err != nil {
                                Err(w, http.StatusInternalServerError, "Gagal mengubah thumbnail")
                                return
                        }
                } else if err != pgx.ErrNoRows {
                        Err(w, http.StatusInternalServerError, "Gagal mengubah thumbnail")
                        return
                }
                // ErrNoRows = semua foto habis; tidak ada yang perlu dipromosikan.
        }
        if err := tx.Commit(ctx); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal menghapus foto")
                return
        }

        LogAudit(r, c.UserID, "DELETE_IMAGE", "product", productID, "hapus foto")
        OK(w, map[string]interface{}{"message": "Foto dihapus"})
}

// PUT /api/v1/images/{id}/thumb (OWNER/DEVELOPER) — jadikan thumbnail.
func SetImageThumb(w http.ResponseWriter, r *http.Request) {
        imageID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
        if err != nil {
                Err(w, http.StatusBadRequest, "ID foto tidak valid")
                return
        }

        outletID, ok := resolveScopeOutlet(w, r)
        if !ok {
                return
        }
        productID, ok := scopedImageProduct(r.Context(), imageID, outletID)
        if !ok {
                Err(w, http.StatusNotFound, "Foto tidak ditemukan")
                return
        }

        // Satu statement: semua foto produk ditandai ulang, hanya id ini
        // yang TRUE — atomik tanpa perlu transaksi eksplisit.
        if _, err := db.Pool.Exec(r.Context(),
                `UPDATE product_images SET is_thumb = (id = $2) WHERE product_id = $1`,
                productID, imageID); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal mengubah thumbnail")
                return
        }

        c := middleware.User(r)
        LogAudit(r, c.UserID, "SET_THUMB", "product", productID, "ganti thumbnail")
        OK(w, map[string]interface{}{"message": "Thumbnail diperbarui"})
}

type MoveImagePayload struct {
        Direction string `json:"direction"` // "left" | "right"
}

// PUT /api/v1/images/{id}/move (OWNER/DEVELOPER) — geser satu slot,
// lalu seluruh daftar dinomori ulang supaya sort_order tetap rapat
// (0..n-1) berapa pun riwayat hapusnya.
func MoveImage(w http.ResponseWriter, r *http.Request) {
        imageID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
        if err != nil {
                Err(w, http.StatusBadRequest, "ID foto tidak valid")
                return
        }
        var req MoveImagePayload
        if err := Decode(r, &req); err != nil {
                Err(w, http.StatusBadRequest, "Body request tidak valid")
                return
        }
        req.Direction = strings.ToLower(strings.TrimSpace(req.Direction))
        if req.Direction != "left" && req.Direction != "right" {
                Err(w, http.StatusBadRequest, "Direction harus left atau right")
                return
        }

        outletID, ok := resolveScopeOutlet(w, r)
        if !ok {
                return
        }
        productID, ok := scopedImageProduct(r.Context(), imageID, outletID)
        if !ok {
                Err(w, http.StatusNotFound, "Foto tidak ditemukan")
                return
        }

        rows, err := db.Pool.Query(r.Context(),
                `SELECT id FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC, created_at ASC`, productID)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal mengambil urutan foto")
                return
        }
        defer rows.Close()

        ids := []int64{}
        index := -1
        for rows.Next() {
                var id int64
                if err := rows.Scan(&id); err != nil {
                        Err(w, http.StatusInternalServerError, "Gagal membaca urutan foto")
                        return
                }
                if id == imageID {
                        index = len(ids)
                }
                ids = append(ids, id)
        }
        if err := rows.Err(); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal membaca urutan foto")
                return
        }

        target := index - 1
        if req.Direction == "right" {
                target = index + 1
        }
        if index == -1 || target < 0 || target >= len(ids) {
                // Sudah di tepi — tidak ada yang perlu digeser.
                OK(w, map[string]interface{}{"message": "Tidak ada perubahan"})
                return
        }
        ids[index], ids[target] = ids[target], ids[index]

        ctx := r.Context()
        tx, err := db.Pool.Begin(ctx)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal memulai transaksi")
                return
        }
        defer tx.Rollback(ctx)
        for i, id := range ids {
                if _, err := tx.Exec(ctx,
                        `UPDATE product_images SET sort_order = $2 WHERE id = $1`, id, i); err != nil {
                        Err(w, http.StatusInternalServerError, "Gagal mengubah urutan foto")
                        return
                }
        }
        if err := tx.Commit(ctx); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal mengubah urutan foto")
                return
        }

        c := middleware.User(r)
        LogAudit(r, c.UserID, "MOVE_IMAGE", "product", productID, "geser "+req.Direction)
        OK(w, map[string]interface{}{"message": "Urutan diperbarui"})
}
