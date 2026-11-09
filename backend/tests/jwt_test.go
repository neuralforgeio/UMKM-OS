package tests

import (
	"testing"

	"github.com/golang-jwt/jwt/v5"

	"github.com/neuralforgeio/internal/auth"
)

// Semua test JWT memakai secret & masa hidup sendiri lewat t.Setenv,
// jadi hasilnya pasti sama di mesin mana pun (tidak tergantung .env).

func TestTokenBolakBalik(t *testing.T) {
	t.Setenv("JWT_SECRET", "secret-khusus-unit-test")
	t.Setenv("JWT_EXPIRES_H", "1")

	token, err := auth.GenerateToken(7, "Budi Santoso", "budi@warung.id", "OWNER")
	if err != nil {
		t.Fatalf("GenerateToken error: %v", err)
	}
	claims, err := auth.ParseToken(token)
	if err != nil {
		t.Fatalf("ParseToken error: %v", err)
	}
	if claims.UserID != 7 {
		t.Fatalf("UserID = %d, want 7", claims.UserID)
	}
	if claims.Name != "Budi Santoso" {
		t.Fatalf("Name = %q, want \"Budi Santoso\"", claims.Name)
	}
	if claims.Email != "budi@warung.id" {
		t.Fatalf("Email = %q, want \"budi@warung.id\"", claims.Email)
	}
	if claims.Role != "OWNER" {
		t.Fatalf("Role = %q, want OWNER", claims.Role)
	}
	if claims.Subject != "7" {
		t.Fatalf("Subject = %q, want \"7\"", claims.Subject)
	}
	if claims.Issuer != "umkm-os-backend" {
		t.Fatalf("Issuer = %q, want \"umkm-os-backend\"", claims.Issuer)
	}
}

func TestTokenKedaluwarsaDitolak(t *testing.T) {
	t.Setenv("JWT_SECRET", "secret-khusus-unit-test")
	t.Setenv("JWT_EXPIRES_H", "-1") // masa hidup negatif = langsung kedaluwarsa

	token, err := auth.GenerateToken(1, "Sari", "sari@warung.id", "KASIR")
	if err != nil {
		t.Fatalf("GenerateToken error: %v", err)
	}
	if _, err := auth.ParseToken(token); err == nil {
		t.Fatal("token kedaluwarsa harus ditolak ParseToken")
	}
}

func TestTokenSecretBedaDitolak(t *testing.T) {
	t.Setenv("JWT_SECRET", "secret-alpha")
	t.Setenv("JWT_EXPIRES_H", "1")

	token, err := auth.GenerateToken(2, "Sari", "sari@warung.id", "KASIR")
	if err != nil {
		t.Fatalf("GenerateToken error: %v", err)
	}

	// token dibuat dengan secret-alpha, divalidasi dengan secret-beta
	t.Setenv("JWT_SECRET", "secret-beta")
	if _, err := auth.ParseToken(token); err == nil {
		t.Fatal("token yang ditandatangani secret lain harus ditolak")
	}
}

func TestTokenSampahDitolak(t *testing.T) {
	t.Setenv("JWT_SECRET", "secret-khusus-unit-test")
	t.Setenv("JWT_EXPIRES_H", "1")

	sampah := []string{
		"",
		"bukan-jwt",
		"a.b.c",
		"bearer salah-format",
		"eyJhbGciOiJIUzI1NiJ9.e30.",
	}
	for _, s := range sampah {
		if _, err := auth.ParseToken(s); err == nil {
			t.Fatalf("token sampah %q harus ditolak", s)
		}
	}
}

func TestTokenAlgoNoneDitolak(t *testing.T) {
	// Serangan klasik JWT: token "alg: none" tanpa signature.
	// ParseToken hanya boleh menerima HMAC (HS256).
	t.Setenv("JWT_SECRET", "secret-khusus-unit-test")

	tok := jwt.NewWithClaims(jwt.SigningMethodNone, &auth.Claims{
		UserID: 99,
		Name:   "Penyerang",
		Email:  "attacker@jahat.id",
		Role:   "DEVELOPER",
	})
	signed, err := tok.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("gagal membuat token none untuk uji: %v", err)
	}
	if _, err := auth.ParseToken(signed); err == nil {
		t.Fatal("token alg none harus ditolak (hanya HMAC yang diizinkan)")
	}
}
