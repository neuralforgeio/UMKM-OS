package tests

import (
	"strconv"
	"strings"
	"testing"

	"github.com/neuralforgeio/internal/config"
)

// Uji mekanisme pembacaan konfigurasi: env menang, fallback saat kosong,
// dan penjaga format SemVer untuk AppVersion.

func TestGetFallbackSaatEnvKosong(t *testing.T) {
	// kunci yang pasti tidak ada di env/.env mana pun
	got := config.Get("UNIT_TEST_KUNCI_PASTI_KOSONG", "nilai-cadangan")
	if got != "nilai-cadangan" {
		t.Fatalf("Get = %q, want fallback %q", got, "nilai-cadangan")
	}
}

func TestGetEnvMenangAtasFallback(t *testing.T) {
	t.Setenv("UNIT_TEST_KUNCI", "nilai-dari-env")
	if got := config.Get("UNIT_TEST_KUNCI", "nilai-cadangan"); got != "nilai-dari-env" {
		t.Fatalf("Get = %q, want \"nilai-dari-env\"", got)
	}
}

func TestGetInt(t *testing.T) {
	t.Run("angka valid", func(t *testing.T) {
		t.Setenv("UNIT_TEST_ANGKA", "42")
		if got := config.GetInt("UNIT_TEST_ANGKA", 0); got != 42 {
			t.Fatalf("GetInt = %d, want 42", got)
		}
	})
	t.Run("angka rusak jatuh ke fallback", func(t *testing.T) {
		t.Setenv("UNIT_TEST_ANGKA", "bukan-angka")
		if got := config.GetInt("UNIT_TEST_ANGKA", 7); got != 7 {
			t.Fatalf("GetInt = %d, want fallback 7", got)
		}
	})
	t.Run("env kosong jatuh ke fallback", func(t *testing.T) {
		if got := config.GetInt("UNIT_TEST_ANGKA_PASTI_KOSONG", 9); got != 9 {
			t.Fatalf("GetInt = %d, want fallback 9", got)
		}
	})
}

func TestPortBisaDioverride(t *testing.T) {
	t.Setenv("PORT", "9090")
	if config.Port() != "9090" {
		t.Fatalf("Port() = %q, want \"9090\"", config.Port())
	}
}

func TestOwnerPasswordTidakPunyaDefault(t *testing.T) {
	// Keputusan keamanan yang dijaga test ini: password owner tidak
	// boleh punya nilai default apa pun di dalam kode (repo ini publik).
	t.Setenv("OWNER_PASSWORD", "")
	if config.OwnerPassword() != "" {
		t.Fatalf("OwnerPassword() = %q, harus kosong saat env tidak diisi", config.OwnerPassword())
	}
}

func TestDeveloperKredensialTidakPunyaDefault(t *testing.T) {
	// Sama seperti owner: akun DEVELOPER hanya dibuat saat env diisi.
	t.Setenv("DEVELOPER_EMAIL", "")
	t.Setenv("DEVELOPER_PASSWORD", "")
	if config.DeveloperEmail() != "" || config.DeveloperPassword() != "" {
		t.Fatal("DEVELOPER_EMAIL/PASSWORD tidak boleh punya default di kode")
	}
}

func TestAppVersionFormatSemver(t *testing.T) {
	// VERSIONS.csv, tag git, dan endpoint /version semuanya mengikuti
	// format ini — kalau formatnya rusak, rilis ikut kacau.
	parts := strings.Split(config.AppVersion, ".")
	if len(parts) != 3 {
		t.Fatalf("AppVersion = %q, ingin 3 bagian MAJOR.MINOR.PATCH", config.AppVersion)
	}
	for _, p := range parts {
		if _, err := strconv.Atoi(p); err != nil {
			t.Fatalf("bagian %q dari AppVersion bukan angka", p)
		}
	}
}

