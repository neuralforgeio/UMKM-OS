package ai

// Unittest klien LLM (port perilaku test_llm.py era Python): terjemahan
// galat HTTP, anggaran gpt-oss, jawaban kosong = kegagalan, probe
// kunci. Server penyedia dipalsukan dengan httptest.

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestPesanGalatHTTP(t *testing.T) {
	kasus := []struct {
		status  int
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

// run-5: kode status HTTP harus terbaca TERSTRUKTUR (bukan ditebak dari
// teks pesan) supaya umkm-selftest + gerbang delivery bisa membedakan
// 401/403/429; pesan 403 wajib menjelaskan dua penyebab nyatanya.
func TestLlmErrorStatusTerstruktur(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"error":{"message":"Forbidden"}}`))
	}))
	defer srv.Close()
	klien := NewHttpLlmClient(srv.URL, "mati", "openai/gpt-oss-20b")
	_, err := klien.Complete(context.Background(), []Pesan{{Role: "user", Content: "x"}}, 0.2, 100)
	var le *LlmError
	if !errors.As(err, &le) {
		t.Fatalf("galat HTTP harus *LlmError, bukan %T: %v", err, err)
	}
	if le.Status != http.StatusForbidden {
		t.Fatalf("LlmError.Status = %d; ingin 403", le.Status)
	}
	for _, penanda := range []string{"HTTP 403", "nonaktif/dicabut", "settings/limits", "LLM_API_KEY"} {
		if !strings.Contains(err.Error(), penanda) {
			t.Fatalf("pesan 403 harus memuat %q: %v", penanda, err)
		}
	}
	// galat non-HTTP (jaringan) harus tetap Status=0.
	_, errJaringan := NewHttpLlmClient("http://localhost:1", "k", "m").
		Complete(context.Background(), []Pesan{{Role: "user", Content: "x"}}, 0.2, 100)
	var le2 *LlmError
	if !errors.As(errJaringan, &le2) || le2.Status != 0 {
		t.Fatalf("galat jaringan harus LlmError Status=0: %v", errJaringan)
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

// ===== RUN-6: rantai model cadangan (LLM_FALLBACK_MODELS) =================
//
// Hanya kegagalan SOAL MODEL (403 hak model / 404 model dimatikan) yang
// boleh turun ke cadangan; 401 (kunci) dan 429 (batas laju) gagal cepat
// tanpa membakar panggilan tambahan; model cadangan yang berhasil
// dipromosikan untuk panggilan lanjutan; status HTTP asli terjaga sampai
// ke galat akhir supaya gerbang delivery tetap membaca kode sebenarnya.

// serverRantai: server palsu yang menolak model tertentu dengan status
// tertentu lalu menjawab normal untuk model lain; mencatat urutan model
// yang datang dan header User-Agent permintaan terakhir.
func serverRantai(t *testing.T, tolak map[string]int, urutan *[]string, ua *string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if ua != nil {
			*ua = r.Header.Get("User-Agent")
		}
		var req chatRequest
		_ = json.NewDecoder(r.Body).Decode(&req)
		if urutan != nil {
			*urutan = append(*urutan, req.Model)
		}
		if kode, ok := tolak[req.Model]; ok {
			w.WriteHeader(kode)
			_, _ = w.Write([]byte(`{"error":{"code":"model_permission_blocked_org","message":"tidak boleh"}}`))
			return
		}
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"SIAP dari cadangan"}}]}`))
	}))
}

