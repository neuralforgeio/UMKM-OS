package handler

import (
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
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

// GET /api/v1/users (OWNER)
func ListUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Pool.Query(r.Context(),
		`SELECT id, name, email, role, is_active, created_at FROM users ORDER BY id ASC`)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal mengambil data user")
		return
	}
	defer rows.Close()

	users := []UserResponse{}
	for rows.Next() {
		var u UserResponse
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt); err != nil {
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

// POST /api/v1/users (OWNER) — bikin akun kasir/owner baru
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
	Name     string `json:"name"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	IsActive *bool  `json:"is_active"`
	Password string `json:"password"` // opsional: isi kalau mau reset password user ini
}

// PUT /api/v1/users/{id} (OWNER)
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
	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Role = strings.ToUpper(strings.TrimSpace(req.Role))

	if req.Name == "" || req.Email == "" {
		Err(w, http.StatusBadRequest, "Nama dan email wajib diisi")
		return
	}
	if req.Role != "CASHIER" && req.Role != "OWNER" {
		Err(w, http.StatusBadRequest, "Role harus OWNER atau CASHIER")
		return
	}

	c := middleware.User(r)
	if c.UserID == id && (req.Role != c.Role || (req.IsActive != nil && !*req.IsActive)) {
		Err(w, http.StatusBadRequest, "Tidak boleh mengubah role atau menonaktifkan akun sendiri")
		return
	}

	var exists bool
	if err := db.Pool.QueryRow(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email) = $1 AND id <> $2)`,
		req.Email, id).Scan(&exists); err != nil {
		Err(w, http.StatusInternalServerError, "Gagal memeriksa email")
		return
	}
	if exists {
		Err(w, http.StatusConflict, "Email sudah dipakai user lain")
		return
	}

	query := `
        UPDATE users SET
            name = $1, email = $2, role = $3,
            is_active = COALESCE($4, is_active),
            updated_at = NOW()`
	args := []interface{}{req.Name, req.Email, req.Role, req.IsActive}

	if req.Password != "" {
		if len(req.Password) < 6 {
			Err(w, http.StatusBadRequest, "Password minimal 6 karakter")
			return
		}
		hash, err := auth.HashPassword(req.Password)
		if err != nil {
			Err(w, http.StatusInternalServerError, "Gagal memproses password")
			return
		}
		query += `, password_hash = $5`
		args = append(args, hash)
	}

	query += ` WHERE id = $` + strconv.Itoa(len(args)+1) + `
        RETURNING id, name, email, role, is_active, created_at`
	args = append(args, id)

	var u UserResponse
	if err := db.Pool.QueryRow(r.Context(), query, args...).
		Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt); err != nil {
		Err(w, http.StatusNotFound, "User tidak ditemukan")
		return
	}

	LogAudit(r, c.UserID, "UPDATE_USER", "user", u.ID, u.Email)
	OK(w, u)
}

// DELETE /api/v1/users/{id} (OWNER) — soft delete (nonaktifkan)
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

	tag, err := db.Pool.Exec(r.Context(),
		`UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, id)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal menonaktifkan user")
		return
	}
	if tag.RowsAffected() == 0 {
		Err(w, http.StatusNotFound, "User tidak ditemukan")
		return
	}

	LogAudit(r, c.UserID, "DELETE_USER", "user", id, "nonaktifkan akun")
	OK(w, map[string]interface{}{"message": "User dinonaktifkan"})
}
