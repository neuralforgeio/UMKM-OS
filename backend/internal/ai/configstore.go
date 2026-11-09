package ai

// Konfigurasi LLM runtime (port ml-service v3.2.0) — tanpa restart
// container. Pengaturan disimpan sebagai JSON di volume aidata
// (llm_config.json) lewat PUT /assistant/llm-config (dari UI
// Pengaturan) dan langsung berlaku pada permintaan chat BERIKUTNYA
// karena klien dibaca dari konfigurasi efektif per panggilan.
//
// Aturan penggabungan (file menang, env fallback):
//   - file tidak ada / korup           => pakai env apa adanya;
//   - field string di file TERISI      => menimpa env;
//   - field string di file KOSONG      => mewarisi env (mis. URL+model
//     diisi via UI, kunci tetap dari env);
//   - "enabled": false di file         => LLM mati total (menimpa env).
//
// ERA GO MURNI — "model_locked": true di file berarti pilihan model
// DIKUNCI developer; PUT dari OWNER ditolak 403 (pemilik tetap boleh
// membaca + mengganti kunci/URL, model beku sampai developer membuka).
//
// Keamanan: file ini hidup di dalam volume docker, tidak pernah dibaca
// browser; GET /assistant/llm-config hanya mengembalikan kunci yang
// DIMASKER. Tulis atomik (.tmp + rename) supaya pembaca tidak pernah
// melihat JSON setengah jadi.

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// EnvSource membaca env sekali (konvensi proses; nilai diambil dari
// config package agar mudah disuntik saat unittest).
type EnvSource struct {
	Enabled bool
	BaseURL string
	APIKey  string
	Model   string
}

// ConfigEfektif: konfigurasi LLM hasil penggabungan env + file.
type ConfigEfektif struct {
	Enabled      bool   `json:"enabled"`
	BaseURL      string `json:"base_url"`
	APIKey       string `json:"api_key"`
	Model        string `json:"model"`
	ModelLocked  bool   `json:"model_locked"`
	Source       string `json:"source"` // "file" | "env"
}

// ConfigStore membaca/menulis llm_config.json dengan cache mtime
// (stat() murah, json hanya diparse saat file berganti).
type ConfigStore struct {
	mu      sync.Mutex
	dir     string
	env     EnvSource
	mtime   time.Time
	punya   bool
	cache   map[string]interface{}
}

// NewConfigStore: dir = direktori volume (AI_DATA_DIR, mis. /app/aidata).
func NewConfigStore(dir string, env EnvSource) *ConfigStore {
	return &ConfigStore{dir: dir, env: env}
}

func (s *ConfigStore) path() string { return filepath.Join(s.dir, "llm_config.json") }

type fileConfig struct {
	Enabled     *bool  `json:"enabled"`
	BaseURL     string `json:"base_url"`
	APIKey      string `json:"api_key"`
	Model       string `json:"model"`
	ModelLocked bool   `json:"model_locked"`
}

func (s *ConfigStore) loadFile() *fileConfig {
	s.mu.Lock()
	defer s.mu.Unlock()
	st, err := os.Stat(s.path())
	if err != nil {
		s.punya = false
		s.cache = nil
		return nil
	}
	if s.punya && s.cache != nil && st.ModTime().Equal(s.mtime) {
		fc := fileConfig{}
		b, _ := json.Marshal(s.cache)
		_ = json.Unmarshal(b, &fc)
		return &fc
	}
	data, err := os.ReadFile(s.path())
	if err != nil {
		s.punya = false
		s.cache = nil
		return nil
	}
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil || raw == nil {
		s.punya = false
		s.cache = nil
		return nil
	}
	s.punya = true
	s.mtime = st.ModTime()
	s.cache = raw
	fc := fileConfig{}
	b, _ := json.Marshal(raw)
	_ = json.Unmarshal(b, &fc)
	return &fc
}

