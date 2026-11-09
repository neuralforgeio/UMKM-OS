package ai

// OSCAR Developer AI (port ml-service v3.4.0) — akses lintas toko
// ber-PIN, kini hidup di backend Go (era Go murni).
//
// Peran & batas:
//   - AI Developer = satu-satunya pihak yang berhak membaca data SEMUA
//     toko sekaligus. Owner di panel chat tetap privat: seluruh
//     retrieval asisten terikat outlet pemilik, dan system prompt
//     melarang OSCAR membahas data toko lain (aturan 8).
//   - Pelaporan PROAKTIF: goroutine latar belakang tiap interval
//     memeriksa pemicu — stok kritis gabungan, omzet turun, toko
//     diam — dan menyimpan laporan TANPA diminta ke dev_reports.json
//     (volume aidata, tidak pernah masuk git).
//
// Keamanan:
//   - PIN di dev_config.json (volume aidata), dibandingkan konstan-waktu
//     (crypto/subtle); pintu endpoint + chat sama-sama ber-PIN.
//   - Laporan lintas toko tidak pernah dikirim ke LLM: jawaban Mode
//     Developer disusun langsung dari mesin.

import (
        "crypto/subtle"
        "encoding/json"
        "fmt"
        "os"
        "path/filepath"
        "sort"
        "strings"
        "sync"
        "time"
)

const maksLaporan = 50

var frasaDev = []string{
        "mode developer",
        "developer mode",
        "laporan developer",
        "developer report",
        "laporan lintas toko",
        "lintas toko",
}

// DevConfig: isi dev_config.json (nilai hilang memakai default).
type DevConfig struct {
        Enabled          bool    `json:"enabled"`
        Pin              string  `json:"pin"`
        IntervalDetik    int     `json:"interval_detik"`
        StokKritisMin    int     `json:"stok_kritis_min"`
        OmzetTurunPersen float64 `json:"omzet_turun_persen"`
        DiamJam          float64 `json:"diam_jam"`
}

func devConfigDefault() DevConfig {
        return DevConfig{
                Enabled:          false,
                Pin:              "",
                IntervalDetik:    900,
                StokKritisMin:    5,
                OmzetTurunPersen: 20.0,
                DiamJam:          48.0,
        }
}

// TokoInfo: satu outlet dalam ringkasan lintas toko.
type TokoInfo struct {
        OutletID   int64  `json:"outlet_id"`
        Nama       string `json:"nama"`
        Transaksi  int64  `json:"transaksi"`
        Omzet      int64  `json:"omzet"`
        OmzetLalu  int64  `json:"omzet_lalu"`
}

// StokKritisLintas: produk kritis + tokonya.
type StokKritisLintas struct {
        Nama    string `json:"nama"`
        Stok    int64  `json:"stok"`
        MinStok int64  `json:"min_stok"`
        Toko    string `json:"toko"`
}

// RingkasanLintas: agregat SEMUA outlet 7 hari + pembanding + stok
// kritis gabungan.
type RingkasanLintas struct {
        Dibuat       string              `json:"dibuat"`
        JumlahOutlet int                 `json:"jumlah_outlet"`
        Toko         []TokoInfo          `json:"toko"`
        TokoDiam     []map[string]interface{} `json:"toko_diam"`
        StokKritis   []StokKritisLintas  `json:"stok_kritis"`
        Catatan      string              `json:"catatan,omitempty"`
}

// LaporanEntri: satu laporan proaktif tersimpan.
type LaporanEntri struct {
        Waktu  string   `json:"waktu"`
        Jenis  string   `json:"jenis"`
        Pemicu []string `json:"pemicu"`
        Teks   string   `json:"teks"`
}

// DevReportStore: pintu berkas + logika Mode Developer. Ringkas
// di-inject (fungsi SQL lintas outlet) supaya unittest bisa memakai
// stub tanpa database.
type DevReportStore struct {
        dir   string
        mu    sync.Mutex
        Ringkas func() (*RingkasanLintas, error)
}

// NewDevReportStore: dir = direktori volume (AI_DATA_DIR).
func NewDevReportStore(dir string) *DevReportStore {
        return &DevReportStore{dir: dir}
}

