package handler

import (
	"context"
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
	IsActive  bool
	DeletedAt *time.Time
}

func loadUserTarget(ctx context.Context, id int64) (*userTarget, error) {
	var u userTarget
	err := db.Pool.QueryRow(ctx,
		`SELECT id, email, role, is_active, deleted_at FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.Email, &u.Role, &u.IsActive, &u.DeletedAt)
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
// =====================================================================
func ListUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Pool.Query(r.Context(), `
    SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
           (SELECT MAX(t.created_at) FROM transactions t WHERE t.cashier_id = u.id)
    FROM users u
    WHERE u.deleted_at IS NULL
    ORDER BY u.id ASC`)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal mengambil data user")
		return
	}
	defer rows.Close()

	users := []UserResponse{}
	for rows.Next() {
		var u UserResponse
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt,
			&u.LastTransactionAt); err != nil {
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
}

// POST /api/v1/users (OWNER / DEVELOPER) — bikin akun kasir/owner baru.
// Akun terhapus tidak menghalangi: email lama mereka sudah ditukar saat
// dihapus (lihat DeleteUser), jadi email aslinya bebas dipakai ulang.
func CreateUser(w http.ResponseWriter, r *http.Request) {
	var req UserPayload
	if err := Decode(r, &req); err != nil {
		Err(w, http.StatusBadRequest, "Body request tidak valid")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Role = strings.ToUpper(strings.TrimSpace(req.Role))

	if req.Name == "" || req.Email == "" {
		Err(w, http.StatusBadRequest, "Nama dan email wajib diisi")
		return
	}
	if len(req.Password) < 6 {
		Err(w, http.StatusBadRequest, "Password minimal 6 karakter")
		return
	}
	if req.Role != "CASHIER" && req.Role != "OWNER" {
		Err(w, http.StatusBadRequest, "Role harus OWNER atau CASHIER")
		return
	}

	var exists bool
	if err := db.Pool.QueryRow(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email) = $1)`, req.Email).Scan(&exists); err != nil {
		Err(w, http.StatusInternalServerError, "Gagal memeriksa email")
		return
	}
	if exists {
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
    INSERT INTO users (name, email, password_hash, role)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, email, role, is_active, created_at`,
		req.Name, req.Email, hash, req.Role,
	).Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membuat user")
		return
	}

	c := middleware.User(r)
	LogAudit(r, c.UserID, "CREATE_USER", "user", u.ID, u.Email+" role="+u.Role)
	Created(w, u)
}

type UserUpdatePayload struct {
	Name     *string `json:"name"`
	Email    *string `json:"email"`
	Role     *string `json:"role"`
	IsActive *bool   `json:"is_active"`
	Password string  `json:"password"` // opsional: isi kalau mau reset password akun ini
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
			Err(w, http.StatusBadRequest, "Role harus OWNER atau CASHIER")
			return
		}
		role = &v
	}

	var hash *string
	if req.Password != "" {
		if len(req.Password) < 6 {
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

	if name == nil && email == nil && role == nil && req.IsActive == nil && hash == nil {
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
	var u UserResponse
	err = db.Pool.QueryRow(ctx, `
    UPDATE users SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        role = COALESCE($3, role),
        is_active = COALESCE($4, is_active),
        password_hash = COALESCE($5, password_hash),
        updated_at = NOW()
    WHERE id = $6 AND deleted_at IS NULL
    RETURNING id, name, email, role, is_active, created_at`,
		name, email, role, req.IsActive, hash, id,
	).Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt)
	if err != nil {
		Err(w, http.StatusNotFound, "User tidak ditemukan")
		return
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
