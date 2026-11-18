package handler

// Gerbang Developer (v2.2.0): konsol developer jauh lebih kompleks —
// enam pintu khusus DEVELOPER:
//
//   1. Sesi aktif    GET/DELETE /admin/sessions — daftar sesi login
//                    hidup lintas peran + tendang (revoke) instan.
//   2. Flags         GET/PUT   /admin/flags — saklar fitur runtime
//                    tanpa restart; nilai tersimpan tabel flags.
//   3. Settings      GET/PUT   /admin/settings — registri kunci
//                    TERDAFTAR (kunci, tipe, nilai, keterangan) —
//                    env tetap fallback, nilai DB menang, tervalidasi.
//   4. SQL console   POST      /admin/sql — SELECT-only, parser
//                    ketat (blokir kata tulis / multi-pernyataan /
//                    komentar), LIMIT paksa, maks baris & kolom.
//   5. Health        GET       /admin/health — uptime, memori,
//                    versi, node DB aktif + jumlah failover.
//   6. Metrics       GET       /admin/metrics — omzet/produk/user
//                    per outlet + laju transaksi per jam hari ini.
//
// Semua pintu tercatat di audit_logs; teks kueri SQL console masuk
// kolom detail (terpotong 500 karakter) supaya jejak pemeriksaan
// developer bisa diurai.

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/neuralforgeio/internal/config"
	"github.com/neuralforgeio/internal/db"
	"github.com/neuralforgeio/internal/logger"
	"github.com/neuralforgeio/internal/middleware"
)

// ---- 1) Sesi aktif ------------------------------------------------------

type SesiAktif struct {
	ID        string     `json:"id"`
	UserID    int64      `json:"user_id"`
	UserName  string     `json:"user_name"`
	UserRole  string     `json:"user_role"`
	IP        string     `json:"ip"`
	UserAgent string     `json:"user_agent"`
	CreatedAt time.Time  `json:"created_at"`
	LastSeen  time.Time  `json:"last_seen"`
	ExpiresAt time.Time  `json:"expires_at"`
	RevokedAt *time.Time `json:"revoked_at,omitempty"`
}

// GET /api/v1/admin/sessions (DEVELOPER): seluruh sesi 24 jam terakhir
// (hidup + baru dicabut) lintas peran — developer memantau dari mana
// saja orang login warung ini.
func ListSessions(w http.ResponseWriter, r *http.Request) {
	barisan, err := db.Pool.Query(r.Context(), `
		SELECT s.id, s.user_id, COALESCE(u.name,''), COALESCE(u.role,''),
		       s.ip, s.user_agent, s.created_at, s.last_seen, s.expires_at, s.revoked_at
		FROM sessions s LEFT JOIN users u ON u.id = s.user_id
		WHERE s.expires_at > NOW() - INTERVAL '24 hours'
		ORDER BY s.revoked_at NULLS FIRST, s.last_seen DESC LIMIT 200`)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membaca sesi")
		return
	}
	daftar, err := pgx.CollectRows(barisan, pgx.RowToFunc[SesiAktif](func(row pgx.CollectableRow) (SesiAktif, error) {
		var s SesiAktif
		err := row.Scan(&s.ID, &s.UserID, &s.UserName, &s.UserRole, &s.IP,
			&s.UserAgent, &s.CreatedAt, &s.LastSeen, &s.ExpiresAt, &s.RevokedAt)
		return s, err
	}))
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membaca sesi")
		return
	}
	OK(w, map[string]interface{}{"sessions": daftar, "total": len(daftar)})
}

// DELETE /api/v1/admin/sessions/{sid} (DEVELOPER): tendang sesi —
// set revoked_at; token ber-sid itu ditolak RequireAuth pada
// permintaan BERIKUTNYA (instan, tanpa menunggu kadaluarsa).
// Sesi pemanggil sendiri dilarang ditendang lewat pintu ini
// (developer harus logout biasa — jangan mengunci diri keluar
// di tengah pemeliharaan).
func RevokeSession(w http.ResponseWriter, r *http.Request) {
	sid := r.PathValue("sid")
	if sid == "" {
		Err(w, http.StatusBadRequest, "sid sesi tidak valid")
		return
	}
	klaim := middleware.User(r)
	if klaim != nil && klaim.SessionID == sid {
		Err(w, http.StatusBadRequest, "Tidak bisa menendang sesi sendiri — gunakan logout")
		return
	}
	tag, err := db.Pool.Exec(r.Context(),
		`UPDATE sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`, sid)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal mencabut sesi")
		return
	}
	if tag.RowsAffected() == 0 {
		Err(w, http.StatusNotFound, "Sesi tidak ditemukan atau sudah dicabut")
		return
	}
	LogAudit(r, klaim.UserID, "SESSION_REVOKE", "session", 0, "sid="+sid)
	logger.Warn("Sesi %s dicabut oleh developer #%d", sid, klaim.UserID)
	OK(w, map[string]interface{}{"revoked": sid})
}

