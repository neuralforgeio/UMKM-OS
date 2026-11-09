package auth

import (
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
	jwt.RegisteredClaims
}

// GenerateToken membuat token HS256 yang berisi identitas user.
func GenerateToken(userID int64, name, email, role string) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID: userID,
		Name:   name,
		Email:  email,
		Role:   role,
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
