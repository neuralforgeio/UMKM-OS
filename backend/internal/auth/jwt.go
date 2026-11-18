package auth

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/neuralforgeio/internal/config"
)

// Claims = data yang "digendung" di dalam token JWT.
type Claims struct {
	UserID int64  `json:"user_id"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	// SessionID (v2.2.0 Gerbang Developer): pengenal acak sesi login
	// yang barisnya hidup di tabel sessions. Token klasik tak bisa
	// ditarik sebelum kadaluarsa; dengan sid, RequireAuth cukup
	// memeriksa barisnya masih hidup - menendang sesi dari konsol
	// developer mencabut token secara instan.
	SessionID string `json:"sid,omitempty"`
	jwt.RegisteredClaims
}

// SidBaru: 16 byte acak dienkodeks heksadesimal (32 karakter) —
// cukup unik untuk sesi login, tidak bisa ditebak dari token lain.
func SidBaru() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		// crypto/rand tidak boleh gagal di Linux; fallback waktu
		// tetap memberi keunikan praktis untuk sesi.
		return fmt.Sprintf("%x%d", time.Now().UnixNano(), time.Now().Unix())
	}
	return hex.EncodeToString(b)
}

// GenerateToken membuat token HS256 yang berisi identitas user.
func GenerateToken(userID int64, name, email, role string) (string, error) {
	return GenerateTokenSession(userID, name, email, role, "")
}

// GenerateTokenSession (v2.2.0): GenerateToken + sid sesi. Dipisah
// agar pemanggil lama (uji unit tanpa DB) tetap sederhana.
func GenerateTokenSession(userID int64, name, email, role, sid string) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:    userID,
		Name:      name,
		Email:     email,
		Role:      role,
		SessionID: sid,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   fmt.Sprintf("%d", userID),
			Issuer:    "umkm-os-backend",
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(config.JWTExpiresHours()) * time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.JWTSecret()))
}

// ParseToken memvalidasi token dan mengeluulkan Claims-nya.
func ParseToken(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("metode signature tidak valid")
		}
		return []byte(config.JWTSecret()), nil
	})
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("token tidak valid")
	}
	return claims, nil
}
