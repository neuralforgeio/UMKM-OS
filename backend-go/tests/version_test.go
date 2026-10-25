package tests

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/neuralforgeio/internal/config"
    "github.com/neuralforgeio/internal/handler"
)

// Health dan Version adalah satu-satunya handler yang 100% bebas
// database — cocok jadi penjaga kontrak publik API.

func TestHealth(t *testing.T) {
    w := httptest.NewRecorder()
    handler.Health(w, httptest.NewRequest(http.MethodGet, "/health", nil))

    if w.Code != http.StatusOK {
        t.Fatalf("status = %d, want 200", w.Code)
    }
    var env handler.Envelope
    if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
        t.Fatalf("response bukan JSON valid: %v", err)
    }
    if !env.Success {
        t.Fatalf("success = false, harus true")
    }
    data, ok := env.Data.(map[string]interface{})
    if !ok {
        t.Fatalf("data bukan objek: %T", env.Data)
    }
    if data["status"] != "ok" {
        t.Fatalf("status = %v, want \"ok\"", data["status"])
    }
    if data["service"] != "umkm-os-backend" {
        t.Fatalf("service = %v, want \"umkm-os-backend\"", data["service"])
    }
}

func TestVersionSinkronDenganKonstanta(t *testing.T) {
    // Endpoint /version dibaca halaman Settings frontend; angkanya
    // harus selalu sama dengan konstanta AppVersion di kode (dan
    // dengan baris terakhir VERSIONS.csv).
    w := httptest.NewRecorder()
    handler.Version(w, httptest.NewRequest(http.MethodGet, "/api/v1/version", nil))

    if w.Code != http.StatusOK {
        t.Fatalf("status = %d, want 200", w.Code)
    }
    var env handler.Envelope
    if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
        t.Fatalf("response bukan JSON valid: %v", err)
    }
    data, ok := env.Data.(map[string]interface{})
    if !ok {
        t.Fatalf("data bukan objek: %T", env.Data)
    }
    if data["component"] != "backend-go" {
        t.Fatalf("component = %v, want \"backend-go\"", data["component"])
    }
    if data["service"] != "UMKM-OS Backend API" {
        t.Fatalf("service = %v, want \"UMKM-OS Backend API\"", data["service"])
    }
    if data["version"] != config.AppVersion {
        t.Fatalf("version endpoint = %v, konstanta AppVersion = %s — keduanya harus sinkron",
            data["version"], config.AppVersion)
    }
}