func (s *DevReportStore) configPath() string  { return filepath.Join(s.dir, "dev_config.json") }
func (s *DevReportStore) reportsPath() string { return filepath.Join(s.dir, "dev_reports.json") }

// Dev adalah instance global yang dipasang saat boot backend
// (main.go) — dipakai ClassifyIntent untuk mengenali pertanyaan
// Mode Developer ber-PIN.
var Dev *DevReportStore

// BacaConfig membaca dev_config.json (nilai hilang memakai default).
func (s *DevReportStore) BacaConfig() DevConfig {
        acuan := devConfigDefault()
        data, err := os.ReadFile(s.configPath())
        if err != nil {
                return acuan
        }
        var cfg DevConfig
        if err := json.Unmarshal(data, &cfg); err != nil {
                return acuan
        }
        if cfg.IntervalDetik == 0 {
                cfg.IntervalDetik = acuan.IntervalDetik
        }
        if cfg.StokKritisMin == 0 {
                cfg.StokKritisMin = acuan.StokKritisMin
        }
        if cfg.OmzetTurunPersen == 0 {
                cfg.OmzetTurunPersen = acuan.OmzetTurunPersen
        }
        if cfg.DiamJam == 0 {
                cfg.DiamJam = acuan.DiamJam
        }
        return cfg
}

func pinSama(a, b string) bool {
        x := strings.TrimSpace(a)
        y := strings.TrimSpace(b)
        return subtle.ConstantTimeCompare([]byte(x), []byte(y)) == 1
}

// PinSah: PIN developer sah & mode aktif (dipakai endpoint).
func (s *DevReportStore) PinSah(pin string) bool {
        cfg := s.BacaConfig()
        if !cfg.Enabled || cfg.Pin == "" {
                return false
        }
        return pinSama(pin, cfg.Pin)
}

// PesanDevSah: true bila pesan memuat frasa developer + PIN yang sah
// (dipakai jalur chat).
func (s *DevReportStore) PesanDevSah(pesan string) bool {
        cfg := s.BacaConfig()
        if !cfg.Enabled || cfg.Pin == "" {
                return false
        }
        teks := strings.ToLower(pesan)
        for _, f := range frasaDev {
                if strings.Contains(teks, f) {
                        return strings.Contains(teks, strings.ToLower(strings.TrimSpace(cfg.Pin)))
                }
        }
        return false
}

// CekDevLaporanQuestion dipanggil ClassifyIntent (paling awal, setelah
// pencipta) — mengenali pertanyaan laporan developer ber-PIN.
func CekDevLaporanQuestion(question string) bool {
        if Dev == nil {
                return false
        }
        return Dev.PesanDevSah(question)
}

// MuatLaporan membaca dev_reports.json ([] bila tidak ada / korup).
func (s *DevReportStore) MuatLaporan() []LaporanEntri {
        s.mu.Lock()
        defer s.mu.Unlock()
        data, err := os.ReadFile(s.reportsPath())
        if err != nil {
                return nil
        }
        var daftar []LaporanEntri
        if err := json.Unmarshal(data, &daftar); err != nil {
                return nil
        }
        return daftar
}

// SimpanLaporan menambah entri (maks 50, buang terlama) — atomik.
func (s *DevReportStore) SimpanLaporan(entri LaporanEntri) error {
        s.mu.Lock()
        defer s.mu.Unlock()
        daftar := []LaporanEntri{}
        if data, err := os.ReadFile(s.reportsPath()); err == nil {
                _ = json.Unmarshal(data, &daftar)
        }
        daftar = append(daftar, entri)
        if len(daftar) > maksLaporan {
                daftar = daftar[len(daftar)-maksLaporan:]
        }
        if err := os.MkdirAll(s.dir, 0o755); err != nil {
                return err
        }
        b, err := json.MarshalIndent(daftar, "", " ")
        if err != nil {
                return err
        }
        tmp := s.reportsPath() + ".tmp"
        if err := os.WriteFile(tmp, b, 0o644); err != nil {
                return err
        }
        return os.Rename(tmp, s.reportsPath())
}

func nowISO() string {
        return time.Now().UTC().Format("2006-01-02T15:04:05Z")
}

func umurJam(iso string) float64 {
        t, err := time.Parse(time.RFC3339, strings.TrimSpace(iso))
        if err != nil {
                return 999.0
        }
        u := time.Since(t).Hours()
        if u < 0 {
                return 0
        }
        return u
}

