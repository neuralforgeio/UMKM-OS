package config

import (
        "os"
        "strconv"

        "github.com/joho/godotenv"
)

// AppVersion mengikuti Semantic Versioning: MAJOR.MINOR.PATCH
// 1.1.0 = fitur: endpoint /reports/dashboard lengkap untuk dashboard
// owner & halaman peluncur (hari ini/kemarin, grafik 7 hari, metode
// pembayaran, produk terlaris, stok menipis, transaksi terbaru) +
// hardening seed owner (password acak bila OWNER_PASSWORD kosong).
const AppVersion = "1.1.0"

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
func OwnerEmail() string { return Get("OWNER_EMAIL", "owner@umkm.local") }

// OwnerPassword TIDAK punya default: repo ini publik, password apa pun
// yang tertulis di kode langsung menjadi pintu belakang. Bila env kosong
// dan database masih baru, seedOwner membuat password acak 16 karakter
// yang dicetak SEKALI ke layar konsol (tidak pernah masuk file log).
func OwnerPassword() string { return Get("OWNER_PASSWORD", "") }

// Akun DEVELOPER (konsol lintas outlet): TIDAK ADA kredensial default —
// repo ini publik, password apa pun yang tertulis di kode langsung
// menjadi pintu belakang. Akun hanya dibuat saat boot bila keduanya
// diatur di backend-go/.env (file itu sudah di-gitignore):
//
//      DEVELOPER_EMAIL=dev@warunganda.id
//      DEVELOPER_PASSWORD=password-kuat-pilihan-anda
//
// Setelah akun dibuat, ganti password selanjutnya lewat menu ganti
// password biasa (login memakai hash di database, bukan env).
func DeveloperEmail() string    { return Get("DEVELOPER_EMAIL", "") }
func DeveloperPassword() string { return Get("DEVELOPER_PASSWORD", "") }
