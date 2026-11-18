package ai

// Uji sambungan LLM untuk OSCAR (port ml-service v1.0.0) — tombol
// "Tes Koneksi" di Pengaturan -> Asisten AI. Menyapa penyedia
// SUNGGUHAN dengan konfigurasi efektif saat itu, mengukur latensi,
// dan mengembalikan contoh jawaban. Kunci hanya keluar dalam bentuk
// DIMASKER (aturan 9 prompt).

import (
	"context"
	"time"
)

// UjiPrompt: pendek, murah, jawabannya mudah diperiksa mata.
const UjiPrompt = "Balas hanya dengan kata SIAP."

const panjangContoh = 120

// HasilSelftest: kontrak POST /assistant/llm-selftest (frontend
// v1.0.0, lib/assistant.ts AssistantLlmSelftest).
type HasilSelftest struct {
	Ok           bool    `json:"ok"`
	Configured   bool    `json:"configured"`
	Mode         string  `json:"mode"`
	AnswerSample *string `json:"answer_sample"`
	LatencyMs    *int64  `json:"latency_ms"`
	Error        *string `json:"error"`
	Model        string  `json:"model"`
	APIKeyMasked string  `json:"api_key_masked"`
	Source       string  `json:"source"`
	BaseURL      string  `json:"base_url"`
}

// RunSelftest menguji satu panggilan chat/completions dengan
// konfigurasi efektif. klien nil = bangun klien nyata dari store
// (dipakai endpoint produksi); unittest menyuntik stub.
func RunSelftest(ctx context.Context, store *ConfigStore, klien Client) HasilSelftest {
	cfg := store.Efektif()
	siap := cfg.Terkonfigurasi()
	hasil := HasilSelftest{
		Ok:           false,
		Configured:   siap,
		Mode:         "data",
		AnswerSample: nil,
		LatencyMs:    nil,
		Error:        nil,
		Model:        cfg.Model,
		APIKeyMasked: MaskKey(cfg.APIKey),
		Source:       cfg.Source,
		BaseURL:      cfg.BaseURL,
	}
	if !siap {
		pesan := "Mode AI belum aktif: saklar, URL dasar, atau nama model masih kosong."
		hasil.Error = &pesan
		return hasil
	}
	hasil.Mode = "ai"
	if klien == nil {
		klien = store.Klien()
		if klien == nil {
			// Konfigurasi berubah di antara dua pembacaan, sangat jarang.
			pesan := "Konfigurasi berubah sebelum uji dijalankan."
			hasil.Error = &pesan
			return hasil
		}
	}
	mulai := time.Now()
	jawaban, err := klien.Complete(ctx, []Pesan{{Role: "user", Content: UjiPrompt}}, 0.0, 800)
	latensi := time.Since(mulai).Milliseconds()
	hasil.LatencyMs = &latensi
	if err != nil {
		pesan := err.Error()
		hasil.Error = &pesan
		return hasil
	}
	contoh := jawaban
	if contoh != "" {
		if len(contoh) > panjangContoh {
			contoh = contoh[:panjangContoh]
		}
		hasil.AnswerSample = &contoh
	}
	hasil.Ok = true
	return hasil
}
