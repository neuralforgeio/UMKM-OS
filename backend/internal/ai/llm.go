package ai

// Klien LLM OpenAI-compatible (port ml-service v3.5.1) — blueprint BAB 3.
//
// Komunikasi keluar ke LLM terjadi LANGSUNG dari backend Go (bukan dari
// browser) supaya API key tidak pernah melintas ke klien. Endpoint yang
// dipakai standar industri {base_url}/chat/completions sehingga penyedia
// mana pun cocok: OpenAI, Groq, Together, OpenRouter, atau Ollama lokal
// (http://host:11434/v1, tanpa kunci).
//
// normalisasiPesan adalah lapisan pertahanan KEDUA di batas transport:
// penyedia OpenAI-compatible hanya menerima peran huruf kecil
// (system/user/assistant); riwayat database tersimpan huruf besar
// (konvensi migrasi #12). Klien menurunkan huruf peran, membuang pesan
// bercacat, dan menolak jujur bila tidak tersisa satu pun pesan sah.

import (
        "bytes"
        "context"
        "encoding/json"
        "fmt"
        "io"
        "net/http"
        "strings"
        "time"
)

// LlmError: kegagalan panggilan LLM (jaringan/HTTP/bentuk respons).
type LlmError struct{ msg string }

func (e *LlmError) Error() string { return e.msg }

func galatf(format string, a ...interface{}) error {
        return &LlmError{msg: fmt.Sprintf(format, a...)}
}

// PesanGalatHTTP menerjemahkan status + tubuh respons penyedia menjadi
// satu kalimat yang bisa dibaca pemilik warung (murni, mudah diuji).
//
// Contoh: 401 -> kunci ditolak (petunjuk salin ulang dari Groq);
// 429 -> batas laju; 5xx -> penyedia bermasalah; lainnya menyertakan
// potongan tubuh respons (mis. nama model tak dikenal).
func PesanGalatHTTP(status int, tubuh string) string {
        potong := strings.Join(strings.Fields(tubuh), " ")
        if len(potong) > 160 {
                potong = potong[:160]
        }
        switch {
        case status == 401:
                return "LLM menolak (HTTP 401): kunci API ditolak penyedia. Salin " +
                        "ulang kunci dari console.groq.com/keys lalu simpan di " +
                        "Pengaturan -> Asisten AI."
        case status == 403:
                return "LLM menolak (HTTP 403): kunci tidak berhak memakai model " +
                        "ini. Periksa nama model dan hak akses kuncinya."
        case status == 429:
                return "LLM sibuk (HTTP 429): batas laju penyedia tercapai. Tunggu " +
                        "sebentar lalu kirim ulang."
        case status >= 500:
                return fmt.Sprintf("LLM sedang bermasalah (HTTP %d). Coba lagi nanti.", status)
        case potong != "":
                return fmt.Sprintf("LLM menolak (HTTP %d): %s", status, potong)
        default:
                return fmt.Sprintf("LLM menolak (HTTP %d).", status)
        }
}

var peranSah = map[string]bool{"system": true, "user": true, "assistant": true}

// NormalisasiPesan menormalkan daftar pesan ke bentuk literal peran
// OpenAI-compatible. Pesan bercacat — peran asing, isi kosong — dibuang
// bersama pesannya; tanpa satu pun pesan sah hasilnya kosong.
func NormalisasiPesan(messages []Pesan) []Pesan {
        bersih := make([]Pesan, 0, len(messages))
        for _, m := range messages {
                peran := strings.ToLower(strings.TrimSpace(m.Role))
                if !peranSah[peran] || strings.TrimSpace(m.Content) == "" {
                        continue
                }
                bersih = append(bersih, Pesan{Role: peran, Content: m.Content})
        }
        return bersih
}

// Client: kontrak klien LLM — implementasi HTTP asli atau stub unittest.
type Client interface {
        Complete(ctx context.Context, messages []Pesan, temperature float64, maxTokens int) (string, error)
        Model() string
}

// HttpLlmClient memanggil POST /chat/completions. Dibuat per-request
// dari konfigurasi efektif; timeout 45 detik — gpt-oss berpikir lebih
// dulu, asisten harus sabar sedikit tapi tetap lebih cepat daripada
// keluhan tidak terjawab.
type HttpLlmClient struct {
        BaseURL string
        APIKey  string
        Model_  string
        Timeout time.Duration
}