// ---- 2) Feature flags ---------------------------------------------------

type Bendera struct {
	Key        string    `json:"key"`
	Value      bool      `json:"value"`
	UpdatedBy  string    `json:"updated_by"`
	UpdatedAt  time.Time `json:"updated_at"`
	Keterangan string    `json:"keterangan"`
}

// BENDERA_KETERANGAN: seluruh saklar yang dikenal aplikasi. Kunci baru
// HANYA lewat kode (bukan API) supaya tidak ada "bendera yatim" tanpa
// pemakai; keterangan dipakai UI konsol developer.
var BENDERA_KETERANGAN = map[string]string{
	"forecast.enabled":    "Ramalan omzet/produk (OSCAR analitik)",
	"assistant.enabled":   "Asisten AI OSCAR di halaman owner",
	"handover.required":   "Konfirmasi serah-terima wajib sebelum barang dianggap selesai",
	"receipt.public_page": "Struk publik via QR untuk pembeli",
	"geo.lookup":          "Pelacakan kota dari IP publik di jejak audit",
	"maintenance.banner":  "Banner mode pemeliharaan di semua halaman",
}

// FlagAktif: baca nilai bendera untuk pemakai fitur (context wajib
// supaya tidak menggantung saat DB lambat). DB menang; kunci yang
// TIDAK punya baris = false; gagal baca = false (fail-closed: fitur
// sensitif mati saat DB bermasalah, bukan menyala liar).
func FlagAktif(ctx context.Context, kunci string) bool {
	if db.Pool == nil || !strings.Contains(kunci, ".") || len(kunci) > 60 {
		return false
	}
	var v bool
	err := db.Pool.QueryRow(ctx, `SELECT value FROM flags WHERE key = $1`, kunci).Scan(&v)
	return err == nil && v
}

// GET /api/v1/admin/flags (DEVELOPER): daftar bendera TERDAFTAR +
// nilai terkini (baris DB atau false untuk yang belum disetel).
func ListFlags(w http.ResponseWriter, r *http.Request) {
	barisan, err := db.Pool.Query(r.Context(), `
		SELECT f.key, f.value, COALESCE(u.name,''), f.updated_at
		FROM flags f LEFT JOIN users u ON u.id = f.updated_by ORDER BY f.key`)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membaca flags")
		return
	}
	inDB, err := pgx.CollectRows(barisan, pgx.RowToFunc[Bendera](func(row pgx.CollectableRow) (Bendera, error) {
		var b Bendera
		err := row.Scan(&b.Key, &b.Value, &b.UpdatedBy, &b.UpdatedAt)
		return b, err
	}))
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membaca flags")
		return
	}
	peta := map[string]Bendera{}
	for _, b := range inDB {
		peta[b.Key] = b
	}
	daftar := make([]Bendera, 0, len(BENDERA_KETERANGAN))
	for kunci, ket := range BENDERA_KETERANGAN {
		b := Bendera{Key: kunci, Value: false, UpdatedBy: "(belum disetel)"}
		if ada, ok := peta[kunci]; ok {
			b = ada
			if b.UpdatedBy == "" {
				b.UpdatedBy = "(sistem)"
			}
		}
		b.Keterangan = ket
		daftar = append(daftar, b)
	}
	// urut stabil supaya UI tidak melompat-lompat
	sortSlice(daftar)
	OK(w, map[string]interface{}{"flags": daftar})
}

func sortSlice(daftar []Bendera) {
	for i := 1; i < len(daftar); i++ {
		for j := i; j > 0 && daftar[j].Key < daftar[j-1].Key; j-- {
			daftar[j], daftar[j-1] = daftar[j-1], daftar[j]
		}
	}
}