// run-6: parse LLM_FALLBACK_MODELS — env menang atas default, entri
// kosong/kembar/spasi dibersihkan, default = model Groq yang hidup.
func TestLLMFallbackModelsParse(t *testing.T) {
	t.Run("default dua model Groq yang masih hidup", func(t *testing.T) {
		got := config.LLMFallbackModels()
		if len(got) != 2 || got[0] != "openai/gpt-oss-120b" || got[1] != "qwen/qwen3.8-27b" {
			t.Fatalf("LLMFallbackModels() = %v; ingin [openai/gpt-oss-120b qwen/qwen3.8-27b]", got)
		}
	})
	t.Run("env menang: koma + spasi + kembar + kosong dibersihkan", func(t *testing.T) {
		t.Setenv("LLM_FALLBACK_MODELS", " a , b,,a , openai/gpt-oss-20b ")
		got := config.LLMFallbackModels()
		if len(got) != 3 || got[0] != "a" || got[1] != "b" || got[2] != "openai/gpt-oss-20b" {
			t.Fatalf("parse = %v; ingin [a b openai/gpt-oss-20b]", got)
		}
	})
}

// run-7: konfigurasi cadangan data + salinan database — default warung
// tetap sederhana (satu node, backup per jam, 48 berkas), env bisa mengubah
// semuanya, DATABASE_REPLICA_URL kosong default = mode lama tetap sah.
func TestConfigBackupDanSalinan(t *testing.T) {
	t.Run("default", func(t *testing.T) {
		if got := config.DatabaseReplicaURL(); got != "" {
			t.Fatalf("DATABASE_REPLICA_URL default harus kosong (mode satu-node): %q", got)
		}
		if got := config.DatabaseNodeName(); got != "pusat" {
			t.Fatalf("DATABASE_NODE_NAME default: %q", got)
		}
		if got := config.BackupDir(); got != "backups" {
			t.Fatalf("BACKUP_DIR default: %q", got)
		}
		if got := config.BackupIntervalSeconds(); got != 3600 {
			t.Fatalf("BACKUP_INTERVAL_SECONDS default: %d", got)
		}
		if got := config.BackupKeep(); got != 48 {
			t.Fatalf("BACKUP_KEEP default: %d", got)
		}
	})
	t.Run("env menang", func(t *testing.T) {
		t.Setenv("DATABASE_REPLICA_URL", "postgres://u:p@db-salinan:5432/umkmos")
		t.Setenv("DATABASE_NODE_NAME", "salinan")
		t.Setenv("BACKUP_DIR", "cadangan")
		t.Setenv("BACKUP_INTERVAL_SECONDS", "900")
		t.Setenv("BACKUP_KEEP", "12")
		t.Setenv("DB_PING_INTERVAL_SECONDS", "7")
		t.Setenv("DB_FAILOVER_AFTER_FAILS", "2")
		if got := config.DatabaseReplicaURL(); got != "postgres://u:p@db-salinan:5432/umkmos" {
			t.Fatalf("DATABASE_REPLICA_URL env: %q", got)
		}
		if got := config.DatabaseNodeName(); got != "salinan" {
			t.Fatalf("DATABASE_NODE_NAME env: %q", got)
		}
		if got := config.BackupDir(); got != "cadangan" {
			t.Fatalf("BACKUP_DIR env: %q", got)
		}
		if got := config.BackupIntervalSeconds(); got != 900 {
			t.Fatalf("BACKUP_INTERVAL_SECONDS env: %d", got)
		}
		if got := config.BackupKeep(); got != 12 {
			t.Fatalf("BACKUP_KEEP env: %d", got)
		}
		if got := config.DbPingIntervalSeconds(); got != 7 {
			t.Fatalf("DB_PING_INTERVAL_SECONDS env: %d", got)
		}
		if got := config.DbFailoverAfterFails(); got != 2 {
			t.Fatalf("DB_FAILOVER_AFTER_FAILS env: %d", got)
		}
	})
}
