package tests

import (
    "net/http"
    "net/http/httptest"
    "strings"
    "testing"

    "github.com/neuralforgeio/internal/handler"
)

// Uji cabang validasi Login & ChangePassword yang dieksekusi SEBELUM
// sentuhan database — jadi bisa diuji tanpa Postgres nyala.

func TestLoginValidasiInput(t *testing.T) {
    kasus := []struct {
        nama string
        body string
    }{
        {"body bukan json", `bukan-json`},
        {"email kosong", `{"email":"","password":"rahasia"}`},
        {"password kosong", `{"email":"owner@umkm.local","password":""}`},
        {"keduanya kosong", `{"email":"","password":""}`},
    }
    for _, k := range kasus {
        t.Run(k.nama, func(t *testing.T) {
            r := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", strings.NewReader(k.body))
            w := httptest.NewRecorder()
            handler.Login(w, r)
            if w.Code != http.StatusBadRequest {
                t.Fatalf("status = %d, want 400 untuk kasus %q", w.Code, k.nama)
            }
        })
    }
}

func TestChangePasswordValidasiPanjang(t *testing.T) {
    // password baru di bawah 6 karakter harus ditolak di lapisan
    // validasi (lantai minimum di sisi backend)
    r := httptest.NewRequest(http.MethodPost, "/api/v1/auth/change-password", strings.NewReader(
        `{"current_password":"yang-lama","new_password":"123"}`))
    w := httptest.NewRecorder()
    handler.ChangePassword(w, r)
    if w.Code != http.StatusBadRequest {
        t.Fatalf("status = %d, want 400", w.Code)
    }
}

func TestChangePasswordBodyRusak(t *testing.T) {
    r := httptest.NewRequest(http.MethodPost, "/api/v1/auth/change-password", strings.NewReader(`{rusak`))
    w := httptest.NewRecorder()
    handler.ChangePassword(w, r)
    if w.Code != http.StatusBadRequest {
        t.Fatalf("status = %d, want 400", w.Code)
    }
}