func TestRantaiCadanganTurunSaat403LaluPromosi(t *testing.T) {
	var urutan []string
	srv := serverRantai(t, map[string]int{"utama": http.StatusForbidden}, &urutan, nil)
	defer srv.Close()
	klien := NewHttpLlmClientCadangan(srv.URL, "k", "utama", []string{"cadangan-1"})
	jawaban, err := klien.Complete(context.Background(),
		[]Pesan{{Role: "user", Content: "x"}}, 0.2, 700)
	if err != nil {
		t.Fatal(err)
	}
	if jawaban != "SIAP dari cadangan" {
		t.Fatalf("jawaban = %q; ingin dari model cadangan", jawaban)
	}
	if len(urutan) != 2 || urutan[0] != "utama" || urutan[1] != "cadangan-1" {
		t.Fatalf("urutan model = %v; ingin [utama cadangan-1]", urutan)
	}
	if klien.Model() != "cadangan-1" {
		t.Fatalf("model harus dipromosikan ke cadangan-1, kini %q", klien.Model())
	}
	// Panggilan lanjutan langsung memakai model promosi (tidak mencoba
	// utama yang sudah terbukti ditolak).
	if _, err := klien.Complete(context.Background(),
		[]Pesan{{Role: "user", Content: "x"}}, 0.2, 700); err != nil {
		t.Fatal(err)
	}
	if len(urutan) != 3 || urutan[2] != "cadangan-1" {
		t.Fatalf("panggilan lanjutan harus langsung cadangan-1: %v", urutan)
	}
}

func TestRantaiCadanganTurunSaat404(t *testing.T) {
	var urutan []string
	srv := serverRantai(t, map[string]int{"utama": http.StatusNotFound, "c1": http.StatusNotFound}, &urutan, nil)
	defer srv.Close()
	klien := NewHttpLlmClientCadangan(srv.URL, "k", "utama", []string{"c1", "c2"})
	jawaban, err := klien.Complete(context.Background(),
		[]Pesan{{Role: "user", Content: "x"}}, 0.2, 700)
	if err != nil {
		t.Fatal(err)
	}
	if jawaban != "SIAP dari cadangan" || klien.Model() != "c2" {
		t.Fatalf("404 harus turun sampai c2: jawaban=%q model=%q", jawaban, klien.Model())
	}
	if len(urutan) != 3 {
		t.Fatalf("tiga model harus dicoba berurutan: %v", urutan)
	}
}

func TestRantaiCadanganTidakTurunSaat401(t *testing.T) {
	var urutan []string
	srv := serverRantai(t, map[string]int{"utama": http.StatusUnauthorized}, &urutan, nil)
	defer srv.Close()
	klien := NewHttpLlmClientCadangan(srv.URL, "k", "utama", []string{"c1"})
	_, err := klien.Complete(context.Background(),
		[]Pesan{{Role: "user", Content: "x"}}, 0.2, 700)
	if err == nil || !strings.Contains(err.Error(), "HTTP 401") {
		t.Fatalf("401 = soal kunci, harus gagal jujur: %v", err)
	}
	if len(urutan) != 1 {
		t.Fatalf("cadangan TIDAK boleh dicoba saat 401 (urutan=%v)", urutan)
	}
}

func TestRantaiCadanganTidakTurunSaat429(t *testing.T) {
	var urutan []string
	srv := serverRantai(t, map[string]int{"utama": http.StatusTooManyRequests}, &urutan, nil)
	defer srv.Close()
	klien := NewHttpLlmClientCadangan(srv.URL, "k", "utama", []string{"c1"})
	_, err := klien.Complete(context.Background(),
		[]Pesan{{Role: "user", Content: "x"}}, 0.2, 700)
	if err == nil || !strings.Contains(err.Error(), "HTTP 429") {
		t.Fatalf("429 = batas laju, harus gagal jujur: %v", err)
	}
	if len(urutan) != 1 {
		t.Fatalf("cadangan TIDAK boleh dicoba saat 429 (urutan=%v)", urutan)
	}
}

