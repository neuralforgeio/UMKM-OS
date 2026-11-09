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
