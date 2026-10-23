package config

import (
        "os"
        "strconv"

        "github.com/joho/godotenv"
)

// AppVersion mengikuti Semantic Versioning: MAJOR.MINOR.PATCH
// 1.0.1 = hotfix: urutan migrasi schema (ALTER sebelum INDEX), akun
// developer tanpa kredensial default, gerakan stok penjualan terikat
// nomor struk, role DEVELOPER melihat semua transaksi.
const AppVersion = "1.0.1"

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
        return Get("DATABASE_URL", "postgres://umkm:umkmindo45@localhost:5432/umkmos?sslmode=disable")
}
func JWTSecret() string     { return Get("JWT_SECRET", "umkm-os-dev-secret") }
func JWTExpiresHours() int  { return GetInt("JWT_EXPIRES_H", 24) }
func ClientURL() string     { return Get("CLIENT_URL", "http://localhost:3000") }
func OwnerEmail() string    { return Get("OWNER_EMAIL", "owner@umkm.local") }
func OwnerPassword() string { return Get("OWNER_PASSWORD", "owner123") }

// Akun DEVELOPER (konsol lintas outlet): TIDAK ADA kredensial default —
// repo ini publik, password apa pun yang tertulis di kode langsung
// menjadi pintu belakang. Akun hanya dibuat saat boot bila keduanya
// diatur di backend-go/.env (file itu sudah di-gitignore):
//
//	DEVELOPER_EMAIL=dev@warunganda.id
//	DEVELOPER_PASSWORD=password-kuat-pilihan-anda
//
// Setelah akun dibuat, ganti password selanjutnya lewat menu ganti
// password biasa (login memakai hash di database, bukan env).
func DeveloperEmail() string    { return Get("DEVELOPER_EMAIL", "") }
func DeveloperPassword() string { return Get("DEVELOPER_PASSWORD", "") }