// PUT /api/v1/admin/flags (DEVELOPER): body {"key": "...", "value": bool}.
// Kunci HARUS terdaftar (bendera yatim ditolak).
func PutFlag(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Key   string `json:"key"`
		Value bool   `json:"value"`
	}
	if err := Decode(r, &req); err != nil || req.Key == "" {
		Err(w, http.StatusBadRequest, "Body request tidak valid")
		return
	}
	if _, terdaftar := BENDERA_KETERANGAN[req.Key]; !terdaftar {
		Err(w, http.StatusBadRequest, "Bendera tidak terdaftar: "+req.Key)
		return
	}
	klaim := middleware.User(r)
	_, err := db.Pool.Exec(r.Context(), `
		INSERT INTO flags (key, value, updated_by, updated_at) VALUES ($1, $2, $3, NOW())
		ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()`,
		req.Key, req.Value, klaim.UserID)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal menyimpan flag")
		return
	}
	LogAudit(r, klaim.UserID, "FLAG_UPDATE", "flag", 0,
		fmt.Sprintf("%s=%v", req.Key, req.Value))
	logger.Info("Bendera %s = %v oleh developer #%d", req.Key, req.Value, klaim.UserID)
	OK(w, map[string]interface{}{"key": req.Key, "value": req.Value})
}

// ---- 3) Registri pengaturan ---------------------------------------------

type Pengaturan struct {
	Key        string    `json:"key"`
	Type       string    `json:"type"` // "int" | "string" | "bool"
	Value      string    `json:"value"`
	Default    string    `json:"default"`
	UpdatedBy  string    `json:"updated_by"`
	UpdatedAt  time.Time `json:"updated_at"`
	Keterangan string    `json:"keterangan"`
}

// PENGATURAN_DAFTAR: kunci terdaftar + tipe + fallback (nilai env).
// Hanya kunci di daftar ini yang bisa ditulis — tidak ada "settings
// spray" menimpa rahasia (JWT_SECRET dsb. TIDAK ada di sini; itu
// urusan .env, bukan konsol).
var PENGATURAN_DAFTAR = map[string][2]string{ // kunci -> [tipe, keterangan]
	"backup_interval_seconds":  {"int", "Jarak antar cadangan otomatis (detik)"},
	"backup_keep":              {"int", "Jumlah berkas cadangan yang disimpan"},
	"db_ping_interval_seconds": {"int", "Jarak antar ping kesehatan node DB (detik)"},
	"low_stock_threshold":      {"int", "Ambang peringatan stok menipis"},
	"jwt_expires_h":            {"int", "Masa hidup token login (jam)"},
	"geo_lookup_enabled":       {"bool", "Pelacakan kota dari IP publik"},
}

// nilaiEnvPengaturan: baca nilai fallback langsung dari env config
// (bukan menyimpan rahasia — semua kunci di daftar bukan rahasia).
func nilaiEnvPengaturan(kunci string) string {
	switch kunci {
	case "backup_interval_seconds":
		return strconv.Itoa(config.BackupIntervalSeconds())
	case "backup_keep":
		return strconv.Itoa(config.BackupKeep())
	case "db_ping_interval_seconds":
		return strconv.Itoa(config.DbPingIntervalSeconds())
	case "low_stock_threshold":
		return "5"
	case "jwt_expires_h":
		return strconv.Itoa(config.JWTExpiresHours())
	case "geo_lookup_enabled":
		if config.GeoLookupEnabled() {
			return "true"
		}
		return "false"
	}
	return ""
}

// GET /api/v1/admin/settings (DEVELOPER)
func ListSettings(w http.ResponseWriter, r *http.Request) {
	barisan, err := db.Pool.Query(r.Context(), `
		SELECT s.key, s.value, COALESCE(u.name,''), s.updated_at
		FROM settings s LEFT JOIN users u ON u.id = s.updated_by ORDER BY s.key`)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membaca settings")
		return
	}
	inDB, err := pgx.CollectRows(barisan, pgx.RowToFunc[Pengaturan](func(row pgx.CollectableRow) (Pengaturan, error) {
		var p Pengaturan
		err := row.Scan(&p.Key, &p.Value, &p.UpdatedBy, &p.UpdatedAt)
		return p, err
	}))
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membaca settings")
		return
	}
	peta := map[string]Pengaturan{}
	for _, p := range inDB {
		peta[p.Key] = p
	}
	daftar := make([]Pengaturan, 0, len(PENGATURAN_DAFTAR))
	for kunci, meta := range PENGATURAN_DAFTAR {
		p := Pengaturan{Key: kunci, Type: meta[0], Value: nilaiEnvPengaturan(kunci),
			Default: nilaiEnvPengaturan(kunci), UpdatedBy: "(env)"}
		if ada, ok := peta[kunci]; ok {
			p.Value = ada.Value
			p.UpdatedBy = ada.UpdatedBy
			p.UpdatedAt = ada.UpdatedAt
			if p.UpdatedBy == "" {
				p.UpdatedBy = "(sistem)"
			}
		}
		p.Keterangan = meta[1]
		daftar = append(daftar, p)
	}
	OK(w, map[string]interface{}{"settings": daftar})
}

