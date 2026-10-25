package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/neuralforgeio/internal/handler"
)

// Uji bentuk sampul response JSON yang dipakai SELURUH endpoint:
// sukses -> {"success":true,"data":...}
// gagal  -> {"success":false,"error":{"message":"..."}}
// Frontend mengandalkan kontrak bentuk ini, jadi tidak boleh bergeser.

func TestOKMembungkusData(t *testing.T) {
	w := httptest.NewRecorder()
	handler.OK(w, map[string]string{"pesan": "halo"})

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var body map[string]json.RawMessage
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("response bukan JSON valid: %v", err)
	}
	if string(body["success"]) != "true" {
		t.Fatalf("success = %s, want true", body["success"])
	}
	if _, ok := body["data"]; !ok {
		t.Fatal("field data harus ada saat sukses")
	}
	if _, ok := body["error"]; ok {
		t.Fatal("field error tidak boleh muncul saat sukses")
	}
}

func TestCreatedStatus201(t *testing.T) {
	w := httptest.NewRecorder()
	handler.Created(w, map[string]int{"id": 1})

	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201", w.Code)
	}
	var body map[string]json.RawMessage
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("response bukan JSON valid: %v", err)
	}
	if string(body["success"]) != "true" {
		t.Fatalf("success = %s, want true", body["success"])
	}
}

func TestErrMembungkusPesan(t *testing.T) {
	w := httptest.NewRecorder()
	handler.Err(w, http.StatusBadRequest, "Email dan password wajib diisi")

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", w.Code)
	}
	var body map[string]json.RawMessage
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("response bukan JSON valid: %v", err)
	}
	if string(body["success"]) != "false" {
		t.Fatalf("success = %s, want false", body["success"])
	}
	if _, ok := body["data"]; ok {
		t.Fatal("field data tidak boleh muncul saat gagal")
	}
	var apiErr struct {
		Message string `json:"message"`
	}
	if err := json.Unmarshal(body["error"], &apiErr); err != nil {
		t.Fatalf("field error tidak berbentuk benar: %v", err)
	}
	if apiErr.Message != "Email dan password wajib diisi" {
		t.Fatalf("error.message = %q, tidak sesuai pesan yang dikirim", apiErr.Message)
	}
}

func TestDecodeBodyValid(t *testing.T) {
	r := httptest.NewRequest(http.MethodPost, "/uji", strings.NewReader(
		`{"email":"owner@umkm.local","password":"rahasia"}`))
	var req handler.LoginRequest
	if err := handler.Decode(r, &req); err != nil {
		t.Fatalf("Decode error: %v", err)
	}
	if req.Email != "owner@umkm.local" || req.Password != "rahasia" {
		t.Fatalf("hasil decode tidak sesuai: %+v", req)
	}
}

func TestDecodeBodyRusak(t *testing.T) {
	r := httptest.NewRequest(http.MethodPost, "/uji", strings.NewReader(`bukan-json`))
	var req handler.LoginRequest
	if err := handler.Decode(r, &req); err == nil {
		t.Fatal("body yang bukan JSON harus mengembalikan error")
	}
}