// TeksLaporan: laporan lintas toko siap baca — Bahasa Indonesia,
// tanpa angka karangan (angka hanya dari ringkasan).
func (s *DevReportStore) TeksLaporan(r *RingkasanLintas, pemicu []string) string {
        baris := []string{"LAPORAN DEVELOPER - ringkasan lintas toko 7 hari terakhir"}
        if len(r.Toko) > 0 {
                for i, t := range r.Toko {
                        if i >= 8 {
                                break
                        }
                        pembanding := ""
                        if t.OmzetLalu > 0 {
                                pembanding = " (minggu lalu Rp " + FormatRupiahID(float64(t.OmzetLalu)) + ")"
                        }
                        baris = append(baris, fmt.Sprintf("- %s: %d transaksi, omzet Rp %s%s",
                                t.Nama, t.Transaksi, FormatRupiahID(float64(t.Omzet)), pembanding))
                }
        } else {
                baris = append(baris, "- belum ada transaksi 7 hari terakhir")
        }
        if len(r.StokKritis) > 0 {
                baris = append(baris, fmt.Sprintf("Stok kritis gabungan (%d produk):", len(r.StokKritis)))
                for i, sk := range r.StokKritis {
                        if i >= 10 {
                                break
                        }
                        baris = append(baris, fmt.Sprintf("- %s sisa %d (toko %s)", sk.Nama, sk.Stok, sk.Toko))
                }
        }
        if len(r.TokoDiam) > 0 {
                nama := make([]string, 0, len(r.TokoDiam))
                for i, d := range r.TokoDiam {
                        if i >= 10 {
                                break
                        }
                        if n, ok := d["nama"].(string); ok {
                                nama = append(nama, n)
                        }
                }
                baris = append(baris, "Toko tanpa transaksi minggu ini: "+strings.Join(nama, ", "))
        }
        if len(pemicu) > 0 {
                baris = append(baris, "PEMICU LAPORAN:")
                for _, p := range pemicu {
                        baris = append(baris, "- "+p)
                }
        }
        return strings.Join(baris, "\n")
}

// CekPemicu: pemicu pelaporan proaktif — teks pendek, angka hanya dari
// ringkasan.
func (s *DevReportStore) CekPemicu(r *RingkasanLintas, cfg DevConfig) []string {
        var pemicu []string
        if len(r.StokKritis) >= 3 {
                pemicu = append(pemicu, fmt.Sprintf(
                        "stok kritis gabungan: %d produk sisa <= minimum (prioritas restok)",
                        len(r.StokKritis)))
        }
        var totalIni, totalLalu int64
        for _, t := range r.Toko {
                totalIni += t.Omzet
                totalLalu += t.OmzetLalu
        }
        if totalLalu > 0 {
                turun := float64(totalLalu-totalIni) / float64(totalLalu) * 100.0
                if turun > cfg.OmzetTurunPersen {
                        pemicu = append(pemicu, fmt.Sprintf(
                                "omzet turun %d%% dibanding minggu lalu", int(turun+0.5)))
                }
        }
        if len(r.TokoDiam) > 0 {
                pemicu = append(pemicu, fmt.Sprintf("%d toko tanpa transaksi minggu ini", len(r.TokoDiam)))
        }
        return pemicu
}

// LaporanProaktif: satu siklus — cek pemicu, simpan laporan bila ada /
// digest jatuh tempo.
func (s *DevReportStore) LaporanProaktif(paksa bool) *LaporanEntri {
        cfg := s.BacaConfig()
        if !cfg.Enabled {
                return nil
        }
        r, err := s.ringkasAman()
        if err != nil {
                r = &RingkasanLintas{
                        Dibuat: nowISO(), JumlahOutlet: 0, Toko: nil, TokoDiam: nil,
                        StokKritis: nil, Catatan: "ringkasan gagal: " + err.Error(),
                }
        }
        pemicu := s.CekPemicu(r, cfg)
        daftar := s.MuatLaporan()
        butuhDigest := true
        if len(daftar) > 0 {
                butuhDigest = umurJam(daftar[len(daftar)-1].Waktu) >= 20.0
        }
        if len(pemicu) == 0 && !butuhDigest && !paksa {
                return nil
        }
        jenis := "digest-harian"
        if len(pemicu) > 0 {
                jenis = "peringatan"
        }
        entri := LaporanEntri{
                Waktu:  nowISO(),
                Jenis:  jenis,
                Pemicu: pemicu,
                Teks:   s.TeksLaporan(r, pemicu),
        }
        if err := s.SimpanLaporan(entri); err != nil {
                return nil
        }
        return &entri
}

