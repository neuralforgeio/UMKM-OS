package handler

import (
        "errors"
        "net/http"

        "github.com/jackc/pgx/v5"

        "github.com/neuralforgeio/internal/auth"
        "github.com/neuralforgeio/internal/db"
        "github.com/neuralforgeio/internal/logger"
        "github.com/neuralforgeio/internal/middleware"
)

type LoginRequest struct {
        Email    string `json:"email"`
        Password string `json:"password"`
}

// POST /api/v1/auth/login
func Login(w http.ResponseWriter, r *http.Request) {
        ip := middleware.ClientIP(r)

        var req LoginRequest
        if err := Decode(r, &req); err != nil {
                Err(w, http.StatusBadRequest, "Body request tidak valid")
                return
        }
        if req.Email == "" || req.Password == "" {
                Err(w, http.StatusBadRequest, "Email dan password wajib diisi")
                return
        }

        var id int64
        var name, email, hash, role string
        var isActive bool
        var outletID *int64
        err := db.Pool.QueryRow(r.Context(),
                `SELECT id, name, email, password_hash, role, is_active, outlet_id FROM users WHERE LOWER(email) = LOWER($1)`,
                req.Email,
        ).Scan(&id, &name, &email, &hash, &role, &isActive, &outletID)
        if err != nil {
                if errors.Is(err, pgx.ErrNoRows) {
                        logger.Warn("Login gagal: email=%s ip=%s alasan=email tidak terdaftar", req.Email, ip)
                } else {
                        logger.Error("Login gagal: email=%s ip=%s alasan=kesalahan database: %v", req.Email, ip, err)
                }
                Err(w, http.StatusUnauthorized, "Email atau password salah")
                return
        }
        if !auth.CheckPassword(hash, req.Password) {
                logger.Warn("Login gagal: email=%s ip=%s alasan=password salah", req.Email, ip)
                Err(w, http.StatusUnauthorized, "Email atau password salah")
                return
        }
        if !isActive {
                logger.Warn("Login gagal: email=%s ip=%s alasan=akun dinonaktifkan", req.Email, ip)
                Err(w, http.StatusForbidden, "Akun dinonaktifkan, hubungi owner")
                return
        }

        token, err := auth.GenerateToken(id, name, email, role)
        if err != nil {
                logger.Error("Gagal membuat token untuk user #%d: %v", id, err)
                Err(w, http.StatusInternalServerError, "Gagal membuat token")
                return
        }

        LogAudit(r, id, "LOGIN", "user", id, "")

        logger.Success("Login berhasil: %s (user #%d, role=%s) ip=%s", email, id, role, ip)

        OK(w, map[string]interface{}{
                "token": token,
                "user": map[string]interface{}{
                        "id": id, "name": name, "email": email, "role": role,
                        // v1.5.0: ikatan outlet ikut terkirim supaya sesi frontend
                        // tahu konteks outlet sejak detik pertama login.
                        "outlet_id": outletID,
                },
        })
}

// GET /api/v1/auth/me
func Me(w http.ResponseWriter, r *http.Request) {
        c := middleware.User(r)
        var name, email, role string
        var isActive bool
        var outletID *int64
        if err := db.Pool.QueryRow(r.Context(),
                `SELECT name, email, role, is_active, outlet_id FROM users WHERE id = $1`, c.UserID,
        ).Scan(&name, &email, &role, &isActive, &outletID); err != nil {
                Err(w, http.StatusUnauthorized, "User tidak ditemukan")
                return
        }
        if !isActive {
                Err(w, http.StatusForbidden, "Akun dinonaktifkan")
                return
        }
        OK(w, map[string]interface{}{
                "id": c.UserID, "name": name, "email": email, "role": role,
                // v1.5.0: re-check sesi frontend menyinkronkan re-bind outlet
                // tanpa menunggu login ulang.
                "outlet_id": outletID,
        })
}

type ChangePasswordRequest struct {
        CurrentPassword string `json:"current_password"`
        NewPassword     string `json:"new_password"`
}

// POST /api/v1/auth/change-password
func ChangePassword(w http.ResponseWriter, r *http.Request) {
        c := middleware.User(r)
        var req ChangePasswordRequest
        if err := Decode(r, &req); err != nil {
                Err(w, http.StatusBadRequest, "Body request tidak valid")
                return
        }
        if len(req.NewPassword) < 6 {
                Err(w, http.StatusBadRequest, "Password baru minimal 6 karakter")
                return
        }

        var hash string
        if err := db.Pool.QueryRow(r.Context(),
                `SELECT password_hash FROM users WHERE id = $1`, c.UserID).Scan(&hash); err != nil {
                Err(w, http.StatusUnauthorized, "User tidak ditemukan")
                return
        }
        if !auth.CheckPassword(hash, req.CurrentPassword) {
                Err(w, http.StatusBadRequest, "Password saat ini salah")
                return
        }

        newHash, err := auth.HashPassword(req.NewPassword)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal memproses password")
                return
        }
        if _, err := db.Pool.Exec(r.Context(),
                `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
                newHash, c.UserID); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal menyimpan password")
                return
        }

        LogAudit(r, c.UserID, "CHANGE_PASSWORD", "user", c.UserID, "")
        logger.Success("Password diganti: user #%d (%s) ip=%s", c.UserID, c.Email, middleware.ClientIP(r))
        OK(w, map[string]interface{}{"message": "Password berhasil diganti"})
}
