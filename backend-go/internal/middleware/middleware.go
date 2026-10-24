package middleware

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/neuralforgeio/internal/auth"
	"github.com/neuralforgeio/internal/config"
	"github.com/neuralforgeio/internal/logger"
)

type ctxKey string

const (
	userKey ctxKey = "user"
	metaKey ctxKey = "logmeta"
)

// logMeta diisi selama request berjalan supaya logger tahu siapa pelakunya.
type logMeta struct {
	UserID   int64
	UserName string
	Role     string
	LoggedIn bool
}

// ClientIP mengambil IP asli pengunjung (mendukung proxy: X-Forwarded-For, X-Real-IP).
func ClientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		parts := strings.Split(fwd, ",")
		return strings.TrimSpace(parts[0])
	}
	if real := r.Header.Get("X-Real-IP"); real != "" {
		return strings.TrimSpace(real)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// respWriter membungkus ResponseWriter untuk bisa menangkap status code.
type respWriter struct {
	http.ResponseWriter
	status int
}

func (w *respWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

// JSON memastikan semua response bertipe application/json.
func JSON(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		next.ServeHTTP(w, r)
	})
}

// CORS mengizinkan frontend Next.js (localhost:3000) memanggil API ini.
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" &&
			(origin == config.ClientURL() ||
				strings.HasPrefix(origin, "http://localhost:") ||
				strings.HasPrefix(origin, "http://127.0.0.1:")) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Max-Age", "86400")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Logger mencatat SETIAP request lengkap: status, durasi, IP, dan user (kalau login).
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		meta := &logMeta{}
		rw := &respWriter{ResponseWriter: w, status: http.StatusOK}

		path := r.URL.Path
		if r.URL.RawQuery != "" {
			path += "?" + r.URL.RawQuery
		}

		next.ServeHTTP(rw, r.WithContext(context.WithValue(r.Context(), metaKey, meta)))

		userName := ""
		if meta.LoggedIn {
			userName = meta.UserName
		}

		logger.HTTPReq(logger.Entry{
			IP:         ClientIP(r),
			UserID:     meta.UserID,
			UserName:   userName,
			Method:     r.Method,
			Path:       path,
			Status:     rw.status,
			DurationMS: float64(time.Since(start).Microseconds()) / 1000.0,
		})
	})
}

// Recoverer menangkap panic agar server tidak mati.
func Recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				logger.Error("Panic di %s %s: %v", r.Method, r.URL.Path, err)
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte(`{"success":false,"error":{"message":"Terjadi kesalahan internal"}}`))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// RequireAuth memvalidasi header "Authorization: Bearer <token>".
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			writeError(w, http.StatusUnauthorized, "Token tidak ditemukan, silakan login")
			return
		}
		claims, err := auth.ParseToken(strings.TrimPrefix(header, "Bearer "))
		if err != nil {
			writeError(w, http.StatusUnauthorized, "Token tidak valid atau kedaluwarsa")
			return
		}
		// Catat identitas ke meta supaya baris log request ini tahu siapa pelakunya.
		if m, ok := r.Context().Value(metaKey).(*logMeta); ok {
			m.UserID = claims.UserID
			m.UserName = claims.Name
			m.Role = claims.Role
			m.LoggedIn = true
		}
		ctx := context.WithValue(r.Context(), userKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRole membatasi endpoint untuk role tertentu (mis. OWNER).
func RequireRole(role string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := User(r)
			if claims == nil || claims.Role != role {
				writeError(w, http.StatusForbidden, "Akses ditolak: khusus "+role)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// User mengambil identitas user dari context (hasil RequireAuth).
func User(r *http.Request) *auth.Claims {
	if c, ok := r.Context().Value(userKey).(*auth.Claims); ok {
		return c
	}
	return nil
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.WriteHeader(status)
	_, _ = w.Write(fmt.Appendf(nil, `{"success":false,"error":{"message":%q}}`, msg))
}

// RequireRoleIn membatasi endpoint untuk beberapa role sekaligus. Era
// pra-multi-outlet (backend-go 1.0.x): DEVELOPER diperlakukan setara
// OWNER di endpoint manajemen — restukturisasi 1.1.0 akan memisahkan
// keduanya kembali bersama konsep outlet.
func RequireRoleIn(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := User(r)
			if claims == nil {
				writeError(w, http.StatusForbidden, "Akses ditolak")
				return
			}
			for _, role := range roles {
				if claims.Role == role {
					next.ServeHTTP(w, r)
					return
				}
			}
			writeError(w, http.StatusForbidden, "Akses ditolak: khusus "+strings.Join(roles, "/"))
		})
	}
}
