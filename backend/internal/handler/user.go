package handler

import (
        "context"
        "errors"
        "fmt"
        "net/http"
        "strconv"
        "strings"
        "time"

        "github.com/go-chi/chi/v5"

        "github.com/neuralforgeio/internal/auth"
        "github.com/neuralforgeio/internal/db"
        "github.com/neuralforgeio/internal/middleware"
)

type UserResponse struct {
        ID                int64      `json:"id"`
        Name              string     `json:"name"`
        Email             string     `json:"email"`
        Role              string     `json:"role"`
        OutletID          *int64     `json:"outlet_id"`   // null = tanpa ikatan (owner/developer)
        OutletName        *string    `json:"outlet_name"` // nama outlet ikatan, null bila bebas
        IsActive          bool       `json:"is_active"`
        CreatedAt         time.Time  `json:"created_at"`
        LastTransactionAt *time.Time `json:"last_transaction_at"` // null = belum pernah jualan
}

// lastTransactionAt melengkapi respons dengan waktu transaksi TERAKHIR
// yang dibuat akun ini sebagai kasir — info "terakhir jualan kapan" di
// konsol akun. Gagal membaca bukan error: cukup null.
func lastTransactionAt(ctx context.Context, userID int64) *time.Time {
        var t *time.Time
        _ = db.Pool.QueryRow(ctx,
                `SELECT MAX(created_at) FROM transactions WHERE cashier_id = $1`, userID).Scan(&t)
        return t
}

// userTarget memuat baris users utuh (termasuk deleted_at) untuk guard
// internal para handler — dipakai supaya akun terhapus tidak pernah bisa
// diubah/dihapus dua kali.
type userTarget struct {
        ID        int64
        Email     string
        Role      string
        OutletID  *int64
        IsActive  bool
        DeletedAt *time.Time
}

func loadUserTarget(ctx context.Context, id int64) (*userTarget, error) {
        var u userTarget
        err := db.Pool.QueryRow(ctx,
                `SELECT id, email, role, outlet_id, is_active, deleted_at FROM users WHERE id = $1`, id,
        ).Scan(&u.ID, &u.Email, &u.Role, &u.OutletID, &u.IsActive, &u.DeletedAt)
        if err != nil {
                return nil, err
        }
        return &u, nil
}

// =====================================================================
// GET /api/v1/users (OWNER / DEVELOPER)
//
// v1.3.0: akun terhapus (deleted_at) tidak pernah tampil lagi; kolom
// last_transaction_at ikut dibawa untuk info aktivitas kasir.
// v1.5.0: ?outlet_id= memfilter daftar ke akun yang terikat outlet itu
// (dipakai drill-down outlet konsol dev). Tanpa parameter = semua akun.
// =====================================================================
func ListUsers(w http.ResponseWriter, r *http.Request) {
        where := "u.deleted_at IS NULL"
        args := []interface{}{}

        if v := strings.TrimSpace(r.URL.Query().Get("outlet_id")); v != "" {
                if id, err := strconv.ParseInt(v, 10, 64); err == nil && id > 0 {
                        args = append(args, id)
                        where += fmt.Sprintf(" AND u.outlet_id = $%d", len(args))
                }
        }

        rows, err := db.Pool.Query(r.Context(), fmt.Sprintf(`
    SELECT u.id, u.name, u.email, u.role, u.outlet_id, o.name,
           u.is_active, u.created_at,
           (SELECT MAX(t.created_at) FROM transactions t WHERE t.cashier_id = u.id)
    FROM users u
    LEFT JOIN outlets o ON o.id = u.outlet_id
    WHERE %s
    ORDER BY u.created_at DESC, u.id DESC`, where), args...)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal mengambil data user")
                return
        }
        defer rows.Close()

        users := []UserResponse{}
        for rows.Next() {
                var u UserResponse
                if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.OutletID, &u.OutletName,
                        &u.IsActive, &u.CreatedAt, &u.LastTransactionAt); err != nil {
                        Err(w, http.StatusInternalServerError, "Gagal membaca data user")
                        return
                }
                users = append(users, u)
        }
        if err := rows.Err(); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal membaca data user")
                return
        }
        OK(w, users)
}

type UserPayload struct {
        Name     string `json:"name"`
        Email    string `json:"email"`
        Password string `json:"password"`
        Role     string `json:"role"`
        // >0 = terikat outlet itu; null/0 = tanpa ikatan (khusus OWNER —
        // KASIR ditolak tanpa ikatan oleh resolveUserOutlet).
        OutletID *int64 `json:"outlet_id"`
}

