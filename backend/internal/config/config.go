package config

import (
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// AppVersion mengikuti Semantic Versioning: MAJOR.MINOR.PATCH.
// 2.0.0 = ERA GO MURNI: layanan Python (FastAPI + Prophet) dihapus
// total; OSCAR (asisten AI dwi-mode), OSCAR Developer AI (laporan
// lintas toko ber-PIN + pelaporan proaktif), audit ber-IP + geo
// lookup, dan ramalan statistik kini hidup DI DALAM backend Go ini.
// backend-go di-rename menjadi backend — satu-satunya backend.
// 2.0.1 = HOTFIX pra-rilis publik: tag JSON /reports/profit diseragamkan
// snake_case (dulu camelCase sementara frontend membaca snake_case —
// akar kartu laba NaN di halaman Transaksi), dan VERSIONS.csv kini
// dikirim utuh oleh skrip pemasangan run-3.
// 2.0.2 = HOTFIX OSCAR "tidak merespons": galat HTTP penyedia kini
// membawa kode status terstruktur (LlmError.Status) sehingga binary
// umkm-selftest melaporkan HTTP 401/403/429 yang sebenarnya (dulu ERR
// kabur); pesan 403 menjelaskan dua penyebab nyata — kunci
// nonaktif/dicabut vs model diblokir organisasi/proyek; mode baru
// umkm-selftest --reset-llm menghapus llm_config.json di volume aidata
// agar konfigurasi env (kunci baru di .env root) kembali menjadi sumber
// tunggal — akar OSCAR diam setelah kunci Groq lama dicabut penyedia.
// 2.0.3 = HOTFIX Gerbang E 25P02 + rantai model cadangan: (1) uji
// bentrok SKU di umkm-selftest --db dibungkus SAVEPOINT + ROLLBACK TO
// SAVEPOINT — tanpa itu error 23505 yang memang diharapkan menandai
// transaksi ABORTED sehingga uji chat_history dan audit ber-IP
// berikutnya ditolak Postgres dengan 25P02 current transaction is
// aborted (akar kegagalan run-5 di mesin pemilik; direproduksi lalu
// diverifikasi penuh terhadap PostgreSQL 17 sungguhan); (2) klien LLM
// membawa RANTAI MODEL CADANGAN LLM_FALLBACK_MODELS (default
// openai/gpt-oss-120b,qwen/qwen3.8-27b — model Groq yang masih hidup
// per 2026-11; llama 3.1/3.3 kini enterprise-only): HTTP 403/404 pada
// model utama otomatis turun ke cadangan dan model yang berhasil
// dipromosikan untuk panggilan lanjutan; 401/429/5xx tetap gagal jujur;
// permintaan keluar memakai User-Agent produk sendiri (bukan
// Go-http-client anonim); galat 403 menyertakan potongan balasan
// penyedia sehingga kode seperti model_permission_blocked_org langsung
// terbaca.
// 2.1.0 = FITUR CADANGAN DATA + SALINAN DATABASE (permintaan pemilik):
// (1) BACKUP: dump SQL gzip (pg_dump milik klien psql/postgres di image
// runtime) bisa dipicu KAPAN PUN lewat POST /admin/backup/run (owner/
// developer) atau otomatis tiap BACKUP_INTERVAL_SECONDS; retensi
// BACKUP_KEEP menghapus berkas tertua; daftar + unduh + pemulihan
// (restore) ke node mana pun lewat endpoint; (2) SALINAN DATABASE:
// service db-salinan (PostgreSQL kedua) berfungsi node berikutnya —
// ketika pusat down, backend otomatis gagal-ke-salinan (failover) dan
// tetap melayani transaksi; ketika pusat kembali hidup, sinkron balik
// otomatis menerapkan dump beda-waktu salinan ke pusat lalu pusat
// mengambil alih lagi (failback); (3) probe GET /models kini membawa
// ISI BALASAN penyedia (PROBERAW) — dua wajah 403 (IP diblokir tepi
// penyedia vs kunci mati) akhirnya bisa dibedakan dari konsol.
const AppVersion = "2.2.0"

func init() {
	_ = godotenv.Load()
}

func Get(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func GetInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

func Port() string { return Get("PORT", "8080") }
func DatabaseURL() string {
	return Get("DATABASE_URL", "postgres://umkm:umkm@localhost:5432/umkmos?sslmode=disable")
}
func JWTSecret() string    { return Get("JWT_SECRET", "umkm-os-dev-secret") }
func JWTExpiresHours() int { return GetInt("JWT_EXPIRES_H", 24) }
func ClientURL() string    { return Get("CLIENT_URL", "http://localhost:3000") }
func OwnerEmail() string   { return Get("OWNER_EMAIL", "owner@umkm.local") }

// OwnerPassword TIDAK punya default: repo ini publik, password apa pun
// yang tertulis di kode langsung menjadi pintu belakang. Bila env kosong
// dan database masih baru, seedOwner membuat password acak 16 karakter
// yang dicetak SEKALI ke layar konsol (tidak pernah masuk file log).
func OwnerPassword() string { return Get("OWNER_PASSWORD", "") }

// Akun DEVELOPER (konsol lintas outlet): TIDAK ADA kredensial default —
// repo ini publik, password apa pun yang tertulis di kode langsung
// menjadi pintu belakang. Akun hanya dibuat saat boot bila keduanya
// diatur di backend-go/.env (file itu sudah di-gitignore):
//
//	DEVELOPER_EMAIL=dev@warunganda.id
//	DEVELOPER_PASSWORD=password-kuat-pilihan-anda
//
// Setelah akun dibuat, ganti password selanjutnya lewat menu ganti
// password biasa (login memakai hash di database, bukan env).
func DeveloperEmail() string    { return Get("DEVELOPER_EMAIL", "") }
func DeveloperPassword() string { return Get("DEVELOPER_PASSWORD", "") }

// ===== ERA GO MURNI: konfigurasi OSCAR + AI Developer (eks ml-service) =====

// InternalAPIKey: gerbang antar-layanan (blueprint BAB 5.4) — dipakai
// frontend (X-Internal-Key) untuk memanggil endpoint asisten/ramalan
// Go. Default mewarisi AUTH_SECRET root (satu tempat rotasi).
func InternalAPIKey() string { return Get("INTERNAL_API_KEY", Get("JWT_SECRET", "")) }

func LLMEnabled() bool { return Get("LLM_ENABLED", "true") == "true" }
func LLMBaseURL() string {
	return Get("LLM_BASE_URL", "https://api.groq.com/openai/v1")
}
func LLMAPIKey() string { return Get("LLM_API_KEY", "") }
func LLMModel() string  { return Get("LLM_MODEL", "openai/gpt-oss-20b") }

// LLMFallbackModels: rantai model cadangan (run-6) — dipisah koma,
// dibersihkan dari spasi/entri kosong/kembar. Dicoba BERURUTAN hanya
// bila model utama ditolak 403 (hak model) atau 404 (model dimatikan);
// 401/429/5xx tidak memicu turun. Default: dua model Groq yang masih
// hidup per 2026-11 (gpt-oss-120b produksi + qwen3.8-27b preview —
// llama 3.1/3.3 sudah enterprise-only). Kosongkan eksplisit
// (LLM_FALLBACK_MODELS=) untuk mematikan cadangan.
func LLMFallbackModels() []string {
	return pecahRantaiModel(Get("LLM_FALLBACK_MODELS",
		"openai/gpt-oss-120b,qwen/qwen3.8-27b"))
}

// pecahRantaiModel: parser daftar model dipisah koma (dipakai unittest).
func pecahRantaiModel(s string) []string {
	hasil := []string{}
	for _, bagian := range strings.Split(s, ",") {
		m := strings.TrimSpace(bagian)
		if m == "" {
			continue
		}
		sudah := false
		for _, x := range hasil {
			if x == m {
				sudah = true
				break
			}
		}
		if !sudah {
			hasil = append(hasil, m)
		}
	}
	return hasil
}

// AssistantRateLimitPerHour: batas laju sliding-window per pemilik
// (default 12/jam — blueprint BAB 9.3).
func AssistantRateLimitPerHour() int { return GetInt("ASSISTANT_RATE_LIMIT_PER_HOUR", 12) }

// AssistantCacheSeconds: TTL cache jawaban per user+outlet+pertanyaan
// (default 600 detik).
func AssistantCacheSeconds() int { return GetInt("ASSISTANT_CACHE_SECONDS", 600) }

// DevAIRateLimitPerHour: batas laju khusus endpoint AI Developer
// (default 6/jam — laporan lintas toko jauh lebih berat dari chat).
func DevAIRateLimitPerHour() int { return GetInt("DEV_AI_RATE_LIMIT_PER_HOUR", 6) }

// GeoLookupEnabled: enrich IP audit log dengan kota/kota negara via
// layanan ip-api.com (default aktif; matikan bila ingin tanpa trafik
// keluar sama sekali).
func GeoLookupEnabled() bool { return Get("GEO_LOOKUP_ENABLED", "true") == "true" }

// AIDataDir: volume tempat llm_config.json + dev_config.json +
// dev_reports.json (eks volume mlmodels; di compose: aidata:/app/aidata).
func AIDataDir() string { return Get("AI_DATA_DIR", "aidata") }

// ===== RUN-7: CADANGAN DATA + SALINAN DATABASE (permintaan pemilik) =====

// DatabaseReplicaURL: alamat node SALINAN (db-salinan) — kosong = mode
// satu-node lama (tanpa failover, tanpa sinkron balik). Ketika terisi,
// backend memantau kesehatan pusat dan salinan; pool aktif berpindah
// otomatis saat pusat mati, dan sinkron balik mengembalikan perubahan
// zaman-salinan ke pusat begitu pusat hidup kembali.
func DatabaseReplicaURL() string { return Get("DATABASE_REPLICA_URL", "") }

// DatabaseNodeName: nama node ini untuk catatan failover/backup
// (default "pusat"; compose db-salinan memasang "salinan").
func DatabaseNodeName() string { return Get("DATABASE_NODE_NAME", "pusat") }

// BackupDir: folder berkas backup dump SQL gzip (di compose dipasang ke
// volume backups supaya cadangan bertahan lintas rebuild container).
func BackupDir() string { return Get("BACKUP_DIR", "backups") }

// BackupIntervalSeconds: periode backup otomatis loop latar belakang;
// 0 = MATI (backup hanya manual lewat tombol / endpoint).
func BackupIntervalSeconds() int { return GetInt("BACKUP_INTERVAL_SECONDS", 3600) }

// BackupKeep: jumlah berkas backup yang disimpan (retensi); dump
// tertua dihapus saat lewat. 0 = tanpa retensi (semua disimpan).
func BackupKeep() int { return GetInt("BACKUP_KEEP", 48) }

// DbPingIntervalSeconds: periode loop pengecek kesehatan node database
// (default 5 detik — cukup tanggap untuk warung, cukup tenang untuk
// laptop pemilik).
func DbPingIntervalSeconds() int { return GetInt("DB_PING_INTERVAL_SECONDS", 5) }

// DbFailoverAfterFails: berapa ping gagal BERTURUT-TURUT sebelum pool
// berpindah node (default 3 — toleran terhadap kedip jaringan sesaat).
func DbFailoverAfterFails() int { return GetInt("DB_FAILOVER_AFTER_FAILS", 3) }
