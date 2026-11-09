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
//
// RUN-5 — RANTAI MODEL CADANGAN: penyedia bisa menolak MODEL dengan
// HTTP 403 (Groq Model Permissions: model diblokir di tingkat
// organisasi/project, console.groq.com/settings/limits) atau 404 (model
// sudah dimatikan/tidak dikenal). Bila model utama ditolak demikian,
// klien otomatis menurun ke model cadangan (LLM_FALLBACK_MODELS)
// supaya OSCAR tetap menjawab alih-alih tumbang. Galat 401/429/5xx
// TIDAK memicu penurunan — itu soal kunci/laju/penyedia, bukan model,
// dan berganti model tidak menolong.
//
// RUN-5 — JENDELA DIAGNOSIS: galat HTTP kini membawa RINGKASAN BALASAN
// penyedia (kode galat Groq seperti model_permission_blocked_org ikut
// terbaca) alih-alih dibuang. Tanpa ini pemilik hanya melihat "kunci
// tidak berhak memakai model ini" tanpa tahu penyebab persisnya —
// itulah akar OSCAR diam yang tidak terdiagnosis pada run-4.

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
type LlmError struct {
        msg    string
        status int // kode HTTP penyedia; 0 bila bukan galat HTTP
}

func (e *LlmError) Error() string { return e.msg }

// Status: kode HTTP dari penyedia (0 bila galat jaringan/bentuk respons).
// Dipakai selftest --groq untuk melaporkan kode persis ke skrip delivery.
func (e *LlmError) Status() int { return e.status }

func galatf(format string, a ...interface{}) error {
        return &LlmError{msg: fmt.Sprintf(format, a...)}
}

func galatHTTP(status int, pesan string) error {
        return &LlmError{msg: pesan, status: status}
}

// ringkasGalatPenyedia menyarikan tubuh balasan galat penyedia menjadi
// satu potongan pendek yang bermakna: bila JSON {error:{code,type,
// message}} dikenali, ketiganya digabung (kode Groq seperti
// model_permission_blocked_org langsung terbaca); bila tidak, tubuh
// mentah dipangkas. Inilah jendela diagnosis run-5.
func ringkasGalatPenyedia(tubuh string) string {
        var b struct {
                Error struct {
                        Message string `json:"message"`
                        Type    string `json:"type"`
                        Code    string `json:"code"`
                } `json:"error"`
        }
        if err := json.Unmarshal([]byte(tubuh), &b); err == nil &&
                (b.Error.Code != "" || b.Error.Type != "" || b.Error.Message != "") {
                var bagian []string
                for _, v := range []string{b.Error.Code, b.Error.Type, b.Error.Message} {
                        if v != "" && !sudahTermasuk(bagian, v) {
                                bagian = append(bagian, v)
                        }
                }
                gabung := strings.Join(strings.Fields(strings.Join(bagian, " ")), " ")
                if len(gabung) > 220 {
                        gabung = gabung[:220]
                }
                return gabung
        }
        potong := strings.Join(strings.Fields(tubuh), " ")
        if len(potong) > 160 {
                potong = potong[:160]
        }
        return potong
}

func sudahTermasuk(daftar []string, v string) bool {
        for _, x := range daftar {
                if x == v {
                        return true
                }
        }
        return false
}

