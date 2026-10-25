package tests

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/neuralforgeio/internal/auth"
    "github.com/neuralforgeio/internal/middleware"
)

// Catatan umum: test di file ini TIDAK butuh database. Test yang
// memicu penulisan log (Recoverer, Logger) mengarahkan LOG_DIR ke
// folder sementara supaya repo tetap bersih.

func TestClientIP(t *testing.T) {
    kasus := []struct {
        nama     string
        forward  string
        realIP   string
        remote   string
        expected string
    }{
        // di belakang proxy: ambil IP pertama dari X-Forwarded-For
        {"x-forwarded-for berisi daftar", "203.0.113.7, 70.41.3.18", "", "10.0.0.1:5555", "203.0.113.7"},
        {"x-real-ip", "", "198.51.100.9", "10.0.0.1:5555", "198.51.100.9"},
        // tanpa header proxy: bongkar RemoteAddr
        {"fallback remote addr", "", "", "192.0.2.4:1234", "192.0.2.4"},
        {"remote addr tanpa port", "", "", "192.0.2.5", "192.0.2.5"},
    }
    for _, k := range kasus {
        t.Run(k.nama, func(t *testing.T) {
            r := httptest.NewRequest(http.MethodGet, "/", nil)
            r.RemoteAddr = k.remote
            if k.forward != "" {
                r.Header.Set("X-Forwarded-For", k.forward)
            }
            if k.realIP != "" {
                r.Header.Set("X-Real-IP", k.realIP)
            }
            if got := middleware.ClientIP(r); got != k.expected {
                t.Fatalf("ClientIP = %q, want %q", got, k.expected)
            }
        })
    }
}

func TestJSONMiddlewareSetContentType(t *testing.T) {
    h := middleware.JSON(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
    }))
    w := httptest.NewRecorder()
    h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/", nil))

    if ct := w.Header().Get("Content-Type"); ct != "application/json" {
        t.Fatalf("Content-Type = %q, want \"application/json\"", ct)
    }
}

func TestCORSOriginClientURL(t *testing.T) {
    t.Setenv("CLIENT_URL", "http://localhost:3100")
    h := middleware.CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
    }))

    r := httptest.NewRequest(http.MethodGet, "/", nil)
    r.Header.Set("Origin", "http://localhost:3100")
    w := httptest.NewRecorder()
    h.ServeHTTP(w, r)

    if got := w.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3100" {
        t.Fatalf("Access-Control-Allow-Origin = %q, harus menggemakan origin", got)
    }
    if got := w.Header().Get("Vary"); got != "Origin" {
        t.Fatalf("Vary = %q, want \"Origin\"", got)
    }
}

func TestCORSOriginLocalhostLainTetapLolos(t *testing.T) {
    // port dev frontend sering berganti (3000, 3001, ...) — aturan
    // prefix localhost sengaja longgar untuk dev lokal
    t.Setenv("CLIENT_URL", "http://localhost:3100")
    h := middleware.CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))

    r := httptest.NewRequest(http.MethodGet, "/", nil)
    r.Header.Set("Origin", "http://127.0.0.1:51733")
    w := httptest.NewRecorder()
    h.ServeHTTP(w, r)

    if got := w.Header().Get("Access-Control-Allow-Origin"); got != "http://127.0.0.1:51733" {
        t.Fatalf("Access-Control-Allow-Origin = %q, origin localhost lain harus diizinkan", got)
    }
}

func TestCORSPreflight(t *testing.T) {
    t.Setenv("CLIENT_URL", "http://localhost:3100")
    h := middleware.CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        t.Fatal("preflight OPTIONS tidak boleh diteruskan ke handler")
    }))

    r := httptest.NewRequest(http.MethodOptions, "/", nil)
    r.Header.Set("Origin", "http://localhost:3100")
    w := httptest.NewRecorder()
    h.ServeHTTP(w, r)

    if w.Code != http.StatusNoContent {
        t.Fatalf("status preflight = %d, want 204", w.Code)
    }
    if w.Body.Len() != 0 {
        t.Fatalf("body preflight harus kosong, isinya: %q", w.Body.String())
    }
    if got := w.Header().Get("Access-Control-Allow-Methods"); got != "GET, POST, PUT, DELETE, OPTIONS" {
        t.Fatalf("Access-Control-Allow-Methods = %q, tidak sesuai", got)
    }
}