// Efektif: konfigurasi efektif (file menimpa env per-field).
func (s *ConfigStore) Efektif() ConfigEfektif {
	hasil := ConfigEfektif{
		Enabled: s.env.Enabled,
		BaseURL: s.env.BaseURL,
		APIKey:  s.env.APIKey,
		Model:   s.env.Model,
		Source:  "env",
	}
	if f := s.loadFile(); f != nil {
		if f.Enabled != nil {
			hasil.Enabled = *f.Enabled
		}
		if v := trim(f.BaseURL); v != "" {
			hasil.BaseURL = v
		}
		if v := trim(f.APIKey); v != "" {
			hasil.APIKey = v
		}
		if v := trim(f.Model); v != "" {
			hasil.Model = v
		}
		hasil.ModelLocked = f.ModelLocked
		hasil.Source = "file"
	}
	return hasil
}

// Terkonfigurasi: true bila LLM aktif (saklar + URL + model terisi).
// API key TIDAK diwajibkan (Ollama lokal jalan tanpa kunci).
func (c ConfigEfektif) Terkonfigurasi() bool {
	return c.Enabled && c.BaseURL != "" && c.Model != ""
}

// Klien siap pakai dari konfigurasi efektif, atau nil bila belum
// dikonfigurasi (pemanggil memakai jalur penolakan jujur 503).
func (s *ConfigStore) Klien() Client {
	cfg := s.Efektif()
	if !cfg.Terkonfigurasi() {
		return nil
	}
	return NewHttpLlmClient(cfg.BaseURL, cfg.APIKey, cfg.Model)
}

// Simpan: tulis konfigurasi (atomik). enabled=false = matikan LLM
// total. Menyimpan field kosong + enabled=false tetap menulis file
// supaya niat "OFF" pengguna menimpa env.
func (s *ConfigStore) Simpan(baseURL, apiKey, model string, enabled, modelLocked bool) error {
	muat := map[string]interface{}{
		"enabled":      enabled,
		"base_url":     trim(baseURL),
		"api_key":      trim(apiKey),
		"model":        trim(model),
		"model_locked": modelLocked,
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := os.MkdirAll(s.dir, 0o755); err != nil {
		return err
	}
	b, err := json.MarshalIndent(muat, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path() + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	if err := os.Rename(tmp, s.path()); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	if st, err := os.Stat(s.path()); err == nil {
		s.punya = true
		s.mtime = st.ModTime()
		s.cache = muat
	}
	return nil
}

// SetModelLocked: kunci/buka kunci pilihan model tanpa mengubah field
// lain (dipakai PUT khusus developer bila suatu saat diperlukan).
func (s *ConfigStore) SetModelLocked(locked bool) error {
	cfg := s.Efektif()
	if cfg.Source != "file" {
		return s.Simpan("", "", "", cfg.Enabled, locked)
	}
	f := s.loadFile()
	if f == nil {
		return s.Simpan("", "", "", cfg.Enabled, locked)
	}
	return s.Simpan(f.BaseURL, f.APIKey, f.Model, deref(f.Enabled, true), locked)
}

func deref(b *bool, fallback bool) bool {
	if b == nil {
		return fallback
	}
	return *b
}

func trim(s string) string {
	return cutSpace(s)
}

func cutSpace(s string) string {
	start := 0
	for start < len(s) && (s[start] == ' ' || s[start] == '\t' || s[start] == '\n' || s[start] == '\r') {
		start++
	}
	end := len(s)
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\n' || s[end-1] == '\r') {
		end--
	}
	return s[start:end]
}

// MaskKey: masker kunci untuk tampilan — "gsk_abc...wxyz" -> "gsk_****wxyz".
func MaskKey(key string) string {
	kunci := cutSpace(key)
	if kunci == "" {
		return ""
	}
	if len(kunci) <= 8 {
		return "****"
	}
	return kunci[:4] + "****" + kunci[len(kunci)-4:]
}