// PUT /api/v1/admin/settings (DEVELOPER): body {"key": ..., "value": "…"}.
// Validasi tipe keras: int harus angka, bool harus true/false.
func PutSetting(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	}
	if err := Decode(r, &req); err != nil || req.Key == "" {
		Err(w, http.StatusBadRequest, "Body request tidak valid")
		return
	}
	meta, terdaftar := PENGATURAN_DAFTAR[req.Key]
	if !terdaftar {
		Err(w, http.StatusBadRequest, "Pengaturan tidak terdaftar: "+req.Key)
		return
	}
	switch meta[0] {
	case "int":
		if _, err := strconv.Atoi(strings.TrimSpace(req.Value)); err != nil {
			Err(w, http.StatusBadRequest, "Nilai harus bilangan bulat")
			return
		}
	case "bool":
		v := strings.ToLower(strings.TrimSpace(req.Value))
		if v != "true" && v != "false" {
			Err(w, http.StatusBadRequest, "Nilai harus true atau false")
			return
		}
	}
	klaim := middleware.User(r)
	_, err := db.Pool.Exec(r.Context(), `
		INSERT INTO settings (key, value, updated_by, updated_at) VALUES ($1, $2, $3, NOW())
		ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()`,
		req.Key, strings.TrimSpace(req.Value), klaim.UserID)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal menyimpan pengaturan")
		return
	}
	LogAudit(r, klaim.UserID, "SETTING_UPDATE", "setting", 0,
		fmt.Sprintf("%s=%s", req.Key, req.Value))
	logger.Info("Pengaturan %s=%s oleh developer #%d", req.Key, req.Value, klaim.UserID)
	OK(w, map[string]interface{}{"key": req.Key, "value": req.Value})
}

// ---- 4) SQL console (read-only) ------------------------------------------

// JAM_TULIS: kata yang menandai pernyataan menulis/mengubah — kueri
// konsol ditolak sebelum menyentuh DB bila SATU PUN kata ini muncul
// (pencocokan kata utuh, case-insensitive). Kata dalam nama kolom
// ("created_at" mengandung "create"?) TIDAK tertangkap karena
// pencocokan dibatasi utuh-kata.
var JAM_TULIS = []string{
	"insert", "update", "delete", "drop", "alter", "create", "truncate",
	"grant", "revoke", "copy", "vacuum", "reindex", "comment", "lock",
	"call", "do", "listen", "notify", "set", "begin", "commit", "rollback",
	"merge", "replace", "with",
}

// vaksinKueri: normalisasi kueri konsol — buang komentar SQL (--
// dan /* */), rapikan spasi. Dipisah supaya bisa diuji unit tanpa DB.
func vaksinKueri(q string) string {
	garis := strings.Split(q, "\n")
	for i, g := range garis {
		if j := strings.Index(g, "--"); j >= 0 {
			garis[i] = g[:j]
		}
	}
	q = strings.Join(garis, "\n")
	for {
		a := strings.Index(q, "/*")
		if a < 0 {
			break
		}
		b := strings.Index(q[a:], "*/")
		if b < 0 {
			return strings.TrimSpace(q[:a])
		}
		q = q[:a] + " " + q[a+b+2:]
	}
	return strings.TrimSpace(q)
}

// kataKueri: daftar token kata-utuh kueri (untuk pemeriksaan JAM_TULIS).
var reKata = regexp.MustCompile(`[A-Za-z_][A-Za-z0-9_]*`)

func kataKueri(q string) []string {
	dapat := reKata.FindAllString(q, -1)
	for i, k := range dapat {
		dapat[i] = strings.ToLower(k)
	}
	return dapat
}

