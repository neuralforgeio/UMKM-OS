package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// AppVersion mengikuti Semantic Versioning: MAJOR.MINOR.PATCH
// 1.0.0 = rilis awal integrasi backend Go
const AppVersion = "1.0.0"

func init() {
	_ = godotenv.Load()
}

func Get(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func GetInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

func Port() string { return Get("PORT", "8080") }
func DatabaseURL() string {
	return Get("DATABASE_URL", "postgres://umkm:umkm@localhost:5432/umkmos?sslmode=disable")
}
func JWTSecret() string     { return Get("JWT_SECRET", "umkm-os-dev-secret") }
func JWTExpiresHours() int  { return GetInt("JWT_EXPIRES_H", 24) }
func ClientURL() string     { return Get("CLIENT_URL", "http://localhost:3000") }
func OwnerEmail() string    { return Get("OWNER_EMAIL", "owner@umkm.local") }
func OwnerPassword() string { return Get("OWNER_PASSWORD", "owner123") }