func (s *DevReportStore) ringkasAman() (*RingkasanLintas, error) {
        if s.Ringkas == nil {
                return nil, &LlmError{msg: "retrieval lintas toko belum terpasang"}
        }
        return s.Ringkas()
}

// ProactiveLoop: goroutine latar belakang — dinyalakan main.go.
// Saklar darurat: env OSCAR_DEV_PROACTIVE=0 mematikan seluruhnya.
func (s *DevReportStore) ProactiveLoop(stop <-chan struct{}) {
        if os.Getenv("OSCAR_DEV_PROACTIVE") == "0" {
                return
        }
        select {
        case <-stop:
                return
        case <-time.After(120 * time.Second):
        }
        for {
                _ = s.LaporanProaktif(false)
                jeda := float64(s.BacaConfig().IntervalDetik)
                if jeda < 60 {
                        jeda = 60
                }
                select {
                case <-stop:
                        return
                case <-time.After(time.Duration(jeda * float64(time.Second))):
                }
        }
}

// JawabChat: jawaban chat Mode Developer — PIN diverifikasi PALING AWAL.
func (s *DevReportStore) JawabChat(pesan string) string {
        cfg := s.BacaConfig()
        if !cfg.Enabled {
                return "Mode Developer belum diaktifkan di server ini. Data toko " +
                        "lain tetap privat dan tidak bisa dibuka dari obrolan."
        }
        if !s.PesanDevSah(pesan) {
                return "Mode Developer terkunci: sertakan PIN developer pada pesan " +
                        "(contoh: 'mode developer <PIN> laporan lintas toko'). PIN " +
                        "hanya dipegang pengembang dan tersimpan di server, bukan di " +
                        "repo. Jangan pernah bagikan PIN ke siapa pun."
        }
        r, err := s.ringkasAman()
        if err != nil {
                r = &RingkasanLintas{Catatan: err.Error()}
        }
        teks := s.TeksLaporan(r, s.CekPemicu(r, cfg))
        daftar := s.MuatLaporan()
        tambahan := ""
        if len(daftar) > 0 {
                terakhir := daftar[len(daftar)-1]
                cuplikan := terakhir.Teks
                if len(cuplikan) > 500 {
                        cuplikan = cuplikan[:500] + " ..."
                }
                tambahan = "\n\nLaporan proaktif terakhir (" + terakhir.Waktu + " / " +
                        terakhir.Jenis + "):\n" + cuplikan
        }
        return "MODE DEVELOPER AKTIF - akses lintas toko khusus pengembang.\n\n" +
                teks + tambahan
}

// ApiReport: muatan endpoint laporan developer (PIN wajib).
func (s *DevReportStore) ApiReport(pin string) (bool, map[string]interface{}) {
        if !s.PinSah(pin) {
                return false, map[string]interface{}{
                        "ok":    false,
                        "error": "PIN developer salah atau Mode Developer belum diaktifkan.",
                }
        }
        r, err := s.ringkasAman()
        if err != nil {
                r = &RingkasanLintas{
                        Dibuat: nowISO(), Catatan: "ringkasan gagal: " + err.Error(),
                }
        }
        teks := s.TeksLaporan(r, s.CekPemicu(r, s.BacaConfig()))
        daftar := s.MuatLaporan()
        if len(daftar) > 10 {
                daftar = daftar[len(daftar)-10:]
        }
        return true, map[string]interface{}{
                "ok":             true,
                "laporan_terbaru": daftar,
                "ringkasan":      r,
                "teks":           teks,
        }
}

// UrutkanToko mengurutkan toko berdasarkan omzet turun (helper kecil
// untuk retrieval SQL supaya urutan stabil).
func UrutkanToko(toko []TokoInfo) {
        sort.SliceStable(toko, func(i, j int) bool { return toko[i].Omzet > toko[j].Omzet })
}
