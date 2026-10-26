package handler

import (
        "context"
        "io"
        "net/http"
        "strconv"
        "strings"
        "time"

        "github.com/neuralforgeio/internal/db"
        "github.com/neuralforgeio/internal/logger"
        "github.com/neuralforgeio/internal/middleware"
)

// =====================================================================
// PROFIL MANDIRI (v1.7.0) — semua peran (OWNER / CASHIER / DEVELOPER)
// mengelola akunnya sendiri lewat pintu /me, TERPISAH dari PUT /users/{id}
// milik konsol (yang memang menolak menyentuh akun DEVELOPER).
// Bedanya: /me HANYA bisa menyentuh baris pemanggil sendiri — role,
// is_active, outlet_id, dan akun orang lain tidak pernah tersentuh,
// jadi developer pun boleh mengganti nama/email/foto/password-nya
// tanpa membuka pintu eskalasi apa pun.
// =====================================================================

// MeResponse adalah bentuk data profil yang dikirim /auth/me, /auth/login,
// dan PUT /me — supaya frontend punya SATU kontrak untuk identitas.
type MeResponse struct {
        ID           int64      `json:"id"`
        Name         string     `json:"name"`
        Email        string     `json:"email"`
        Role         string     `json:"role"`
        OutletID     *int64     `json:"outlet_id"`
        OutletName   *string    `json:"outlet_name"`
        PhotoVersion int        `json:"photo_version"` // 0 = belum ada foto
        IsActive     bool       `json:"is_active"`
        CreatedAt    time.Time  `json:"created_at"`
}

// loadMe memuat profil lengkap pemanggil (nama, email, ikatan outlet +
// nama outletnya, versi foto). Dipakai Me, UpdateMe, dan upload foto
// supaya semua respons berbentuk sama.
func loadMe(ctx context.Context, userID int64) (*MeResponse, error) {
        var m MeResponse
        err := db.Pool.QueryRow(ctx, `
        SELECT u.id, u.name, u.email, u.role, u.outlet_id, o.name,
               COALESCE(u.photo_version, 0), u.is_active, u.created_at
        FROM users u
        LEFT JOIN outlets o ON o.id = u.outlet_id
        WHERE u.id = $1 AND u.deleted_at IS NULL`, userID,
        ).Scan(&m.ID, &m.Name, &m.Email, &m.Role, &m.OutletID, &m.OutletName,
                &m.PhotoVersion, &m.IsActive, &m.CreatedAt)
        if err != nil {
                return nil, err
        }
        return &m, nil
}

type UpdateMePayload struct {
        Name  *string `json:"name"`
        Email *string `json:"email"`
}

// PUT /api/v1/me — ganti nama dan/atau email sendiri (v1.7.0).
//
// Validasi: nama tidak boleh kosong, email harus unik di antara akun hidup,
// dan email yang tidak berubah tidak boleh menabrak cek kembar sendiri.
// Password TIDAK ada di sini — jalurnya tetap POST /auth/change-password
// yang memeriksa password lama. Role/outlet/aktif memang tidak tersentuh:
// itu urusan konsol, bukan profil pribadi.
func UpdateMe(w http.ResponseWriter, r *http.Request) {
        c := middleware.User(r)
        var req UpdateMePayload
        if err := Decode(r, &req); err != nil {
                Err(w, http.StatusBadRequest, "Body request tidak valid")
                return
        }

        var name, email *string
        if req.Name != nil {
                v := strings.TrimSpace(*req.Name)
                if v == "" {
                        Err(w, http.StatusBadRequest, "Nama tidak boleh kosong")
                        return
                }
                if len(v) > 100 {
                        Err(w, http.StatusBadRequest, "Nama maksimal 100 karakter")
                        return
                }
                name = &v
        }
        if req.Email != nil {
                v := strings.TrimSpace(strings.ToLower(*req.Email))
                if v == "" || !strings.Contains(v, "@") || len(v) > 200 {
                        Err(w, http.StatusBadRequest, "Email tidak valid")
                        return
                }
                email = &v
        }
        if name == nil && email == nil {
                Err(w, http.StatusBadRequest, "Tidak ada perubahan yang dikirim")
                return
        }

        if email != nil {
                var exists bool
                if err := db.Pool.QueryRow(r.Context(),
                        `SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email) = $1 AND id <> $2 AND deleted_at IS NULL)`,
                        *email, c.UserID).Scan(&exists); err != nil {
                        Err(w, http.StatusInternalServerError, "Gagal memeriksa email")
                        return
                }
                if exists {
                        Err(w, http.StatusConflict, "Email sudah dipakai akun lain")
                        return
                }
        }

        if _, err := db.Pool.Exec(r.Context(), `
        UPDATE users SET
            name = COALESCE($1, name),
            email = COALESCE($2, email),
            updated_at = NOW()
        WHERE id = $3 AND deleted_at IS NULL`,
                name, email, c.UserID); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal menyimpan profil")
                return
        }

        m, err := loadMe(r.Context(), c.UserID)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal memuat profil")
                return
        }

        changes := []string{}
        if name != nil {
                changes = append(changes, "nama")
        }
        if email != nil {
                changes = append(changes, "email")
        }
        LogAudit(r, c.UserID, "UPDATE_PROFILE", "user", c.UserID, m.Email+" — "+strings.Join(changes, ", "))
        logger.Success("Profil diperbarui mandiri: user #%d (%s) ip=%s", c.UserID, m.Email, middleware.ClientIP(r))
        OK(w, m)
}

