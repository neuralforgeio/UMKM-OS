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
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// LlmError: kegagalan panggilan LLM (jaringan/HTTP/bentuk respons).
// Status = kode HTTP penyedia (0 bila kegagalan terjadi SEBELUM respons
// dibaca - jaringan, bentuk JSON, dst) supaya pemanggil teknis (mis.
// umkm-selftest dan gerbang delivery) bisa membedakan 401 kunci ditolak
// vs 403 hak model vs 429 batas laju tanpa mengurai teks pesan.
type LlmError struct {
	msg    string
	Status int
}

func (e *LlmError) Error() string { return e.msg }

func galatf(format string, a ...interface{}) error {
	return &LlmError{msg: fmt.Sprintf(format, a...)}
}

// galatHTTP: kegagalan BERBASIS respons penyedia - pesan ramah pemilik
// plus kode status asli di Status untuk konsumen teknis (run-5).
func galatHTTP(status int, tubuh string) error {
	return &LlmError{msg: PesanGalatHTTP(status, tubuh), Status: status}
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
			"Pengaturan -> Asisten AI atau ganti nilai LLM_API_KEY di file .env."
	case status == 403:
		// run-5: 403 dari Groq = pembatasan hak, bukan salah format. Dua
		// penyebab umum: kunci sudah nonaktif/dicabut penyedia, atau model
		// diblokir untuk organisasi/proyek pemilik kunci (Allow or Block
		// Models). Pesan lama ("periksa nama model") menyesatkan karena
		// semua model ditolak serentak saat kuncinya mati.
		// run-6: potongan balasan penyedia ikut disertakan supaya kode
		// galat spesifik (mis. model_permission_blocked_org) langsung
		// terbaca pemilik tanpa membuka log mentah.
		pesan := "LLM menolak (HTTP 403): kunci tidak berhak memakai model " +
			"ini - kunci mungkin sudah nonaktif/dicabut, atau model diblokir " +
			"untuk organisasi/proyek kunci tersebut. Buat kunci baru di " +
			"console.groq.com/keys (atau periksa Allow or Block Models di " +
			"console.groq.com/settings/limits) lalu perbarui lewat Pengaturan " +
			"-> Asisten AI atau variabel LLM_API_KEY di file .env."
		if potong != "" {
			pesan += " Balasan penyedia: " + potong + "."
		}
		return pesan
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

// userAgentProduk: identitas klien keluar (run-6). Go-http-client/1.1
// bawaan itu anonim — sebagian WAF/penyedia menyaring permintaan tanpa
// identitas; menyapa dengan nama produk sendiri jauh lebih sopan dan
// memudahkan penyedia membedakan trafik kami.
const userAgentProduk = "umkm-os-oscar/2.0 (+UMKM OS backend Go)"

// HttpLlmClient memanggil POST /chat/completions. Dibuat per-request
// dari konfigurasi efektif; timeout 45 detik — gpt-oss berpikir lebih
// dulu, asisten harus sabar sedikit tapi tetap lebih cepat daripada
// keluhan tidak terjawab.
//
// RUN-6 — RANTAI MODEL CADANGAN (Cadangan): bila penyedia menolak model
// utama dengan HTTP 403 (model diblokir organisasi/proyek — kenyataan
// Groq per 2026-11: llama 3.1/3.3 kini enterprise-only) atau 404 (model
// dimatikan penyedia), permintaan otomatis dicoba ke model cadangan
// BERURUTAN; model cadangan yang berhasil DIPROMOSIKAN menjadi model
// aktif klien untuk panggilan lanjutan. Kegagalan yang BUKAN soal model
// — 401 kunci ditolak, 429 batas laju, 5xx penyedia bermasalah,
// jaringan, jawaban kosong — tidak memicu turun: langsung gagal jujur
// supaya pemilik melihat penyebab sebenarnya. Daftar cadangan dari
// variabel LLM_FALLBACK_MODELS (default: openai/gpt-oss-120b,qwen/
// qwen3.8-27b — model Groq yang masih hidup per 2026-11).
type HttpLlmClient struct {
	BaseURL  string
	APIKey   string
	Model_   string
	Cadangan []string
	Timeout  time.Duration

	mu sync.Mutex // menjaga Model_ saat promosi rantai cadangan
}

func NewHttpLlmClient(baseURL, apiKey, model string) *HttpLlmClient {
	return &HttpLlmClient{
		BaseURL: strings.TrimRight(baseURL, "/"),
		APIKey:  apiKey,
		Model_:  model,
		Timeout: 45 * time.Second,
	}
}

// NewHttpLlmClientCadangan: klien dengan rantai model cadangan
// (LLM_FALLBACK_MODELS). Cadangan kosong = perilaku lama (satu model).
func NewHttpLlmClientCadangan(baseURL, apiKey, model string, cadangan []string) *HttpLlmClient {
	k := NewHttpLlmClient(baseURL, apiKey, model)
	k.Cadangan = cadangan
	return k
}

func (c *HttpLlmClient) Model() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.Model_
}

// rantaiModel: [model aktif] + cadangan (entri kosong/kembar dibuang).
func (c *HttpLlmClient) rantaiModel() []string {
	c.mu.Lock()
	utama := c.Model_
	c.mu.Unlock()
	rantai := make([]string, 0, 1+len(c.Cadangan))
	rantai = append(rantai, utama)
	for _, m := range c.Cadangan {
		if m != "" && m != utama && !berisi(rantai, m) {
			rantai = append(rantai, m)
		}
	}
	return rantai
}