func TestCORSOriginAsingTidakDiberiHeader(t *testing.T) {
    t.Setenv("CLIENT_URL", "http://localhost:3100")
    h := middleware.CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))

    r := httptest.NewRequest(http.MethodGet, "/", nil)
    r.Header.Set("Origin", "http://situs-jahat.example")
    w := httptest.NewRecorder()
    h.ServeHTTP(w, r)

    if got := w.Header().Get("Access-Control-Allow-Origin"); got != "" {
        t.Fatalf("origin asing tidak boleh mendapat header ACAO, dapat %q", got)
    }
}

func TestRequireAuthTanpaToken(t *testing.T) {
    h := middleware.RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        t.Fatal("request tanpa token tidak boleh sampai ke handler")
    }))
    w := httptest.NewRecorder()
    h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/", nil))

    if w.Code != http.StatusUnauthorized {
        t.Fatalf("status = %d, want 401", w.Code)
    }
    var env struct {
        Success bool `json:"success"`
        Error   struct {
            Message string `json:"message"`
        } `json:"error"`
    }
    if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
        t.Fatalf("body 401 bukan JSON valid: %v", err)
    }
    if env.Success || env.Error.Message == "" {
        t.Fatalf("sampul error tidak benar: %+v", env)
    }
}

func TestRequireAuthTokenSampah(t *testing.T) {
    t.Setenv("JWT_SECRET", "secret-khusus-unit-test")
    h := middleware.RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        t.Fatal("token sampah tidak boleh sampai ke handler")
    }))

    r := httptest.NewRequest(http.MethodGet, "/", nil)
    r.Header.Set("Authorization", "Bearer bukan-token-json")
    w := httptest.NewRecorder()
    h.ServeHTTP(w, r)

    if w.Code != http.StatusUnauthorized {
        t.Fatalf("status = %d, want 401", w.Code)
    }
}

func TestRequireAuthTokenValid(t *testing.T) {
    t.Setenv("JWT_SECRET", "secret-khusus-unit-test")
    t.Setenv("JWT_EXPIRES_H", "1")

    token, err := auth.GenerateToken(11, "Rina", "rina@warung.id", "KASIR")
    if err != nil {
        t.Fatalf("GenerateToken error: %v", err)
    }

    var tangkap *auth.Claims
    h := middleware.RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        tangkap = middleware.User(r)
        w.WriteHeader(http.StatusOK)
    }))

    r := httptest.NewRequest(http.MethodGet, "/", nil)
    r.Header.Set("Authorization", "Bearer "+token)
    w := httptest.NewRecorder()
    h.ServeHTTP(w, r)

    if w.Code != http.StatusOK {
        t.Fatalf("status = %d, want 200", w.Code)
    }
    if tangkap == nil {
        t.Fatal("User(r) harus mengembalikan claims untuk token valid")
    }
    if tangkap.UserID != 11 || tangkap.Role != "KASIR" || tangkap.Email != "rina@warung.id" {
        t.Fatalf("claims tidak cocok: %+v", tangkap)
    }
}

// reqBerToken membuat request ber-header Authorization dengan token
// sungguhan untuk peran tertentu — persis hasil login di produksi.
func reqBerToken(t *testing.T, role string) *http.Request {
    t.Helper()
    token, err := auth.GenerateToken(3, "Sari", "sari@warung.id", role)
    if err != nil {
        t.Fatalf("GenerateToken error: %v", err)
    }
    r := httptest.NewRequest(http.MethodGet, "/", nil)
    r.Header.Set("Authorization", "Bearer "+token)
    return r
}