// GET /api/v1/me/photo — menyajikan foto profil PEMANGGIL SENDIRI
// (v1.7.0). Tidak seperti logo outlet & foto produk yang publik karena
// struk membacanya tanpa login, foto wajah staf bersifat pribadi:
// hanya pemilik sesi yang boleh mengunduhnya. Frontend mem-proxynya
// lewat route /api/user/photo yang memeriksa sesi lalu memanggil
// endpoint ini dengan Bearer token — browser tidak pernah melihat
// alamat Go, dan foto orang lain tidak pernah bisa diminta.
func ServeMyPhoto(w http.ResponseWriter, r *http.Request) {
        c := middleware.User(r)

        var mimeType string
        var data []byte
        if err := db.Pool.QueryRow(r.Context(),
                `SELECT photo_mime_type, photo_data FROM users WHERE id = $1 AND deleted_at IS NULL`, c.UserID,
        ).Scan(&mimeType, &data); err != nil || len(data) == 0 {
                Err(w, http.StatusNotFound, "Foto profil belum diunggah")
                return
        }

        w.Header().Set("Content-Type", mimeType)
        w.Header().Set("Content-Length", strconv.Itoa(len(data)))
        if r.URL.Query().Get("v") != "" {
                w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
        } else {
                w.Header().Set("Cache-Control", "private, max-age=300")
        }
        w.WriteHeader(http.StatusOK)
        _, _ = w.Write(data)
}

// POST /api/v1/me/photo — unggah foto profil sendiri (multipart "file"),
// maks 3 MB, JPEG/PNG/WebP (konstanta yang sama dengan foto produk).
// photo_version naik satu tiap unggahan — semua <img ?v=N> konsumen
// (navbar, halaman profil) langsung cache-bust.
func UploadMyPhoto(w http.ResponseWriter, r *http.Request) {
        c := middleware.User(r)

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
                Err(w, http.StatusBadRequest, "Tipe berkas harus JPEG, PNG, atau WebP")
                return
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

        var version int
        if err := db.Pool.QueryRow(r.Context(), `
        UPDATE users
        SET photo_mime_type = $2, photo_data = $3,
            photo_version = COALESCE(photo_version, 0) + 1,
            updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING photo_version`, c.UserID, mimeType, bytes).Scan(&version); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal menyimpan foto")
                return
        }

        LogAudit(r, c.UserID, "UPLOAD_PROFILE_PHOTO", "user", c.UserID,
                "foto baru v"+strconv.Itoa(version)+" ("+mimeType+")")
        OK(w, map[string]interface{}{
                "photo_version": version,
                "message":       "Foto profil diperbarui",
        })
}

// DELETE /api/v1/me/photo — hapus foto sendiri; versi tetap dinaikkan
// supaya konsumen yang memegang URL lama tidak menampilkan bayangan foto
// dari cache.
func DeleteMyPhoto(w http.ResponseWriter, r *http.Request) {
        c := middleware.User(r)

        var version int
        if err := db.Pool.QueryRow(r.Context(), `
        UPDATE users
        SET photo_mime_type = NULL, photo_data = NULL,
            photo_version = COALESCE(photo_version, 0) + 1,
            updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING photo_version`, c.UserID).Scan(&version); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal menghapus foto")
                return
        }

        LogAudit(r, c.UserID, "DELETE_PROFILE_PHOTO", "user", c.UserID, "")
        OK(w, map[string]interface{}{
                "photo_version": version,
                "message":       "Foto profil dihapus",
        })
}