func TestRantaiCadanganHabisStatusTerjaga(t *testing.T) {
	var urutan []string
	srv := serverRantai(t, map[string]int{"utama": http.StatusForbidden, "c1": http.StatusForbidden}, &urutan, nil)
	defer srv.Close()
	klien := NewHttpLlmClientCadangan(srv.URL, "k", "utama", []string{"c1"})
	_, err := klien.Complete(context.Background(),
		[]Pesan{{Role: "user", Content: "x"}}, 0.2, 700)
	var le *LlmError
	if !errors.As(err, &le) || le.Status != http.StatusForbidden {
		t.Fatalf("status 403 harus terjaga di ujung rantai: %v", err)
	}
	if !strings.Contains(err.Error(), "rantai model") || !strings.Contains(err.Error(), "utama -> c1") {
		t.Fatalf("pesan harus menyebut rantai yang dicoba: %v", err)
	}
	if len(urutan) != 2 {
		t.Fatalf("kedua model harus dicoba (urutan=%v)", urutan)
	}
}

func TestRantaiCadanganUserAgentProduk(t *testing.T) {
	var ua string
	srv := serverRantai(t, nil, nil, &ua)
	defer srv.Close()
	if _, err := NewHttpLlmClient(srv.URL, "k", "m").Complete(context.Background(),
		[]Pesan{{Role: "user", Content: "x"}}, 0.2, 700); err != nil {
		t.Fatal(err)
	}
	if ua == "" || strings.Contains(ua, "Go-http-client") || !strings.Contains(ua, "umkm-os") {
		t.Fatalf("User-Agent harus identitas produk umkm-os, bukan Go-http-client anonim (dapat %q)", ua)
	}
}

func TestPesanGalatHTTP403MenyebutBalasanPenyedia(t *testing.T) {
	pesan := PesanGalatHTTP(http.StatusForbidden,
		`{"error":{"code":"model_permission_blocked_org","message":"blocked"}}`)
	for _, penanda := range []string{"model_permission_blocked_org", "Balasan penyedia"} {
		if !strings.Contains(pesan, penanda) {
			t.Fatalf("pesan 403 harus memuat %q: %v", penanda, pesan)
		}
	}
}

// RUN-7 — ProbeDetail: probe kini membawa ISI BALASAN penyedia supaya
// dua wajah 403 dibedakan: {"error":{"message":"Forbidden"}} polos =
// IP/jaringan diblokir di tepi (permintaan tak sampai lapis kunci),
// sedangkan kode spesifik (invalid_api_key, model_permission_blocked)
// = soal kunci/hak model. Pemilik warung tak perlu lagi menebak.
func TestProbeDetailMembawaIsiBalasan(t *testing.T) {
	srv403 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"error":{"message":"Forbidden"}}`))
	}))
	defer srv403.Close()
	h := NewHttpLlmClient(srv403.URL, "kunci", "m").ProbeDetail()
	if h.Status != 403 || !strings.Contains(h.Tubuh, "Forbidden") {
		t.Fatalf("probe 403 harus membawa isi balasan: %+v", h)
	}

	srv401 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":{"code":"invalid_api_key"}}`))
	}))
	defer srv401.Close()
	h2 := NewHttpLlmClient(srv401.URL, "kunci", "m").ProbeDetail()
	if h2.Status != 401 || !strings.Contains(h2.Tubuh, "invalid_api_key") {
		t.Fatalf("probe 401 harus membawa kode penyedia: %+v", h2)
	}

	h3 := NewHttpLlmClient("http://localhost:1", "k", "m").ProbeDetail()
	if h3.Status != 0 || !strings.Contains(h3.Tubuh, "tidak terjangkau") {
		t.Fatalf("server mati: status 0 + sebab: %+v", h3)
	}

	// Isi balasan dirata satu baris dan dibatasi 220 karakter.
	if len(potongTubuh("  a\n\nb  ")) != 3 {
		t.Fatalf("tubuh harus dirata satu baris")
	}
}

func TestProbeDetailTubuhTerpotong220(t *testing.T) {
	panjang := strings.Repeat("y", 600)
	if dapat := potongTubuh(panjang); len(dapat) != 220 {
		t.Fatalf("tubuh terpotong 220, dapat %d", len(dapat))
	}
}
