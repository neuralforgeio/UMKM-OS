package middleware

// Unittest gerbang antar-layanan X-Internal-Key (era Go murni):
// kunci cocok = lolos; kunci salah/absen = 401 dengan detail gaya
// FastAPI (kontrak frontend tidak berubah); kosong = pintu terbuka dev.

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func TestRequireInternalKey(t *testing.T) {
	lamaI, adaI := os.LookupEnv("INTERNAL_API_KEY")
	lamaJ, adaJ := os.LookupEnv("JWT_SECRET")
	defer func() {
		restore(t, "INTERNAL_API_KEY", lamaI, adaI)
		restore(t, "JWT_SECRET", lamaJ, adaJ)
	}()

	terima := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	kasus := []struct {
		nama    string
		env     string
		header  string
		ingin   int
	}{
		{"kunci cocok", "rahasia-123", "rahasia-123", http.StatusOK},
		{"kunci salah", "rahasia-123", "salah", http.StatusUnauthorized},
		{"tanpa header", "rahasia-123", "", http.StatusUnauthorized},
		{"env kosong pintu terbuka", "", "apa-saja", http.StatusOK},
	}
	for _, k := range kasus {
		t.Run(k.nama, func(t *testing.T) {
			os.Setenv("INTERNAL_API_KEY", k.env)
			os.Unsetenv("JWT_SECRET")
			req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/chat", nil)
			if k.header != "" {
				req.Header.Set("X-Internal-Key", k.header)
			}
			rec := httptest.NewRecorder()
			RequireInternalKey(terima).ServeHTTP(rec, req)
			if rec.Code != k.ingin {
				t.Fatalf("status = %d; ingin %d", rec.Code, k.ingin)
			}
			if k.ingin == http.StatusUnauthorized {
				body := rec.Body.String()
				if !strings.Contains(body, "X-Internal-Key tidak sah") {
					t.Errorf("galat harus memakai field detail: %s", body)
				}
			}
		})
	}
}

func TestRequireInternalKeyWarisiJWTSecret(t *testing.T) {
	os.Unsetenv("INTERNAL_API_KEY")
	os.Setenv("JWT_SECRET", "akar-rahasia")
	defer os.Unsetenv("JWT_SECRET")
	req := httptest.NewRequest(http.MethodGet, "/api/v1/forecast/revenue", nil)
	req.Header.Set("X-Internal-Key", "akar-rahasia")
	rec := httptest.NewRecorder()
	terima := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	RequireInternalKey(terima).ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("INTERNAL_API_KEY kosong harus mewarisi JWT_SECRET: %d", rec.Code)
	}
}

func restore(t *testing.T, kunci, nilai string, ada bool) {
	t.Helper()
	if ada {
		os.Setenv(kunci, nilai)
	} else {
		os.Unsetenv(kunci)
	}
}