// resolveUserOutlet memvalidasi ikatan outlet sebuah akun: KASIR wajib
// terikat ke outlet yang benar-benar ada; OWNER boleh bebas (akses semua
// outlet); DEVELOPER tidak pernah diikat (konsol lintas outlet).
func resolveUserOutlet(ctx context.Context, role string, outletID *int64) (*int64, error) {
        bound := outletID != nil && *outletID > 0
        if !bound {
                if role == "CASHIER" {
                        return nil, errors.New("Kasir wajib terikat ke satu outlet.")
                }
                return nil, nil
        }
        var exists bool
        if err := db.Pool.QueryRow(ctx,
                `SELECT EXISTS(SELECT 1 FROM outlets WHERE id = $1)`, *outletID).Scan(&exists); err != nil {
                return nil, errors.New("Gagal memeriksa outlet.")
        }
        if !exists {
                return nil, errors.New("Outlet tidak ditemukan.")
        }
        return outletID, nil
}

// POST /api/v1/users (OWNER / DEVELOPER) — bikin akun kasir/owner baru.
// Akun terhapus tidak menghalangi: email lama mereka sudah ditukar saat
// dihapus (lihat DeleteUser), jadi email aslinya bebas dipakai ulang.
func CreateUser(w http.ResponseWriter, r *http.Request) {
        c := middleware.User(r)
        var req UserPayload
        if err := Decode(r, &req); err != nil {
                Err(w, http.StatusBadRequest, "Body request tidak valid")
                return
        }
        req.Name = strings.TrimSpace(req.Name)
        req.Email = strings.TrimSpace(strings.ToLower(req.Email))
        req.Role = strings.ToUpper(strings.TrimSpace(req.Role))

        fail := func(reason string) {
                LogAudit(r, c.UserID, "CREATE_USER_FAILED", "user", 0, reason)
        }
        if req.Name == "" || req.Email == "" {
                fail("nama atau email kosong")
                Err(w, http.StatusBadRequest, "Nama dan email wajib diisi")
                return
        }
        if len(req.Password) < 6 {
                fail("password kurang dari 6 karakter")
                Err(w, http.StatusBadRequest, "Password minimal 6 karakter")
                return
        }
        if req.Role != "CASHIER" && req.Role != "OWNER" {
                fail("role tidak sah: " + req.Role)
                Err(w, http.StatusBadRequest, "Role harus OWNER atau CASHIER")
                return
        }
        outletID, err := resolveUserOutlet(r.Context(), req.Role, req.OutletID)
        if err != nil {
                fail(err.Error())
                Err(w, http.StatusBadRequest, err.Error())
                return
        }

        var exists bool

        if err := db.Pool.QueryRow(r.Context(),
                `SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email) = $1)`, req.Email).Scan(&exists); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal memeriksa email")
                return
        }
        if exists {
                fail("email sudah terdaftar: " + req.Email)
                Err(w, http.StatusConflict, "Email sudah terdaftar")
                return
        }

        hash, err := auth.HashPassword(req.Password)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal memproses password")
                return
        }

        var u UserResponse
        err = db.Pool.QueryRow(r.Context(), `
    INSERT INTO users (name, email, password_hash, role, outlet_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, name, email, role, outlet_id, is_active, created_at`,
                req.Name, req.Email, hash, req.Role, outletID,
        ).Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.OutletID, &u.IsActive, &u.CreatedAt)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal membuat user")
                return
        }

        LogAudit(r, c.UserID, "CREATE_USER", "user", u.ID, u.Email+" role="+u.Role)
        Created(w, u)
}

type UserUpdatePayload struct {
        Name     *string `json:"name"`
        Email    *string `json:"email"`
        Role     *string `json:"role"`
        IsActive *bool   `json:"is_active"`
        Password string  `json:"password"` // opsional: isi kalau mau reset password akun ini
        // OutletID (v1.4.0): nil = tidak diubah; 0 = LEPAS ikatan outlet;
        // >0 = ikat ke outlet itu. Sentinel 0 dibutuhkan karena JSON null
        // pada patch parsial berarti "jangan sentuh field ini".
        OutletID *int64 `json:"outlet_id"`
}