// PesanGalatHTTP menerjemahkan status + tubuh respons penyedia menjadi
// satu kalimat yang bisa dibaca pemilik warung (murni, mudah diuji).
//
// Contoh: 401 -> kunci ditolak (petunjuk salin ulang dari Groq);
// 403 -> model tidak berhak dipakai kunci/organisasi + ringkasan
// balasan penyedia (kode Groq model_permission_blocked_org menyebut
// alamat pengaturan izinnya); 429 -> batas laju; 5xx -> penyedia
// bermasalah; lainnya menyertakan ringkasan tubuh respons.
func PesanGalatHTTP(status int, tubuh string) string {
        switch {
        case status == 401:
                return "LLM menolak (HTTP 401): kunci API ditolak penyedia. Salin " +
                        "ulang kunci dari console.groq.com/keys lalu simpan di " +
                        "Pengaturan -> Asisten AI."
        case status == 403:
                pesan := "LLM menolak (HTTP 403): kunci atau organisasi tidak " +
                        "berhak memakai model ini - model bisa diblokir di pengaturan " +
                        "izin Groq (console.groq.com/settings/limits) atau sudah " +
                        "dimatikan penyedia. Ganti model di Pengaturan -> Asisten AI."
                if v := ringkasGalatPenyedia(tubuh); v != "" {
                        pesan += " Balasan penyedia: " + v
                }
                return pesan
        case status == 429:
                return "LLM sibuk (HTTP 429): batas laju penyedia tercapai. Tunggu " +
                        "sebentar lalu kirim ulang."
        case status >= 500:
                return fmt.Sprintf("LLM sedang bermasalah (HTTP %d). Coba lagi nanti.", status)
        }
        if potong := ringkasGalatPenyedia(tubuh); potong != "" {
                return fmt.Sprintf("LLM menolak (HTTP %d): %s", status, potong)
        }
        return fmt.Sprintf("LLM menolak (HTTP %d).", status)
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

// userAgentPanggilan: identitas jujur pengganti "Go-http-client/1.1"
// bawaan — beberapa lapis WAF penyedia menyaring klien tanpa identitas
// (httpx era Python selalu mengirim identitas dirinya).
const userAgentPanggilan = "UMKM-OS-Go/2.0.1"

// HttpLlmClient memanggil POST /chat/completions. Dibuat per-request
// dari konfigurasi efektif; timeout 45 detik per percobaan model —
// gpt-oss berpikir lebih dulu, asisten harus sabar sedikit tapi tetap
// lebih cepat daripada keluhan tidak terjawab.
//
// Fallbacks: rantai model cadangan (run-5) — dipakai berurutan bila
// model utama ditolak penyedia dengan 403/404. Model cadangan yang
// berhasil DIPROMOSIKAN menjadi Model_ sehingga panggilan berikutnya
// pada klien yang sama langsung ke model yang hidup.
type HttpLlmClient struct {
        BaseURL   string
        APIKey    string
        Model_    string
        Fallbacks []string
        Timeout   time.Duration
}

func NewHttpLlmClient(baseURL, apiKey, model string) *HttpLlmClient {
        return &HttpLlmClient{
                BaseURL: strings.TrimRight(baseURL, "/"),
                APIKey:  apiKey,
                Model_:  model,
                Timeout: 45 * time.Second,
        }
}

// NewHttpLlmClientFallback: klien lengkap dengan rantai model cadangan
// (run-5) — dipakai ConfigStore.Klien untuk OSCAR maupun selftest.
func NewHttpLlmClientFallback(baseURL, apiKey, model string, fallbacks []string) *HttpLlmClient {
        k := NewHttpLlmClient(baseURL, apiKey, model)
        k.Fallbacks = fallbacks
        return k
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
        req.Header.Set("User-Agent", userAgentPanggilan)
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

// Complete menjawab lewat rantai model: model utama dulu, lalu model
// cadangan satu per satu BILA penyedia menolak modelnya dengan 403/404
// (diblokir izin atau dimatikan). Galat jenis lain (401 kunci, 429
// laju, 5xx penyedia, jaringan) langsung diteruskan — cadangan tidak
// menolong. Bila seluruh rantai ditolak, galat model PERTAMA
// dilaporkan lengkap dengan daftar model yang sudah dicoba supaya
// pemilik tahu harus membuka izinnya atau mengganti model.
func (c *HttpLlmClient) Complete(ctx context.Context, messages []Pesan, temperature float64, maxTokens int) (string, error) {
        pesanBersih := NormalisasiPesan(messages)
        if len(pesanBersih) == 0 {
                return "", galatf("Tidak ada satu pun pesan sah untuk dikirim ke LLM " +
                        "(semua peran/isi bercacat).")
        }
        var errUtama error
        var dicoba []string
        for _, model := range c.rantaiModel() {
                dicoba = append(dicoba, model)
                jawaban, err := c.completeModel(ctx, pesanBersih, temperature, maxTokens, model)
                if err == nil {
                        if model != c.Model_ {
                                // promosi: model cadangan yang hidup dipakai langsung
                                // oleh panggilan berikutnya pada klien ini.
                                c.Model_ = model
                        }
                        return jawaban, nil
                }
                if errUtama == nil {
                        errUtama = err
                }
                if le, ok := err.(*LlmError); !ok ||
                        (le.Status() != http.StatusForbidden && le.Status() != http.StatusNotFound) {
                        // bukan soal model — kunci/laju/penyedia/jaringan.
                        return "", err
                }
        }
        if len(dicoba) > 1 && errUtama != nil {
                statusUtama := 0
                if le, ok := errUtama.(*LlmError); ok {
                        statusUtama = le.status
                }
                return "", &LlmError{
                        msg: fmt.Sprintf("%v - sudah dicoba model: %s (semua ditolak). "+
                                "Periksa izin model di console.groq.com/settings/limits atau "+
                                "ganti model di Pengaturan -> Asisten AI.",
                                errUtama, strings.Join(dicoba, ", ")),
                        status: statusUtama,
                }
        }
        return "", errUtama
}

// rantaiModel: model utama + cadangan unik, urutan dipertahankan,
// spasi dibuang, kembar dilompati.
func (c *HttpLlmClient) rantaiModel() []string {
        rantai := []string{c.Model_}
        for _, m := range c.Fallbacks {
                m = strings.TrimSpace(m)
                if m == "" || sudahTermasuk(rantai, m) {
                        continue
                }
                rantai = append(rantai, m)
        }
        return rantai
}

// completeModel: satu panggilan POST /chat/completions untuk satu model.
func (c *HttpLlmClient) completeModel(ctx context.Context, pesanBersih []Pesan, temperature float64, maxTokens int, model string) (string, error) {
        payload := chatRequest{
                Model:       model,
                Messages:    pesanBersih,
                Temperature: temperature,
                MaxTokens:   maxTokens,
        }
        // Model reasoning (gpt-oss di Groq) menghabiskan token berpikir
        // SEBELUM jawaban — anggaran kecil membuat jawaban kosong. Usaha
        // rendah + anggaran lebih longgar menjaga asisten tetap ringkas
        // namun tidak pernah kosong. Berlaku juga untuk cadangan gpt-oss.
        if strings.Contains(strings.ToLower(model), "gpt-oss") {
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
        req.Header.Set("User-Agent", userAgentPanggilan)

        res, err := http.DefaultClient.Do(req)
        if err != nil {
                return "", galatf("LLM tidak terjangkau: %v", err)
        }
        defer res.Body.Close()

        tubuh, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
        if res.StatusCode >= 400 {
                return "", galatHTTP(res.StatusCode, PesanGalatHTTP(res.StatusCode, string(tubuh)))
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