// ValidasiKueriKonsol: aturan main SQL console — murni (dipakai uji
// unit tanpa DB). Mengembalikan alasan penolakan bila ada.
// Aturan: (1) harus diawali SELECT; (2) tanpa titik-koma di dalam
// (multi-pernyataan = pintu ke eksekusi berantai); (3) tanpa kata
// tulis apa pun sebagai kata utuh; (4) tanpa FROM dihapus; (5)
// LIMIT dipasang bila belum ada.
func ValidasiKueriKonsol(q string) (string, string) {
	q = vaksinKueri(q)
	if q == "" {
		return "", "kueri kosong"
	}
	if strings.Contains(q, ";") {
		return "", "hanya SATU pernyataan tanpa titik-koma"
	}
	if !strings.HasPrefix(strings.ToUpper(q), "SELECT") {
		return "", "hanya SELECT yang diizinkan (konsol ini hanya-baca)"
	}
	// kata pertama SELECT sudah lolos di atas; cek sisanya
	for i, k := range kataKueri(q) {
		if i == 0 {
			continue
		}
		for _, jam := range JAM_TULIS {
			if k == jam {
				return "", "kata terlarang di konsol hanya-baca: " + k
			}
		}
	}
	// paksa LIMIT bila belum: nilai di bawah maks konsol
	if !regexp.MustCompile(`(?i)\blimit\s+\d+\b`).MatchString(q) {
		q = q + " LIMIT 100"
	} else {
		// LIMIT N yang terlalu besar dipotong ke maksimum
		re := regexp.MustCompile(`(?i)(\blimit\s+)(\d+)`)
		q = re.ReplaceAllStringFunc(q, func(m string) string {
			sub := re.FindStringSubmatch(m)
			n, _ := strconv.Atoi(sub[2])
			if n > 500 {
				return sub[1] + "500"
			}
			return m
		})
	}
	return q, ""
}

// POST /api/v1/admin/sql (DEVELOPER): kueri hanya-baca, hasil JSON
// per baris (nilai dikirim sebagai nilai JSON asli per tipe kolom).
// Maksimum 500 baris & 30 kolom; teks kueri ter-audit.
func SqlConsole(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Query string `json:"query"`
	}
	if err := Decode(r, &req); err != nil {
		Err(w, http.StatusBadRequest, "Body request tidak valid")
		return
	}
	q, alasan := ValidasiKueriKonsol(req.Query)
	if alasan != "" {
		Err(w, http.StatusBadRequest, alasan)
		return
	}
	klaim := middleware.User(r)
	LogAudit(r, klaim.UserID, "SQL_CONSOLE", "sql", 0, potong(q, 500))
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	barisan, err := db.Pool.Query(ctx, q)
	if err != nil {
		Err(w, http.StatusBadRequest, "Kueri ditolak Postgres: "+err.Error())
		return
	}
	defer barisan.Close()
	fd := barisan.FieldDescriptions()
	if len(fd) > 30 {
		Err(w, http.StatusBadRequest, "Maksimum 30 kolom per kueri")
		return
	}
	kolom := make([]string, len(fd))
	for i, f := range fd {
		nama := string(f.Name)
		if nama == "" {
			nama = fmt.Sprintf("kolom%d", i+1)
		}
		kolom[i] = nama
	}
	var barisData []map[string]interface{}
	for barisan.Next() {
		nilai, err := barisan.Values()
		if err != nil {
			Err(w, http.StatusInternalServerError, "Gagal membaca baris hasil")
			return
		}
		m := make(map[string]interface{}, len(fd))
		for i, v := range nilai {
			if b, ok := v.([]byte); ok && len(b) > 64*1024 {
				m[kolom[i]] = fmt.Sprintf("(%d byte biner)", len(b))
			} else {
				m[kolom[i]] = v
			}
		}
		barisData = append(barisData, m)
		if len(barisData) >= 500 {
			break // batas keras meski LIMIT di-parse
		}
	}
	if err := barisan.Err(); err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membaca hasil")
		return
	}
	if barisData == nil {
		barisData = []map[string]interface{}{}
	}
	logger.Info("SQL console developer #%d: %d baris", klaim.UserID, len(barisData))
	OK(w, map[string]interface{}{
		"kolom": kolom,
		"baris": barisData,
		"total": len(barisData),
	})
}

func potong(s string, n int) string {
	if len(s) > n {
		return s[:n] + "…"
	}
	return s
}

// ---- 5) System health -----------------------------------------------------

// MulaiServer: waktu boot proses backend (dipasang main.go sekali).
var MulaiServer = time.Now()