// PUT /api/v1/users/{id} (OWNER / DEVELOPER) — pembaruan PARSIAL (v1.3.0):
// hanya field yang dikirim yang diubah. Konsol dev memakai ini untuk reset
// password ({"password": "..."}) dan toggle aktif ({"is_active": false})
// tanpa harus mengirim ulang seluruh formulir — inilah ujung tombol yang
// menutup bug "reset password konsol dev tidak pernah sampai ke akun
// login" era split-brain Prisma.
func UpdateUser(w http.ResponseWriter, r *http.Request) {
        id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
        if err != nil {
                Err(w, http.StatusBadRequest, "ID user tidak valid")
                return
        }
        var req UserUpdatePayload
        if err := Decode(r, &req); err != nil {
                Err(w, http.StatusBadRequest, "Body request tidak valid")
                return
        }

        c := middleware.User(r)
        ctx := r.Context()

        // Target harus ada dan belum terhapus.
        target, err := loadUserTarget(ctx, id)
        if err != nil || target.DeletedAt != nil {
                Err(w, http.StatusNotFound, "User tidak ditemukan")
                return
        }
        // Akun DEVELOPER tidak pernah disentuh konsol: jalurnya hanya
        // DEVELOPER_EMAIL & DEVELOPER_PASSWORD di .env (repo publik —
        // pintu ke peran tertinggi tidak boleh ada di aplikasi).
        if target.Role == "DEVELOPER" {
                LogAudit(r, c.UserID, "UPDATE_USER_FAILED", "user", id,
                        "menolak ubah akun DEVELOPER dari konsol")
                Err(w, http.StatusBadRequest,
                        "Akun developer hanya dikelola lewat DEVELOPER_EMAIL & DEVELOPER_PASSWORD di .env — bukan konsol.")
                return
        }

        fail := func(reason string) {
                LogAudit(r, c.UserID, "UPDATE_USER_FAILED", "user", id, reason)
        }

        // Normalisasi + validasi tiap field yang dikirim.
        var name, email, role *string
        if req.Name != nil {
                v := strings.TrimSpace(*req.Name)
                if v == "" {
                        Err(w, http.StatusBadRequest, "Nama tidak boleh kosong")
                        return
                }
                name = &v
        }
        if req.Email != nil {
                v := strings.TrimSpace(strings.ToLower(*req.Email))
                if v == "" {
                        Err(w, http.StatusBadRequest, "Email tidak boleh kosong")
                        return
                }
                email = &v
        }
        if req.Role != nil {
                v := strings.ToUpper(strings.TrimSpace(*req.Role))
                if v != "CASHIER" && v != "OWNER" {
                        fail("role tidak sah: " + v)
                        Err(w, http.StatusBadRequest, "Role harus OWNER atau CASHIER")
                        return
                }
                role = &v
        }

        // Ikatan outlet (v1.4.0): sentinel 0 = lepas, >0 = ikat.
        // KASIR hasil akhir wajib terikat — dicek SETELAH role digabung.
        var outletID *int64
        if req.OutletID != nil {
                v := *req.OutletID
                if v > 0 {
                        if _, err := resolveUserOutlet(ctx, "OWNER", &v); err != nil {
                                fail(err.Error())
                                Err(w, http.StatusBadRequest, err.Error())
                                return
                        }
                        outletID = &v
                } else {
                        zero := int64(0)
                        outletID = &zero
                }
        }
        finalRole := target.Role
        if role != nil {
                finalRole = *role
        }
        finalOutlet := target.OutletID
        if outletID != nil {
                if *outletID > 0 {
                        finalOutlet = outletID
                } else {
                        finalOutlet = nil
                }
        }
        if finalRole == "CASHIER" && finalOutlet == nil {
                fail("kasir wajib terikat ke satu outlet")
                Err(w, http.StatusBadRequest, "Kasir wajib terikat ke satu outlet.")
                return
        }

        var hash *string
        if req.Password != "" {
                if len(req.Password) < 6 {
                        fail("password kurang dari 6 karakter")
                        Err(w, http.StatusBadRequest, "Password minimal 6 karakter")
                        return
                }
                h, err := auth.HashPassword(req.Password)
                if err != nil {
                        Err(w, http.StatusInternalServerError, "Gagal memproses password")
                        return
                }
                hash = &h
        }

        if name == nil && email == nil && role == nil && req.IsActive == nil && hash == nil && outletID == nil {
                Err(w, http.StatusBadRequest, "Tidak ada perubahan yang dikirim")
                return
        }

        // Guard akun sendiri: role tidak boleh berubah, akun tidak boleh
        // dinonaktifkan sendiri (pintu keluar manajemen jangan ditutup).
        if c.UserID == id {
                if role != nil && *role != target.Role {
                        Err(w, http.StatusBadRequest, "Tidak boleh mengubah role akun sendiri")
                        return
                }
                if req.IsActive != nil && !*req.IsActive {
                        Err(w, http.StatusBadRequest, "Tidak boleh menonaktifkan akun sendiri")
                        return
                }
        }

        if email != nil {
                var exists bool
                if err := db.Pool.QueryRow(ctx,
                        `SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email) = $1 AND id <> $2 AND deleted_at IS NULL)`,
                        *email, id).Scan(&exists); err != nil {
                        Err(w, http.StatusInternalServerError, "Gagal memeriksa email")
                        return
                }
                if exists {
                        Err(w, http.StatusConflict, "Email sudah dipakai user lain")
                        return
                }
        }

        // SATU UPDATE dengan COALESCE: field yang NULL (tidak dikirim)
        // mempertahankan nilai lama — tidak ada race antara baca dan tulis.
        // outlet_id: NULL arg = biarkan; CASE menangkap sentinel 0 = lepas.
        var u UserResponse
        err = db.Pool.QueryRow(ctx, `
    UPDATE users SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        role = COALESCE($3, role),
        is_active = COALESCE($4, is_active),
        password_hash = COALESCE($5, password_hash),
        outlet_id = CASE WHEN $7 THEN NULL ELSE COALESCE($6, outlet_id) END,
        updated_at = NOW()
    WHERE id = $8 AND deleted_at IS NULL
    RETURNING id, name, email, role, outlet_id, is_active, created_at`,
                name, email, role, req.IsActive, hash, outletID, outletID != nil && *outletID == 0, id,
        ).Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.OutletID, &u.IsActive, &u.CreatedAt)
        if err != nil {
                Err(w, http.StatusNotFound, "User tidak ditemukan")
                return
        }
        if u.OutletID != nil {
                var outletName string
                if err := db.Pool.QueryRow(ctx,
                        `SELECT name FROM outlets WHERE id = $1`, *u.OutletID).Scan(&outletName); err == nil {
                        u.OutletName = &outletName
                }
        }
        u.LastTransactionAt = lastTransactionAt(ctx, u.ID)

        changes := []string{}
        if name != nil {
                changes = append(changes, "nama")
        }
        if email != nil {
                changes = append(changes, "email")
        }
        if role != nil {
                changes = append(changes, "role="+u.Role)
        }
        if outletID != nil {
                if *outletID > 0 && u.OutletName != nil {
                        changes = append(changes, "outlet → "+*u.OutletName)
                } else {
                        changes = append(changes, "outlet → (semua outlet)")
                }
        }
        if req.IsActive != nil {
                if *req.IsActive {
                        changes = append(changes, "aktivasi")
                } else {
                        changes = append(changes, "nonaktifkan")
                }
        }
        if hash != nil {
                changes = append(changes, "RESET PASSWORD")
        }
        LogAudit(r, c.UserID, "UPDATE_USER", "user", u.ID, u.Email+" — "+strings.Join(changes, ", "))
        OK(w, u)
}

