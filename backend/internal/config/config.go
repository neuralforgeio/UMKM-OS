package config

import (
        "os"
        "strconv"

        "github.com/joho/godotenv"
)

// AppVersion mengikuti Semantic Versioning: MAJOR.MINOR.PATCH.
// 2.0.0 = ERA GO MURNI: layanan Python (FastAPI + Prophet) dihapus
// total; OSCAR (asisten AI dwi-mode), OSCAR Developer AI (laporan
// lintas toko ber-PIN + pelaporan proaktif), audit ber-IP + geo
// lookup, dan ramalan statistik kini hidup DI DALAM backend Go ini.
// backend-go di-rename menjadi backend — satu-satunya backend.
// 2.0.1 = HOTFIX pra-rilis publik: tag JSON /reports/profit diseragamkan
// snake_case (dulu camelCase sementara frontend membaca snake_case —
// akar kartu laba NaN di halaman Transaksi), dan VERSIONS.csv kini
// dikirim utuh oleh skrip pemasangan run-3.
const AppVersion = "2.0.1"

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
func JWTSecret() string    { return Get("JWT_SECRET", "umkm-os-dev-secret") }
func JWTExpiresHours() int { return GetInt("JWT_EXPIRES_H", 24) }
func ClientURL() string    { return Get("CLIENT_URL", "http://localhost:3000") }
func OwnerEmail() string   { return Get("OWNER_EMAIL", "owner@umkm.local") }

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

// ===== ERA GO MURNI: konfigurasi OSCAR + AI Developer (eks ml-service) =====

// InternalAPIKey: gerbang antar-layanan (blueprint BAB 5.4) — dipakai
// frontend (X-Internal-Key) untuk memanggil endpoint asisten/ramalan
// Go. Default mewarisi AUTH_SECRET root (satu tempat rotasi).
func InternalAPIKey() string { return Get("INTERNAL_API_KEY", Get("JWT_SECRET", "")) }

func LLMEnabled() bool { return Get("LLM_ENABLED", "true") == "true" }
func LLMBaseURL() string {
        return Get("LLM_BASE_URL", "https://api.groq.com/openai/v1")
}
func LLMAPIKey() string   { return Get("LLM_API_KEY", "") }
func LLMModel() string    { return Get("LLM_MODEL", "openai/gpt-oss-20b") }

// AssistantRateLimitPerHour: batas laju sliding-window per pemilik
// (default 12/jam — blueprint BAB 9.3).
func AssistantRateLimitPerHour() int { return GetInt("ASSISTANT_RATE_LIMIT_PER_HOUR", 12) }

// AssistantCacheSeconds: TTL cache jawaban per user+outlet+pertanyaan
// (default 600 detik).
func AssistantCacheSeconds() int { return GetInt("ASSISTANT_CACHE_SECONDS", 600) }

// DevAIRateLimitPerHour: batas laju khusus endpoint AI Developer
// (default 6/jam — laporan lintas toko jauh lebih berat dari chat).
func DevAIRateLimitPerHour() int { return GetInt("DEV_AI_RATE_LIMIT_PER_HOUR", 6) }

// GeoLookupEnabled: enrich IP audit log dengan kota/kota negara via
// layanan ip-api.com (default aktif; matikan bila ingin tanpa trafik
// keluar sama sekali).
func GeoLookupEnabled() bool { return Get("GEO_LOOKUP_ENABLED", "true") == "true" }

// AIDataDir: volume tempat llm_config.json + dev_config.json +
// dev_reports.json (eks volume mlmodels; di compose: aidata:/app/aidata).
func AIDataDir() string { return Get("AI_DATA_DIR", "aidata") }