func TestRequireRole(t *testing.T) {
    t.Setenv("JWT_SECRET", "secret-khusus-unit-test")
    t.Setenv("JWT_EXPIRES_H", "1")

    tereksekusi := false
    // rantai persis seperti wiring produksi di main.go: token divalidasi
    // RequireAuth dulu, baru perannya diperiksa RequireRole.
    h := middleware.RequireAuth(middleware.RequireRole("OWNER")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        tereksekusi = true
    })))

    t.Run("kasir ditolak", func(t *testing.T) {
        tereksekusi = false
        w := httptest.NewRecorder()
        h.ServeHTTP(w, reqBerToken(t, "KASIR"))
        if w.Code != http.StatusForbidden || tereksekusi {
            t.Fatalf("status = %d, handler jalan = %v — kasir harus ditolak 403", w.Code, tereksekusi)
        }
    })
    t.Run("owner lolos", func(t *testing.T) {
        tereksekusi = false
        w := httptest.NewRecorder()
        h.ServeHTTP(w, reqBerToken(t, "OWNER"))
        if w.Code != http.StatusOK || !tereksekusi {
            t.Fatalf("status = %d, handler jalan = %v — owner harus lolos", w.Code, tereksekusi)
        }
    })
    t.Run("tanpa token ditolak lebih awal", func(t *testing.T) {
        tereksekusi = false
        w := httptest.NewRecorder()
        h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/", nil))
        if w.Code != http.StatusUnauthorized || tereksekusi {
            t.Fatalf("status = %d — request tanpa token harus 401 dari RequireAuth", w.Code)
        }
    })
}

func TestRequireRoleIn(t *testing.T) {
    t.Setenv("JWT_SECRET", "secret-khusus-unit-test")
    t.Setenv("JWT_EXPIRES_H", "1")

    tereksekusi := false
    h := middleware.RequireAuth(middleware.RequireRoleIn("OWNER", "DEVELOPER")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        tereksekusi = true
    })))

    t.Run("developer lolos", func(t *testing.T) {
        tereksekusi = false
        w := httptest.NewRecorder()
        h.ServeHTTP(w, reqBerToken(t, "DEVELOPER"))
        if w.Code != http.StatusOK || !tereksekusi {
            t.Fatalf("status = %d — developer harus lolos", w.Code)
        }
    })
    t.Run("kasir ditolak", func(t *testing.T) {
        tereksekusi = false
        w := httptest.NewRecorder()
        h.ServeHTTP(w, reqBerToken(t, "KASIR"))
        if w.Code != http.StatusForbidden || tereksekusi {
            t.Fatalf("status = %d — kasir harus ditolak", w.Code)
        }
    })
}

func TestRecovererMenangkapPanic(t *testing.T) {
    t.Setenv("LOG_DIR", t.TempDir()) // error-nya dicatat logger — arahkan ke folder sementara

    h := middleware.Recoverer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        panic("simulasi bug di handler")
    }))
    w := httptest.NewRecorder()
    h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/", nil))

    if w.Code != http.StatusInternalServerError {
        t.Fatalf("status = %d, want 500", w.Code)
    }
    var env struct {
        Success bool `json:"success"`
        Error   struct {
            Message string `json:"message"`
        } `json:"error"`
    }
    if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
        t.Fatalf("body panic bukan JSON valid: %v", err)
    }
    if env.Success {
        t.Fatal("response panic harus berupa sampul error")
    }
}

func TestLoggerMeloloskanRequest(t *testing.T) {
    t.Setenv("LOG_DIR", t.TempDir())

    h := middleware.Logger(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusNotFound) // sengaja 404: cek status tercatat & diteruskan
    }))
    w := httptest.NewRecorder()
    h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/halaman-tidak-ada", nil))

    if w.Code != http.StatusNotFound {
        t.Fatalf("status = %d, want 404 diteruskan apa adanya", w.Code)
    }
}
