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

// ===== RUN-5: rantai model cadangan + jendela diagnosis galat 403 =====

// Galat 403 harus membawa ringkasan balasan penyedia — kode Groq
// model_permission_blocked_org menyebut alamat pengaturan izinnya;
// tanpa ini pemilik hanya tahu "tidak berhak" tanpa penyebab persis
// (akar OSCAR diam run-4 tidak terdiagnosis).
func TestPesanGalatHTTP403MembawaBalasanPenyedia(t *testing.T) {
        pesan := PesanGalatHTTP(403, `{"error":{"message":"The model openai/gpt-oss-20b is blocked at the organization level. Please have the org admin enable this model in the org settings at https://console.groq.com/settings/limits","type":"permissions_error","code":"model_permission_blocked_org"}}`)
        for _, penanda := range []string{
                "tidak berhak memakai model",
                "model_permission_blocked_org",
                "settings/limits",
        } {
                if !strings.Contains(pesan, penanda) {
                        t.Errorf("pesan 403 harus memuat %q: %q", penanda, pesan)
                }
        }
}

// Model utama ditolak 403 -> turun ke cadangan: jawaban tetap datang,
// urutan percobaan tercatat, model hidup dipromosikan.
func TestHttpLlmClientTurunKeModelCadangan(t *testing.T) {
        var diterima []string
        srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                var terima chatRequest
                _ = json.NewDecoder(r.Body).Decode(&terima)
                diterima = append(diterima, terima.Model)
                if terima.Model == "lama/diblokir" {
                        w.WriteHeader(http.StatusForbidden)
                        _, _ = w.Write([]byte(`{"error":{"message":"The model lama/diblokir is blocked at the organization level","type":"permissions_error","code":"model_permission_blocked_org"}}`))
                        return
                }
                _, _ = w.Write([]byte(`{"choices":[{"message":{"content":"SIAP dari cadangan"}}]}`))
        }))
        defer srv.Close()

        klien := NewHttpLlmClientFallback(srv.URL, "k", "lama/diblokir",
                []string{"lama/diblokir", " cadangan/oke "})
        jawaban, err := klien.Complete(context.Background(),
                []Pesan{{Role: "user", Content: "tes"}}, 0.2, 700)
        if err != nil {
                t.Fatal(err)
        }
        if jawaban != "SIAP dari cadangan" {
                t.Fatalf("jawaban harus datang dari model cadangan: %q", jawaban)
        }
        if klien.Model() != "cadangan/oke" {
                t.Errorf("model hidup harus dipromosikan: %q", klien.Model())
        }
        if len(diterima) != 2 || diterima[0] != "lama/diblokir" || diterima[1] != "cadangan/oke" {
                t.Errorf("urutan percobaan model salah: %v", diterima)
        }
}

// 404 (model tak dikenal) juga memicu turun ke cadangan.
func TestHttpLlmClientTurunCadanganSaat404(t *testing.T) {
        srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                var terima chatRequest
                _ = json.NewDecoder(r.Body).Decode(&terima)
                if strings.Contains(terima.Model, "dimatikan") {
                        w.WriteHeader(http.StatusNotFound)
                        _, _ = w.Write([]byte(`{"error":{"message":"The model dimatikan does not exist","type":"invalid_request_error","code":"model_not_found"}}`))
                        return
                }
                _, _ = w.Write([]byte(`{"choices":[{"message":{"content":"HIDUP"}}]}`))
        }))
        defer srv.Close()

        klien := NewHttpLlmClientFallback(srv.URL, "k", "lama/dimatikan", []string{"anya/hidup"})
        jawaban, err := klien.Complete(context.Background(),
                []Pesan{{Role: "user", Content: "tes"}}, 0.2, 700)
        if err != nil || jawaban != "HIDUP" {
                t.Fatalf("404 harus turun ke cadangan: jawaban=%q err=%v", jawaban, err)
        }
        if klien.Model() != "anya/hidup" {
                t.Errorf("model cadangan harus dipromosikan: %q", klien.Model())
        }
}

// Seluruh rantai ditolak -> galat melaporkan model pertama + daftar
// semua yang sudah dicoba supaya pemilik tahu jalur pemulihannya.
func TestHttpLlmClientCadanganHabis(t *testing.T) {
        srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                w.WriteHeader(http.StatusForbidden)
                _, _ = w.Write([]byte(`{"error":{"message":"Forbidden"}}`))
        }))
        defer srv.Close()

        klien := NewHttpLlmClientFallback(srv.URL, "k", "a/satu", []string{"b/dua"})
        _, err := klien.Complete(context.Background(), []Pesan{{Role: "user", Content: "x"}}, 0.2, 100)
        if err == nil {
                t.Fatal("seluruh rantai ditolak harus gagal")
        }
        for _, penanda := range []string{"HTTP 403", "a/satu", "b/dua", "settings/limits"} {
                if !strings.Contains(err.Error(), penanda) {
                        t.Errorf("galat rantai habis harus memuat %q: %v", penanda, err)
                }
        }
        // status tetap dibawa keluar untuk selftest --groq
        if le, ok := err.(*LlmError); !ok || le.Status() != 403 {
                t.Errorf("galat akhir harus ber-status 403: %v", err)
        }
}

// Galat yang BUKAN soal model (401 kunci salah) tidak boleh memicu
// turun ke cadangan — cadangan tidak menolong kunci yang salah.
func TestHttpLlmClientGalatKunciTidakTurunCadangan(t *testing.T) {
        permintaan := 0
        srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                permintaan++
                w.WriteHeader(http.StatusUnauthorized)
                _, _ = w.Write([]byte(`{"error":{"message":"invalid api key"}}`))
        }))
        defer srv.Close()

        klien := NewHttpLlmClientFallback(srv.URL, "salah", "a/satu", []string{"b/dua"})
        _, err := klien.Complete(context.Background(), []Pesan{{Role: "user", Content: "x"}}, 0.2, 100)
        if err == nil || !strings.Contains(err.Error(), "HTTP 401") {
                t.Fatalf("galat 401 harus diteruskan apa adanya: %v", err)
        }
        if permintaan != 1 {
                t.Errorf("401 tidak boleh memicu turun ke cadangan (permintaan=%d)", permintaan)
        }
}

// Permintaan keluar membawa identitas User-Agent sendiri (bukan
// Go-http-client anonim yang bisa disaring WAF penyedia).
func TestHttpLlmClientMengirimUserAgent(t *testing.T) {
        var ua string
        srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                ua = r.Header.Get("User-Agent")
                _, _ = w.Write([]byte(`{"choices":[{"message":{"content":"SIAP"}}]}`))
        }))
        defer srv.Close()

        klien := NewHttpLlmClient(srv.URL, "k", "m")
        if _, err := klien.Complete(context.Background(), []Pesan{{Role: "user", Content: "x"}}, 0.2, 100); err != nil {
                t.Fatal(err)
        }
        if ua != userAgentPanggilan || ua == "" {
                t.Errorf("User-Agent harus identitas produk: %q", ua)
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
