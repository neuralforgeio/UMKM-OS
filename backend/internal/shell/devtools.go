// UMKM2SHELL DEVTOOLS (v2.5.0 run-14): 20 perkakas developer baru.
// Semua logika MURNI di berkas ini diuji unit tanpa OS/DB; sisi yang
// perlu DB/HTTP dijembatani lewat fungsi injeksi agar tetap testable.
// Sumber logika nyata: Laravel Horizon/Telescope/Pulse/Pennant,
// healthchecks.io, webhook.site, pg information_schema.
package shell

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

// ==== 1. RATE LIMITER (fixed window per kunci) ==========================

// RateLimiter: batas N aksi per jendela T per kunci (umum: per IP
// atau per user). Saat kuota lewat, Tunggu() mengembalikan detik
// retry-after (praktik 429 + Retry-After).
type RateLimiter struct {
	mu      sync.Mutex
	jendela time.Duration
	maks    int
	hitung  map[string][]time.Time
}

func RateLimiterBaru(maks int, jendela time.Duration) *RateLimiter {
	return &RateLimiter{jendela: jendela, maks: maks, hitung: map[string][]time.Time{}}
}

// Izinkan: true bila aksi ke-N masih dalam kuota; angka kedua =
// detik tunggu sampai jendela kosong (0 = tak perlu tunggu).
func (r *RateLimiter) Izinkan(kunci string, kini time.Time) (bool, int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	batas := kini.Add(-r.jendela)
	var hidup []time.Time
	for _, t := range r.hitung[kunci] {
		if t.After(batas) {
			hidup = append(hidup, t)
		}
	}
	if len(hidup) >= r.maks {
		tertua := hidup[0]
		detik := int(tertua.Add(r.jendela).Sub(kini).Seconds()) + 1
		r.hitung[kunci] = hidup
		return false, detik
	}
	hidup = append(hidup, kini)
	r.hitung[kunci] = hidup
	return true, 0
}

// ==== 2. PENANGKAP WEBHOOK (webhook.site) ===============================

// WebhookTangkapan: satu request masuk yang ditangkap untuk inspeksi.
type WebhookTangkapan struct {
	Waktu  time.Time
	Metode string
	Path   string
	Header map[string]string
	Body   string
}

// PenangkapWebhook: menyimpan request masuk di memori (ring maks 50)
// supaya developer menguji integrasi tanpa layanan luar.
type PenangkapWebhook struct {
	mu      sync.Mutex
	riwayat []WebhookTangkapan
	maks    int
}

func PenangkapWebhookBaru() *PenangkapWebhook {
	return &PenangkapWebhook{maks: 50}
}

func (p *PenangkapWebhook) Tangkap(t WebhookTangkapan) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.riwayat = append(p.riwayat, t)
	if len(p.riwayat) > p.maks {
		p.riwayat = p.riwayat[1:]
	}
}

func (p *PenangkapWebhook) Daftar() []WebhookTangkapan {
	p.mu.Lock()
	defer p.mu.Unlock()
	out := make([]WebhookTangkapan, len(p.riwayat))
	copy(out, p.riwayat)
	return out
}

func (p *PenangkapWebhook) Kosongkan() {
	p.mu.Lock()
	p.riwayat = nil
	p.mu.Unlock()
}

// ==== 3. HEARTBEAT CRON (healthchecks.io) ===============================

// Heartbeat: tiap cron wajib ping; jika lewat periode+grace status
// jadi DOWN dan daftar galatnya bisa dibaca.
type Heartbeat struct {
	Nama     string
	Periode  time.Duration
	Grace    time.Duration
	Terakhir time.Time
}

// StatusHeartbeat: murni. false = terlambat (DOWN).
func StatusHeartbeat(h Heartbeat, kini time.Time) (down bool, telat time.Duration) {
	batas := h.Terakhir.Add(h.Periode + h.Grace)
	if kini.After(batas) {
		return true, kini.Sub(batas)
	}
	return false, 0
}

// ==== 4. PROFILER QUERY (Telescope) =====================================

// QueryStat: satu query SQL dicatat dengan durasi; lambat di-tag.
type QueryStat struct {
	SQL    string
	Ms     float64
	Lambat bool
}

