package ai

// Unittest klien LLM (port perilaku test_llm.py era Python): terjemahan
// galat HTTP, anggaran gpt-oss, jawaban kosong = kegagalan, probe
// kunci. Server penyedia dipalsukan dengan httptest.

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestPesanGalatHTTP(t *testing.T) {
	kasus := []struct {
		status int
		penanda string
	}{
		{401, "kunci API ditolak penyedia"},
		{403, "tidak berhak memakai model"},
		{429, "batas laju penyedia tercapai"},
		{500, "LLM sedang bermasalah"},
		{400, "model_tak_dikenal"},
	}
	for _, k := range kasus {
		pesan := PesanGalatHTTP(k.status, `{"error":{"message":"model_tak_dikenal"}}`)
		if !strings.Contains(pesan, k.penanda) {
			t.Errorf("PesanGalatHTTP(%d) harus memuat %q: %q", k.status, k.penanda, pesan)
		}
	}
}

func TestHttpLlmClientBerhasil(t *testing.T) {
	var terima chatRequest
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			t.Errorf("path salah: %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer gsk_uji1234567890" {
			t.Errorf("header Authorization salah: %q", r.Header.Get("Authorization"))
		}
		_ = json.NewDecoder(r.Body).Decode(&terima)
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":" SIAP. "}}]}`))
	}))
	defer srv.Close()

	klien := NewHttpLlmClient(srv.URL, "gsk_uji1234567890", "llama-3.3-70b")
	jawaban, err := klien.Complete(context.Background(),
		[]Pesan{{Role: "user", Content: "tes"}}, 0.2, 700)
	if err != nil {
		t.Fatal(err)
	}
	if jawaban != "SIAP." {
		t.Errorf("jawaban harus di-trim: %q", jawaban)
	}
	if terima.MaxTokens != 700 || terima.ReasoningEffort != "" {
		t.Errorf("model biasa: max_tokens 700 tanpa reasoning_effort: %+v", terima)
	}
}

func TestHttpLlmClientGptOssAnggaranLonggar(t *testing.T) {
	var terima chatRequest
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&terima)
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"SIAP"}}]}`))
	}))
	defer srv.Close()

	klien := NewHttpLlmClient(srv.URL, "k", "openai/gpt-oss-20b")
	if _, err := klien.Complete(context.Background(),
		[]Pesan{{Role: "user", Content: "tes"}}, 0.2, 700); err != nil {
		t.Fatal(err)
	}
	if terima.MaxTokens < 1500 {
		t.Errorf("gpt-oss harus dinaikkan ke >= 1500: %d", terima.MaxTokens)
	}
	if terima.ReasoningEffort != "low" {
		t.Errorf("gpt-oss harus reasoning_effort low: %q", terima.ReasoningEffort)
	}
}

func TestHttpLlmClientGalatHTTP(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":{"message":"invalid api key"}}`))
	}))
	defer srv.Close()
	klien := NewHttpLlmClient(srv.URL, "salah", "m")
	_, err := klien.Complete(context.Background(), []Pesan{{Role: "user", Content: "x"}}, 0.2, 100)
	if err == nil || !strings.Contains(err.Error(), "HTTP 401") ||
		!strings.Contains(err.Error(), "console.groq.com") {
		t.Fatalf("galat 401 harus diterjemahkan ramah: %v", err)
	}
}

func TestHttpLlmClientJawabanKosongAdalahKegagalan(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":""}}]}`))
	}))
	defer srv.Close()
	klien := NewHttpLlmClient(srv.URL, "k", "m")
	_, err := klien.Complete(context.Background(), []Pesan{{Role: "user", Content: "x"}}, 0.2, 100)
	if err == nil || !strings.Contains(err.Error(), "jawaban kosong") {
		t.Fatalf("jawaban kosong harus jadi LlmError: %v", err)
	}
}

func TestHttpLlmClientTanpaPesanSah(t *testing.T) {
	klien := NewHttpLlmClient("http://localhost:1", "k", "m")
	_, err := klien.Complete(context.Background(), []Pesan{{Role: "MODEL", Content: "x"}}, 0.2, 100)
	if err == nil || !strings.Contains(err.Error(), "pesan sah") {
		t.Fatalf("tanpa pesan sah harus ditolak: %v", err)
	}
}

func TestHttpLlmClientProbe(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/models" {
			if r.Header.Get("Authorization") == "Bearer benar" {
				w.WriteHeader(http.StatusOK)
			} else {
				w.WriteHeader(http.StatusUnauthorized)
			}
			return
		}
	}))
	defer srv.Close()
	if dapat := NewHttpLlmClient(srv.URL, "benar", "m").Probe(); dapat != 200 {
		t.Errorf("kunci benar: probe = %d; ingin 200", dapat)
	}
	if dapat := NewHttpLlmClient(srv.URL, "salah", "m").Probe(); dapat != 401 {
		t.Errorf("kunci salah: probe = %d; ingin 401", dapat)
	}
	if dapat := NewHttpLlmClient("http://localhost:1", "k", "m").Probe(); dapat != 0 {
		t.Errorf("server mati: probe = %d; ingin 0", dapat)
	}
}

// stubKlien: klien palsu untuk unittest alur generasi.
type stubKlien struct {
	model    string
	jawaban  []string
	pangilan int
	terakhir []Pesan
}

func (s *stubKlien) Model() string { return s.model }

func (s *stubKlien) Complete(ctx context.Context, messages []Pesan, temperature float64, maxTokens int) (string, error) {
	s.terakhir = messages
	if s.pangilan < len(s.jawaban) {
		s.pangilan++
		return s.jawaban[s.pangilan-1], nil
	}
	return s.jawaban[len(s.jawaban)-1], nil
}