// GET /api/v1/admin/health (DEVELOPER): potret proses + DB.
func SystemHealth(w http.ResponseWriter, r *http.Request) {
	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)
	type healthJSON struct {
		AppVersion  string        `json:"app_version"`
		GoVersion   string        `json:"go_version"`
		UptimeDetik int64         `json:"uptime_s"`
		UptimeManus string        `json:"uptime"`
		Goroutine   int           `json:"goroutine"`
		MemHeapMB   float64       `json:"mem_heap_mb"`
		MemSysMB    float64       `json:"mem_sys_mb"`
		NumGC       uint32        `json:"num_gc"`
		NodeAktif   string        `json:"node_aktif"`
		FailoverN   int           `json:"failover_n"`
		Riwayat     []db.Pindahan `json:"riwayat_pindahan"`
		DBSehat     bool          `json:"db_sehat"`
		SesiHidup   int           `json:"sesi_hidup"`
	}
	var dbSehat bool
	err := db.Pool.Ping(r.Context())
	dbSehat = err == nil
	var sesi int
	_ = db.Pool.QueryRow(r.Context(),
		`SELECT COUNT(*) FROM sessions WHERE revoked_at IS NULL AND expires_at > NOW()`).Scan(&sesi)
	h := healthJSON{
		AppVersion:  config.AppVersion,
		GoVersion:   runtime.Version(),
		UptimeDetik: int64(time.Since(MulaiServer).Seconds()),
		UptimeManus: time.Since(MulaiServer).Round(time.Second).String(),
		Goroutine:   runtime.NumGoroutine(),
		MemHeapMB:   float64(mem.HeapAlloc) / 1024 / 1024,
		MemSysMB:    float64(mem.Sys) / 1024 / 1024,
		NumGC:       mem.NumGC,
		NodeAktif:   db.NodeAktif(),
		Riwayat:     db.RiwayatPindahan(),
		DBSehat:     dbSehat,
		SesiHidup:   sesi,
	}
	if h.Riwayat != nil {
		h.FailoverN = len(h.Riwayat)
	}
	OK(w, h)
}

// ---- 6) Metrics ringkas ---------------------------------------------------

// GET /api/v1/admin/metrics (DEVELOPER): potret bisnis + laju.
func SystemMetrics(w http.ResponseWriter, r *http.Request) {
	// per-outlet: user, produk, omzet hari ini, trx hari ini
	barisan, err := db.Pool.Query(r.Context(), `
		SELECT o.id, o.name,
		       (SELECT COUNT(*) FROM users u WHERE u.outlet_id = o.id),
		       (SELECT COUNT(*) FROM products p WHERE p.outlet_id = o.id),
		       COALESCE((SELECT SUM(t.total) FROM transactions t
		                 WHERE t.outlet_id = o.id AND t.status = 'PAID'
		                 AND t.created_at >= date_trunc('day', NOW())), 0),
		       (SELECT COUNT(*) FROM transactions t
		                 WHERE t.outlet_id = o.id
		                 AND t.created_at >= date_trunc('day', NOW()))
		FROM outlets o ORDER BY o.id`)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membaca metrik outlet")
		return
	}
	type outletM struct {
		ID      int64  `json:"outlet_id"`
		Nama    string `json:"name"`
		Users   int    `json:"user_count"`
		Produk  int    `json:"products"`
		Omzet   int64  `json:"omzet_today"`
		TrxHari int    `json:"trx_today"`
	}
	perOutlet, err := pgx.CollectRows(barisan, pgx.RowToFunc[outletM](func(row pgx.CollectableRow) (outletM, error) {
		var m outletM
		err := row.Scan(&m.ID, &m.Nama, &m.Users, &m.Produk, &m.Omzet, &m.TrxHari)
		return m, err
	}))
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membaca metrik outlet")
		return
	}

	// laju transaksi per jam hari ini (seluruh outlet, status apapun)
	jamBaris, err := db.Pool.Query(r.Context(), `
		SELECT EXTRACT(HOUR FROM created_at)::int AS jam, COUNT(*)
		FROM transactions
		WHERE created_at >= date_trunc('day', NOW())
		GROUP BY 1 ORDER BY 1`)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membaca laju transaksi")
		return
	}
	type jamM struct {
		Jam int `json:"jam"`
		Trx int `json:"trx"`
	}
	perJam, err := pgx.CollectRows(jamBaris, pgx.RowToFunc[jamM](func(row pgx.CollectableRow) (jamM, error) {
		var m jamM
		err := row.Scan(&m.Jam, &m.Trx)
		return m, err
	}))
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membaca laju transaksi")
		return
	}

	var totProduk, totUser int
	_ = db.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM products`).Scan(&totProduk)
	_ = db.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM users`).Scan(&totUser)

	OK(w, map[string]interface{}{
		"per_outlet":   perOutlet,
		"per_jam":      perJam,
		"total_produk": totProduk,
		"total_user":   totUser,
	})
}