// TandaiLambat: query di atas ambang ms ditandai (Telescope 100ms).
func TandaiLambat(daftar []QueryStat, ambangMs float64) []QueryStat {
	out := make([]QueryStat, len(daftar))
	copy(out, daftar)
	for i := range out {
		out[i].Lambat = out[i].Ms >= ambangMs
	}
	return out
}

// RingkasQuery: agregat murni untuk kartu profiler (total, max,
// rata-rata, jumlah lambat).
type RingkasQuery struct {
	Jumlah  int
	Lambat  int
	TotalMs float64
	MaxMs   float64
	RataMs  float64
}

func RingkasQueryStat(daftar []QueryStat) RingkasQuery {
	r := RingkasQuery{Jumlah: len(daftar)}
	if len(daftar) == 0 {
		return r
	}
	for _, q := range daftar {
		r.TotalMs += q.Ms
		if q.Ms > r.MaxMs {
			r.MaxMs = q.Ms
		}
		if q.Lambat {
			r.Lambat++
		}
	}
	r.RataMs = r.TotalMs / float64(len(daftar))
	return r
}

// ==== 5. EXPORT CSV/JSON (server-side) =================================

// Kolom: definisi satu kolom export (nama + nilai dari baris).
type KolomExport struct {
	Nama  string
	Ambil func(baris map[string]interface{}) string
}

// BuatCSV: serialisasi baris ke CSV dengan escape standar (koma,
// kutip, newline). Murni. Dipakai tombol export tabel (query server
// side, bukan render DOM) supaya puluhan ribu baris tetap terunduh.
func BuatCSV(kolom []string, baris []map[string]interface{}) string {
	var b strings.Builder
	b.WriteString(strings.Join(escapeCSV(kolom), ","))
	b.WriteString("\r\n")
	for _, r := range baris {
		sel := make([]string, len(kolom))
		for i, k := range kolom {
			v := r[k]
			switch t := v.(type) {
			case string:
				sel[i] = t
			case nil:
				sel[i] = ""
			default:
				sel[i] = fmt.Sprintf("%v", t)
			}
		}
		b.WriteString(strings.Join(escapeCSV(sel), ","))
		b.WriteString("\r\n")
	}
	return b.String()
}