// =====================================================================
// DELETE /api/v1/users/{id} (OWNER / DEVELOPER) — HAPUS LEMBUT (v1.3.0).
//
// Baris TIDAK pernah dibuang fisik: kolom deleted_at diisi supaya akun
// hilang dari daftar selamanya, sementara email aslinya DIBEBASKAN
// (ditukar menjadi deleted+<id>+<epoch>@umkm-os.invalid) supaya bisa
// dipakai ulang oleh akun baru. Transaksi lama yang dikasirnya tetap
// utuh — jejak penjualan tidak boleh kehilangan nama kasirnya, dan
// kode hash password ikut tersimpan supaya akun terhapus tidak bisa
// "dihidupkan" kembali lewat pintu belakang.
// =====================================================================
func DeleteUser(w http.ResponseWriter, r *http.Request) {
        id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
        if err != nil {
                Err(w, http.StatusBadRequest, "ID user tidak valid")
                return
        }
        c := middleware.User(r)
        if c.UserID == id {
                Err(w, http.StatusBadRequest, "Tidak bisa menghapus akun sendiri")
                return
        }
        target, err := loadUserTarget(r.Context(), id)
        if err != nil || target.DeletedAt != nil {
                Err(w, http.StatusNotFound, "User tidak ditemukan atau sudah terhapus sebelumnya")
                return
        }
        if target.Role == "DEVELOPER" {
                LogAudit(r, c.UserID, "DELETE_USER_FAILED", "user", id,
                        "menolak hapus akun DEVELOPER dari konsol")
                Err(w, http.StatusBadRequest,
                        "Akun developer tidak bisa dihapus dari konsol — kelola lewat .env deployment.")
                return
        }

        tag, err := db.Pool.Exec(r.Context(), `
        UPDATE users SET
            deleted_at = NOW(),
            is_active = FALSE,
            updated_at = NOW(),
            email = 'deleted+' || id::text || '+' || (EXTRACT(EPOCH FROM NOW())*1000)::bigint::text || '@umkm-os.invalid'
        WHERE id = $1 AND deleted_at IS NULL`, id)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal menghapus user")
                return
        }
        if tag.RowsAffected() == 0 {
                Err(w, http.StatusNotFound, "User tidak ditemukan atau sudah terhapus sebelumnya")
                return
        }

        LogAudit(r, c.UserID, "DELETE_USER", "user", id,
                "hapus lembut — email dibebaskan untuk dipakai ulang")
        OK(w, map[string]interface{}{
                "message": "Akun dihapus (disimpan sebagai arsip untuk jejak audit)",
        })
}
