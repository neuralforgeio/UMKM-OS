package tests

import (
    "testing"

    "github.com/neuralforgeio/internal/auth"
)

// Uji lapisan password: hash bcrypt + verifikasi.

func TestHashPasswordBukanPlaintext(t *testing.T) {
    hash, err := auth.HashPassword("rahasia-warung-123")
    if err != nil {
        t.Fatalf("HashPassword error: %v", err)
    }
    if hash == "rahasia-warung-123" {
        t.Fatal("hash tidak boleh sama dengan password plain")
    }
    if len(hash) < 30 {
        t.Fatalf("hash terlalu pendek (%d karakter), sepertinya bukan bcrypt", len(hash))
    }
}

func TestHashPasswordSaltAcak(t *testing.T) {
    // bcrypt menyisipkan salt acak -> dua hash dari password yang sama
    // tidak boleh identik (kalau identik, salt-nya statis = bahaya).
    h1, err := auth.HashPassword("sandi-sama")
    if err != nil {
        t.Fatalf("HashPassword error: %v", err)
    }
    h2, err := auth.HashPassword("sandi-sama")
    if err != nil {
        t.Fatalf("HashPassword error: %v", err)
    }
    if h1 == h2 {
        t.Fatal("dua hash dari password yang sama harus berbeda (salt acak)")
    }
}

func TestCheckPasswordBenar(t *testing.T) {
    hash, err := auth.HashPassword("sandi-benar")
    if err != nil {
        t.Fatalf("HashPassword error: %v", err)
    }
    if !auth.CheckPassword(hash, "sandi-benar") {
        t.Fatal("password yang cocok harus lolos verifikasi")
    }
}

func TestCheckPasswordSalah(t *testing.T) {
    hash, err := auth.HashPassword("sandi-benar")
    if err != nil {
        t.Fatalf("HashPassword error: %v", err)
    }
    if auth.CheckPassword(hash, "sandi-salah") {
        t.Fatal("password yang berbeda tidak boleh lolos")
    }
    if auth.CheckPassword(hash, "") {
        t.Fatal("password kosong tidak boleh lolos")
    }
    if auth.CheckPassword("", "sandi-benar") {
        t.Fatal("hash kosong tidak boleh lolos")
    }
    if auth.CheckPassword("bukan-format-bcrypt", "sandi-benar") {
        t.Fatal("hash yang bukan bcrypt tidak boleh lolos")
    }
}
