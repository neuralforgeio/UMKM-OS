package ai

// Unittest konfigurasi LLM runtime (port perilaku
// test_llm_config_store.py): file menimpa env per-field, kosong
// mewarisi, enabled=false mematikan total, tulis atomik, MODEL LOCK.

import (
	"os"
	"path/filepath"
	"testing"
)

func storeBaru(t *testing.T, env EnvSource) (*ConfigStore, string) {
	t.Helper()
	dir := t.TempDir()
	return NewConfigStore(dir, env), dir
}

func envUji() EnvSource {
	return EnvSource{
		Enabled: true,
		BaseURL: "https://api.groq.com/openai/v1",
		APIKey:  "gsk_envaja1234567890",
		Model:   "openai/gpt-oss-20b",
	}
}

func TestEfektifTanpaFilePakaiEnv(t *testing.T) {
	s, _ := storeBaru(t, envUji())
	cfg := s.Efektif()
	if cfg.Source != "env" || cfg.BaseURL != "https://api.groq.com/openai/v1" ||
		cfg.Model != "openai/gpt-oss-20b" || cfg.APIKey != "gsk_envaja1234567890" {
		t.Fatalf("tanpa file harus pakai env apa adanya: %+v", cfg)
	}
	if !cfg.Terkonfigurasi() {
		t.Error("env lengkap harus terkonfigurasi")
	}
	if cfg.ModelLocked {
		t.Error("tanpa file, model tidak terkunci")
	}
}

func TestFileMenimpaEnvPerField(t *testing.T) {
	s, dir := storeBaru(t, envUji())
	tulisFile(t, filepath.Join(dir, "llm_config.json"),
		`{"enabled": true, "base_url": "http://host:11434/v1", "api_key": "", "model": "llama3"}`)
	cfg := s.Efektif()
	if cfg.Source != "file" {
		t.Errorf("source harus file: %q", cfg.Source)
	}
	if cfg.BaseURL != "http://host:11434/v1" || cfg.Model != "llama3" {
		t.Errorf("field terisi di file harus menimpa env: %+v", cfg)
	}
	if cfg.APIKey != "gsk_envaja1234567890" {
		t.Errorf("field kosong di file mewarisi env: %q", cfg.APIKey)
	}
}

func TestFileEnabledFalseMematikanTotal(t *testing.T) {
	s, dir := storeBaru(t, envUji())
	tulisFile(t, filepath.Join(dir, "llm_config.json"),
		`{"enabled": false, "base_url": "https://api.groq.com/openai/v1", "api_key": "gsk_x", "model": "m"}`)
	cfg := s.Efektif()
	if cfg.Enabled || cfg.Terkonfigurasi() {
		t.Errorf("enabled=false di file harus mematikan LLM total: %+v", cfg)
	}
	if s.Klien() != nil {
		t.Error("klien harus nil saat LLM dimatikan lewat file")
	}
}

func TestFileKorupJatuhKeEnv(t *testing.T) {
	s, dir := storeBaru(t, envUji())
	tulisFile(t, filepath.Join(dir, "llm_config.json"), `{bukan json`)
	if cfg := s.Efektif(); cfg.Source != "env" {
		t.Errorf("file korup harus jatuh ke env: %+v", cfg)
	}
}

func TestSimpanLaluBacaKembali(t *testing.T) {
	s, _ := storeBaru(t, envUji())
	if err := s.Simpan("https://baru.example/v1", "gsk_baru1234567890", "model-baru", true, false); err != nil {
		t.Fatal(err)
	}
	cfg := s.Efektif()
	if cfg.Source != "file" || cfg.BaseURL != "https://baru.example/v1" ||
		cfg.Model != "model-baru" || cfg.APIKey != "gsk_baru1234567890" {
		t.Fatalf("hasil simpan harus terbaca kembali: %+v", cfg)
	}
	// Tidak ada file .tmp yang tertinggal (tulis atomik).
	_ = filepath.Walk(".", func(path string, info os.FileInfo, err error) error {
		if err == nil && filepath.Ext(path) == ".tmp" {
			t.Errorf("file sementara tertinggal: %s", path)
		}
		return nil
	})
}

func TestModelLockTerbacaDanTersimpan(t *testing.T) {
	s, dir := storeBaru(t, envUji())
	tulisFile(t, filepath.Join(dir, "llm_config.json"),
		`{"enabled": true, "base_url": "https://api.groq.com/openai/v1", "api_key": "gsk_x1234567890", "model": "m", "model_locked": true}`)
	if cfg := s.Efektif(); !cfg.ModelLocked {
		t.Fatal("model_locked=true di file harus terbaca")
	}
	// Simpan ulang tanpa menyentuh kunci — kunci bertahan.
	if err := s.Simpan("https://api.groq.com/openai/v1", "gsk_x1234567890", "m", true, true); err != nil {
		t.Fatal(err)
	}
	if cfg := s.Efektif(); !cfg.ModelLocked {
		t.Error("kunci model harus bertahan setelah simpan ulang")
	}
	// Developer membuka kunci.
	if err := s.SetModelLocked(false); err != nil {
		t.Fatal(err)
	}
	if cfg := s.Efektif(); cfg.ModelLocked {
		t.Error("SetModelLocked(false) harus membuka kunci")
	}
}

func TestMaskKey(t *testing.T) {
	if MaskKey("gsk_abc123wxyz") != "gsk_****wxyz" {
		t.Errorf("MaskKey penuh = %q", MaskKey("gsk_abc123wxyz"))
	}
	if MaskKey("pendek") != "****" {
		t.Errorf("kunci pendek = %q", MaskKey("pendek"))
	}
	if MaskKey("") != "" {
		t.Errorf("kunci kosong = %q", MaskKey(""))
	}
}