func NewHttpLlmClient(baseURL, apiKey, model string) *HttpLlmClient {
        return &HttpLlmClient{
                BaseURL: strings.TrimRight(baseURL, "/"),
                APIKey:  apiKey,
                Model_:  model,
                Timeout: 45 * time.Second,
        }
}

func (c *HttpLlmClient) Model() string { return c.Model_ }

// Probe memanggil GET /models dengan kunci yang sama — validasi kunci
// LANGSUNG di server penyedia tanpa membakar token chat. Mengembalikan
// status HTTP (0 bila tidak terjangkau).
func (c *HttpLlmClient) Probe() int {
        ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
        defer cancel()
        req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+"/models", nil)
        if err != nil {
                return 0
        }
        req.Header.Set("Authorization", "Bearer "+c.APIKey)
        res, err := http.DefaultClient.Do(req)
        if err != nil {
                return 0
        }
        defer res.Body.Close()
        _, _ = io.Copy(io.Discard, io.LimitReader(res.Body, 1<<16))
        return res.StatusCode
}

type chatRequest struct {
        Model           string  `json:"model"`
        Messages        []Pesan `json:"messages"`
        Temperature     float64 `json:"temperature"`
        MaxTokens       int     `json:"max_tokens,omitempty"`
        ReasoningEffort string  `json:"reasoning_effort,omitempty"`
}

type chatResponse struct {
        Choices []struct {
                Message struct {
                        Content string `json:"content"`
                } `json:"message"`
        } `json:"choices"`
}

func (c *HttpLlmClient) Complete(ctx context.Context, messages []Pesan, temperature float64, maxTokens int) (string, error) {
        pesanBersih := NormalisasiPesan(messages)
        if len(pesanBersih) == 0 {
                return "", galatf("Tidak ada satu pun pesan sah untuk dikirim ke LLM " +
                        "(semua peran/isi bercacat).")
        }
        payload := chatRequest{
                Model:       c.Model_,
                Messages:    pesanBersih,
                Temperature: temperature,
                MaxTokens:   maxTokens,
        }
        // Model reasoning (gpt-oss di Groq) menghabiskan token berpikir
        // SEBELUM jawaban — anggaran kecil membuat jawaban kosong. Usaha
        // rendah + anggaran lebih longgar menjaga asisten tetap ringkas
        // namun tidak pernah kosong.
        if strings.Contains(strings.ToLower(c.Model_), "gpt-oss") {
                if payload.MaxTokens < 1500 {
                        payload.MaxTokens = 1500
                }
                payload.ReasoningEffort = "low"
        }

        body, err := json.Marshal(payload)
        if err != nil {
                return "", galatf("gagal menyusun permintaan LLM: %v", err)
        }

        reqCtx, cancel := context.WithTimeout(ctx, c.Timeout)
        defer cancel()
        req, err := http.NewRequestWithContext(reqCtx, http.MethodPost,
                c.BaseURL+"/chat/completions", bytes.NewReader(body))
        if err != nil {
                return "", galatf("permintaan LLM tidak valid: %v", err)
        }
        req.Header.Set("Content-Type", "application/json")
        req.Header.Set("Authorization", "Bearer "+c.APIKey)

        res, err := http.DefaultClient.Do(req)
        if err != nil {
                return "", galatf("LLM tidak terjangkau: %v", err)
        }
        defer res.Body.Close()

        tubuh, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
        if res.StatusCode >= 400 {
                return "", galatf("%s", PesanGalatHTTP(res.StatusCode, string(tubuh)))
        }

        var isi chatResponse
        if err := json.Unmarshal(tubuh, &isi); err != nil || len(isi.Choices) == 0 {
                return "", galatf("Bentuk respons LLM tidak dikenal")
        }
        jawaban := strings.TrimSpace(isi.Choices[0].Message.Content)
        if jawaban == "" {
                // Model reasoning kadang menghabiskan seluruh anggaran untuk
                // berpikir lalu mengirim isi kosong; itu kegagalan jawaban,
                // bukan jawaban — pemilik berhak tahu dan mencoba lagi.
                return "", galatf("LLM mengirim jawaban kosong. Coba lagi.")
        }
        return jawaban, nil
}