// escapeCSV: kutip bila memuat koma/kutip/newline; kutip ganda di-
// gandakan (RFC 4180).
func escapeCSV(sel []string) []string {
	out := make([]string, len(sel))
	for i, s := range sel {
		if strings.ContainsAny(s, ",\"\r\n") {
			out[i] = `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
		} else {
			out[i] = s
		}
	}
	return out
}

// ==== 6. PENGHITUNG TABEL DB (information_schema) =======================

// UkuranTabel: satu baris hasil query ukuran tabel (data vs index).
type UkuranTabel struct {
	Nama    string
	Baris   int64
	DataKB  int64
	IndexKB int64
	TotalKB int64
}

// UrutTotalTerbesar: tabel bengkak tampil dulu (murni).
func UrutTotalTerbesar(daftar []UkuranTabel) []UkuranTabel {
	out := append([]UkuranTabel(nil), daftar...)
	sort.SliceStable(out, func(i, j int) bool { return out[i].TotalKB > out[j].TotalKB })
	return out
}

// ==== 7. ROTASI KUNCI API (overlap) =====================================

// KunciApi: kunci dengan masa; rotasi menerbitkan kunci baru dulu
// dan menonaktifkan yang lama setelah masa overlap supaya integrasi
// tidak pernah putus.
type KunciApi struct {
	Label      string
	Aktif      bool
	Terbit     time.Time
	Kadaluarsa time.Time
}

// RotasiKunci: murni. Kunci baru aktif; kunci lama tetap aktif sampai
// akhir overlap (bukan langsung mati).
func RotasiKunci(lama []KunciApi, kini time.Time, overlap time.Duration) []KunciApi {
	out := make([]KunciApi, 0, len(lama)+1)
	for _, k := range lama {
		k.Aktif = kini.Before(k.Kadaluarsa)
		out = append(out, k)
	}
	out = append(out, KunciApi{
		Label:      fmt.Sprintf("kunci-%d", kini.Unix()),
		Aktif:      true,
		Terbit:     kini,
		Kadaluarsa: kini.Add(overlap),
	})
	return out
}

// ==== 8. MODE MAINTENANCE ================================================

// StatusMaintenance: saklar global + pesan + pengecualian peran.
// Saat aktif, hanya DEVELOPER yang boleh masuk (middleware membaca
// status ini); queue/janin lain tetap hidup.
type StatusMaintenance struct {
	Aktif bool
	Pesan string
	Izin  map[string]bool // peran yang lolos
	Mulai time.Time
}

var maintenance = StatusMaintenance{Izin: map[string]bool{"DEVELOPER": true}}

// SetMaintenance: saklar (mutex ringan).
func SetMaintenance(aktif bool, pesan string) {
	maintenance.Aktif = aktif
	maintenance.Pesan = pesan
	if aktif {
		maintenance.Mulai = time.Now()
	}
}

// BolehLewatMaintenance: peran di izinkan atau tidak (murni pada
// salinan status supaya bisa diuji).
func BolehLewatMaintenance(m StatusMaintenance, peran string) bool {
	return !m.Aktif || m.Izin[peran]
}

// StatusMaintenanceSekarang: baca status hidup.
func StatusMaintenanceSekarang() (aktif bool, pesan string, peranIzin []string) {
	peran := make([]string, 0, len(maintenance.Izin))
	for p := range maintenance.Izin {
		peran = append(peran, p)
	}
	sort.Strings(peran)
	return maintenance.Aktif, maintenance.Pesan, peran
}

// ==== 9. LEVEL LOG DINAMIS ===============================================

// LevelLog: DEBUG/INFO/WARN/ERROR; watcher hanya merekam level di
// atas ambang (Telescope). Ambang bisa diturunkan tanpa deploy.
type LevelLog int

const (
	LevelDebug LevelLog = iota
	LevelInfo
	LevelWarn
	LevelError
)

func (l LevelLog) String() string {
	switch l {
	case LevelDebug:
		return "DEBUG"
	case LevelInfo:
		return "INFO"
	case LevelWarn:
		return "WARN"
	default:
		return "ERROR"
	}
}

// LolosAmbang: true bila level >= ambang (murni).
func LolosAmbang(level, ambang LevelLog) bool {
	return level >= ambang
}

// ParseLevelLog: string ke level (murni; tak dikenal = INFO).
func ParseLevelLog(s string) LevelLog {
	switch strings.ToUpper(strings.TrimSpace(s)) {
	case "DEBUG":
		return LevelDebug
	case "WARN":
		return LevelWarn
	case "ERROR":
		return LevelError
	default:
		return LevelInfo
	}
}

// ==== 10. STATISTIK RUNTIME (expvar ala Go) =============================

// StatRuntime: potret runtime Go + CPU untuk kartu servers (Pulse).
type StatRuntime struct {
	Goroutine      int
	NumCPU         int
	GCPauseMs      float64
	HeapAllocKB    int64
	HeapIdleKB     int64
	HeapInUseKB    int64
	UptimeEpochSec int64
}

// PersenHeapInUse: heap yang benar-benar terpakai (murni).
func (s StatRuntime) PersenHeapInUse() float64 {
	total := s.HeapInUseKB + s.HeapIdleKB
	if total <= 0 {
		return 0
	}
	return float64(s.HeapInUseKB) / float64(total) * 100
}

// ==== 11. SWEEP SESI KEDALUWARSA ========================================

// SweepSesi: dari daftar sid dengan expires, kembalikan yang sudah
// lewat (untuk DELETE berkala). Murni.
func SweepSesi(sesi map[string]time.Time, kini time.Time) []string {
	var kedaluwarsa []string
	for sid, exp := range sesi {
		if kini.After(exp) {
			kedaluwarsa = append(kedaluwarsa, sid)
		}
	}
	sort.Strings(kedaluwarsa)
	return kedaluwarsa
}

// ==== 12. PENCARIAN AUDIT LOG ===========================================

// BarisAudit: satu entri audit (siapa, aksi, kapan).
type BarisAudit struct {
	ID     int64
	UserID int64
	Nama   string
	Aksi   string
	Waktu  time.Time
	Detail string
}

// CariAudit: filter murni by user, aksi (subkasus), rentang tanggal.
func CariAudit(daftar []BarisAudit, userID int64, aksi, dari, sampai string) []BarisAudit {
	fd, errfd := time.Parse("2006-01-02", dari)
	fs, errfs := time.Parse("2006-01-02", sampai)
	if errfd == nil {
		fd = fd.AddDate(0, 0, 0)
	}
	if errfs == nil {
		fs = fs.AddDate(0, 0, 1) // inklusif hari terakhir
	}
	var out []BarisAudit
	for _, b := range daftar {
		if userID != 0 && b.UserID != userID {
			continue
		}
		if aksi != "" && !strings.Contains(strings.ToLower(b.Aksi), strings.ToLower(aksi)) {
			continue
		}
		if errfd == nil && b.Waktu.Before(fd) {
			continue
		}
		if errfs == nil && b.Waktu.After(fs) {
			continue
		}
		out = append(out, b)
	}
	return out
}

// ==== 13-20 diteruskan di bawah (alat 1 tab shell baru) ==================

// ==== 13. PEMBERSIH SEJARAH CMD =========================================

// BersihkanSejarahCmd: sejarah perintah > maks di-buang yang tertua
// (murni; UI punya tombol bersihkan).
func BersihkanSejarahCmd(daftar []HasilPerintah, maks int) []HasilPerintah {
	if len(daftar) <= maks {
		return daftar
	}
	return daftar[len(daftar)-maks:]
}

// ==== 14. PENGHITUNG JEMIN/LATENSI P95 KE JAM ==========================

// HistogramJam: latensi per jam untuk grafik (Pulse slow requests).
type HistogramJam struct {
	Jam     int
	Sampel  int
	TotalMs float64
}

// TambahHistogram: satu durasi masuk jam-nya (murni).
func TambahHistogram(h []HistogramJam, jam int, ms float64) []HistogramJam {
	for i := range h {
		if h[i].Jam == jam {
			h[i].Sampel++
			h[i].TotalMs += ms
			return h
		}
	}
	return append(h, HistogramJam{Jam: jam, Sampel: 1, TotalMs: ms})
}

// ==== 15. VALIDATOR ENV ================================================

// MasalahEnv: satu temuan validasi env.
type MasalahEnv struct {
	Kunci   string
	Masalah string
}

// ValidasiEnv: aturan murni: wajib ada (DATABASE_URL, JWT_SECRET),
// format port harus angka, tidak boleh rahasia default production.
func ValidasiEnv(env map[string]string) []MasalahEnv {
	var temuan []MasalahEnv
	wajib := []string{"DATABASE_URL", "JWT_SECRET"}
	for _, k := range wajib {
		if strings.TrimSpace(env[k]) == "" {
			temuan = append(temuan, MasalahEnv{Kunci: k, Masalah: "wajib terisi"})
		}
	}
	for _, k := range []string{"PORT", "JWT_EXPIRES_H"} {
		if v := strings.TrimSpace(env[k]); v != "" {
			if _, err := fmt.Sscanf(v, "%d", new(int)); err != nil {
				temuan = append(temuan, MasalahEnv{Kunci: k, Masalah: "harus angka: " + v})
			}
		}
	}
	if env["JWT_SECRET"] == "umkm-os-dev-secret" {
		temuan = append(temuan, MasalahEnv{Kunci: "JWT_SECRET", Masalah: "masih nilai default dev, ganti di produksi"})
	}
	sort.Slice(temuan, func(i, j int) bool { return temuan[i].Kunci < temuan[j].Kunci })
	return temuan
}

// ==== 16. PEMBANDING SKEMA (drift) ======================================

// BedaSkema: satu perbedaan skema vs ekspektasi.
type BedaSkema struct {
	Tabel   string
	Kolom   string
	Masalah string
}

// BandingkanSkema: kolom hilang/lebih dibanding ekspektasi (murni).
func BandingkanSkema(aktual map[string][]string, ekspektasi map[string][]string) []BedaSkema {
	var out []BedaSkema
	for tabel, kolEks := range ekspektasi {
		kolAkt := aktual[tabel]
		himpAkt := map[string]bool{}
		for _, k := range kolAkt {
			himpAkt[k] = true
		}
		for _, k := range kolEks {
			if !himpAkt[k] {
				out = append(out, BedaSkema{Tabel: tabel, Kolom: k, Masalah: "kolom hilang"})
			}
		}
	}
	for tabel, kolAkt := range aktual {
		if _, ada := ekspektasi[tabel]; !ada {
			out = append(out, BedaSkema{Tabel: tabel, Masalah: "tabel tidak dikenal"})
			continue
		}
		himpEks := map[string]bool{}
		for _, k := range ekspektasi[tabel] {
			himpEks[k] = true
		}
		for _, k := range kolAkt {
			if !himpEks[k] {
				out = append(out, BedaSkema{Tabel: tabel, Kolom: k, Masalah: "kolom tak dikenal"})
			}
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Tabel != out[j].Tabel {
			return out[i].Tabel < out[j].Tabel
		}
		return out[i].Kolom < out[j].Kolom
	})
	return out
}

// ==== 17. PERINGKAT FITUR (feature flag) ================================

// Bendera: nilai fitur per scope (user/outlet) dengan hasil resolusi
// pertama di-cache agar konsisten (Pennant).
type Bendera struct {
	mu    sync.Mutex
	nilai map[string]map[string]bool // kunciFitur -> scope -> nilai
}

func BenderaBaru() *Bendera {
	return &Bendera{nilai: map[string]map[string]bool{}}
}

func (b *Bendera) Set(fitur, scope string, nyala bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.nilai[fitur] == nil {
		b.nilai[fitur] = map[string]bool{}
	}
	b.nilai[fitur][scope] = nyala
}

// Resolusi: scope lebih spesifik menang; tanpa nilai = defaultNyala.
func (b *Bendera) Resolusi(fitur, scope string, defaultNyala bool) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	if v, ok := b.nilai[fitur][scope]; ok {
		return v
	}
	return defaultNyala
}

func (b *Bendera) Purge(fitur string) {
	b.mu.Lock()
	delete(b.nilai, fitur)
	b.mu.Unlock()
}

// ==== 18. ESTIMATOR BACKUP =============================================

// EstimasiBackup: perkiraan ukuran dump dari ukuran tabel (murni):
// totalKB * 1.35 (overhead format SQL) + waktu menit pada 10 MB/dtk.
type EstimasiBackup struct {
	TotalKB int64
	DumpKB  int64
	Menit   float64
}

func EstimasiBackupDari(tabel []UkuranTabel, kecepatanMBperDetik float64) EstimasiBackup {
	var total int64
	for _, t := range tabel {
		total += t.TotalKB
	}
	dump := int64(float64(total) * 1.35)
	mbps := kecepatanMBperDetik
	if mbps <= 0 {
		mbps = 10
	}
	menit := float64(dump) / 1024.0 / mbps / 60.0
	return EstimasiBackup{TotalKB: total, DumpKB: dump, Menit: menit}
}

// ==== 19. KUNCI KIRIM/IDEMPOTENSI =======================================

// Idempoten: melacak kunci aksi supaya dobel klik tidak dobel eksekusi.
type Idempoten struct {
	mu      sync.Mutex
	dipakai map[string]time.Time
	ttl     time.Duration
}

func IdempotenBaru(ttl time.Duration) *Idempoten {
	return &Idempoten{dipakai: map[string]time.Time{}, ttl: ttl}
}

// Klaim: true pertama kali; false bila kunci sudah dipakai dalam TTL.
func (i *Idempoten) Klaim(kunci string, kini time.Time) bool {
	i.mu.Lock()
	defer i.mu.Unlock()
	if t, ok := i.dipakai[kunci]; ok && kini.Sub(t) < i.ttl {
		return false
	}
	i.dipakai[kunci] = kini
	return true
}

// ==== 20. RINGKASAN HEALTHCHECK =========================================

// HasilHealth: satu dependensi.
type HasilHealth struct {
	Nama  string
	Hidup bool
	Ms    float64
}

// VerdictHealth: SEMUA hidup = OK; ada mati = DOWN; lambat semua =
// DEGRADED (murni).
func VerdictHealth(daftar []HasilHealth, ambangMs float64) string {
	if len(daftar) == 0 {
		return "NA"
	}
	mati := 0
	lambat := 0
	for _, h := range daftar {
		if !h.Hidup {
			mati++
		} else if h.Ms > ambangMs {
			lambat++
		}
	}
	if mati > 0 {
		return "DOWN"
	}
	if lambat == len(daftar) {
		return "DEGRADED"
	}
	return "OK"
}