func berisi(daftar []string, v string) bool {
	for _, x := range daftar {
		if x == v {
			return true
		}
	}
	return false
}

// HasilProbe: hasil GET /models dari server penyedia (run-7). Status = kode
// HTTP (0 bila tidak terjangkau sama sekali); Tubuh = ISI BALASAN MENTAH
// penyedia — bukti forensik kegagalan. Dua balisan 403 yang SERUPA di mata
// gerbang ternyata dua penyakit berbeda:
//
//	{"error":{"message":"Forbidden"}}          -> IP/teg jaringan diblokir
//	                                             (permintaan tak pernah
//	                                             sampai lapis kunci;
//	{"error":{"code":"invalid_api_key", ...}}    -> kunci salah/nonaktif
//
// Tanpa isi balasan, pemilik hanya melihat "403" dan salah menuduh kuncinya.
type HasilProbe struct {
	Status int
	Tubuh  string
}

// potongTubuh: satu baris, spasi diratakan, dibatasi 220 karakter —
// cukup memuat kode galat penyedia tanpa membanjiri konsol.
func potongTubuh(t string) string {
	satuBaris := strings.Join(strings.Fields(t), " ")
	if len(satuBaris) > 220 {
		satuBaris = satuBaris[:220]
	}
	return satuBaris
}

// ProbeDetail memanggil GET /models dengan kunci yang sama dan
// mengembalikan status + ISI BALASAN penyedia. Mengembalikan balasan
// APA ADANYA (tanpa diterjemahkan) supaya umkm-selftest / Gerbang F
// bisa mencetak PROBERAW — bukti diagnosis host-vs-container run-7.
func (c *HttpLlmClient) ProbeDetail() HasilProbe {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+"/models", nil)
	if err != nil {
		return HasilProbe{Status: 0, Tubuh: "gagal menyusun permintaan: " + err.Error()}
	}
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("User-Agent", userAgentProduk)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return HasilProbe{Status: 0, Tubuh: "tidak terjangkau: " + err.Error()}
	}
	defer res.Body.Close()
	tubuh, _ := io.ReadAll(io.LimitReader(res.Body, 1<<16))
	return HasilProbe{Status: res.StatusCode, Tubuh: potongTubuh(string(tubuh))}
}

// Probe: bentuk lama yang hanya mengembalikan status HTTP — kini wrapper
// di atas ProbeDetail (kontrak dipertahankan untuk pemanggil lama).
func (c *HttpLlmClient) Probe() int {
	return c.ProbeDetail().Status
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

// Complete menjalankan RANTAI MODEL: model aktif dulu, lalu cadangan
// berurutan — hanya untuk kegagalan soal model (403/404), lihat komentar
// struct HttpLlmClient. Status HTTP galat terakhir DIPERTAHANKAN supaya
// umkm-selftest / Gerbang F tetap membaca kode sebenarnya.
func (c *HttpLlmClient) Complete(ctx context.Context, messages []Pesan, temperature float64, maxTokens int) (string, error) {
	pesanBersih := NormalisasiPesan(messages)
	if len(pesanBersih) == 0 {
		return "", galatf("Tidak ada satu pun pesan sah untuk dikirim ke LLM " +
			"(semua peran/isi bercacat).")
	}
	rantai := c.rantaiModel()
	var galatAkhir error
	for i, model := range rantai {
		jawaban, err := c.completeModel(ctx, pesanBersih, model, temperature, maxTokens)
		if err == nil {
			if i > 0 {
				// Promosi: model cadangan yang berhasil menjadi model
				// aktif klien ini untuk panggilan-panggilan lanjutan.
				c.mu.Lock()
				c.Model_ = model
				c.mu.Unlock()
			}
			return jawaban, nil
		}
		galatAkhir = err
		var le *LlmError
		if !errors.As(err, &le) ||
			(le.Status != http.StatusForbidden && le.Status != http.StatusNotFound) {
			// 401 (kunci), 429 (batas laju), 5xx, jaringan, jawaban kosong,
			// bentuk respons — bukan soal model: tidak turun rantai.
			return "", err
		}
		// 403/404 = soal model — lanjut ke cadangan berikutnya.
	}
	if len(rantai) > 1 && galatAkhir != nil {
		status := 0
		var le *LlmError
		if errors.As(galatAkhir, &le) {
			status = le.Status
		}
		return "", &LlmError{
			msg: fmt.Sprintf("seluruh rantai model ditolak penyedia (%s): %v",
				strings.Join(rantai, " -> "), galatAkhir),
			Status: status,
		}
	}
	return "", galatAkhir
}

// completeModel: satu percobaan POST /chat/completions untuk satu model.
func (c *HttpLlmClient) completeModel(ctx context.Context, pesanBersih []Pesan, model string, temperature float64, maxTokens int) (string, error) {
	payload := chatRequest{
		Model:       model,
		Messages:    pesanBersih,
		Temperature: temperature,
		MaxTokens:   maxTokens,
	}
	// Model reasoning (gpt-oss di Groq) menghabiskan token berpikir
	// SEBELUM jawaban — anggaran kecil membuat jawaban kosong. Usaha
	// rendah + anggaran lebih longgar menjaga asisten tetap ringkas
	// namun tidak pernah kosong.
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
	req.Header.Set("User-Agent", userAgentProduk) // run-6: bukan Go-http-client anonim

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", galatf("LLM tidak terjangkau: %v", err)
	}
	defer res.Body.Close()

	tubuh, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode >= 400 {
		return "", galatHTTP(res.StatusCode, string(tubuh))
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
