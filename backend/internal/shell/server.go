// FITUR 6 UMKM2Shell: KENDALI & PREDIKSI SERVER (server.go) — v2.4.0.
//
// Permintaan pemilik run-13: "developer bisa MEMATIKAN server,
// MENGENDALIKAN server, membaca INDIKASI server down atau tidak,
// PREDIKSI down server atau tidak" — plus unit testing wajib.
//
//   - MatikanServer: graceful shutdown HTTP + DB + log lewat satu
//     channel; menjalankan alur sama dengan Ctrl+C (srv.Shutdown
//     5 detik -> db.Close -> logger.Close). Dua kali klik = dua
//     kali permintaan di-rebase (idempoten); penyerahan ter-audit
//     di handler sebelum channel ditembak.
//   - KesehatanServer: potret NYATA — DB ping + rasio error HTTP
//     dari log CSV hari terakhir + memori tersedia + load + goroutine
//   - usia proses + verdict WARNA/MERAH.
//   - PrediksiDown: ring sampler (mem + rasio error + latensi p95
//     HTTP dari log) tiap 5 detik + REGRESI LINEAR murni (least
//     squares) memprediksi tren; verdict: sehat / waspada (dalam
//     menit) / kritis (dalam menit) + alasan.
package shell

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Matikan: channel yang ditunggu main() sebagai sinyal mati.
// main() memasang handler http yang menutup server lewat ini —
// alur shutdown persis seperti Ctrl+C (graceful, bukan kill -9).
var Matikan = make(chan struct{}, 1)

// MatikanServer: minta server berhenti dengan rapi.
// Mengembalikan false bila sudah ada permintaan mati sebelumnya
// (mencegah dobel shutdown dari klik ganda di panel).
func MatikanServer() bool {
	select {
	case Matikan <- struct{}{}:
		return true
	default:
		return false // sudah ada antrian mati — jangan dobel
	}
}

// StatusMatikan: apakah permintaan mati sudah masuk (UI menampilkan
// "sedang mati…" tanpa harus polling kesehatan gagal).
func StatusMatikan() bool {
	return len(Matikan) > 0
}

// ---- KESEHATAN ----------------------------------------------------------

// StatHTTP: satu baris HTTP dari log CSV (kolom logger.go).
type StatHTTP struct {
	Waktu    time.Time
	Status   int
	DurasiMS float64
}

// KesehatanServer: potret menyeluruh server SEKARANG.
// dbPing: fungsi ping 1-detik (dipasang main dari db.Pool).
var dbPing func(ctx context.Context) error

// PasangDBPing: dipanggil main.go saat hidup (injeksi dependensi
// supaya package shell tidak mengimpor db — testable murni).
func PasangDBPing(f func(ctx context.Context) error) { dbPing = f }

// Kesehatan: verdict dari indikator mentah.
type Kesehatan struct {
	DBHidup        bool     `json:"db_hidup"`
	RasioErrorHTTP float64  `json:"rasio_error_http"` // 500/total
	TotalHTTP      int      `json:"total_http"`       // hari terakhir
	HTTP500        int      `json:"http_500"`
	MemTersediaKB  int64    `json:"mem_tersedia_kb"`
	MemTotalKB     int64    `json:"mem_total_kb"`
	Load1          float64  `json:"load1"`
	Goroutine      int      `json:"goroutine"`
	UptimeDetik    float64  `json:"uptime_s"`
	P95ms          float64  `json:"p95_ms"`  // latensi HTTP persentil-95
	Verdict        string   `json:"verdict"` // HIJAU/KUNING/MERAH
	Alasan         []string `json:"alasan"`
}

// AmbilKesehatan: kumpulkan indikator nyata + verdict.
// goroutine dibaca lewat fungsi injectable (test ringan).
var goroutineNow = func() int { return 0 } // dipasang main: runtime.NumGoroutine

// PasangGoroutine: main memasang runtime.NumGoroutine.
func PasangGoroutine(f func() int) { goroutineNow = f }

func AmbilKesehatan() *Kesehatan {
	k := &Kesehatan{}
	if dbPing != nil {
		ctx, batal := context.WithTimeout(context.Background(), time.Second)
		defer batal()
		k.DBHidup = dbPing(ctx) == nil
	}
	// statistik HTTP dari log CSV hari ini (real dari disk)
	barisanHTTP := BacaStatHTTPHariIni()
	k.TotalHTTP = len(barisanHTTP)
	for _, h := range barisanHTTP {
		if h.Status >= 500 {
			k.HTTP500++
		}
	}
	if k.TotalHTTP > 0 {
		k.RasioErrorHTTP = float64(k.HTTP500) / float64(k.TotalHTTP)
	}
	k.P95ms = persentil(ToDurasi(barisanHTTP), 95)

	if st, err := StatistikSistem(); err == nil {
		k.MemTersediaKB = st.MemTersedia
		k.MemTotalKB = st.MemTotalKB
		k.Load1 = st.LoadAvg1
		k.UptimeDetik = st.UptimeDetik
	}
	k.Goroutine = goroutineNow()

	k.Verdict, k.Alasan = verdictKesehatan(k)
	return k
}

// verdictKesehatan: aturan verdict murni (diuji unit tanpa OS).
// HIJAU = sehat; KUNING = memburuk; MERAH = down/tak lama lagi.
func verdictKesehatan(k *Kesehatan) (string, []string) {
	alasan := []string{}
	if !k.DBHidup {
		alasan = append(alasan, "database tidak menjawab ping")
	}
	if k.RasioErrorHTTP > 0.05 && k.TotalHTTP >= 20 {
		alasan = append(alasan, fmt.Sprintf("rasio HTTP 5xx %.1f%% (%d/%d)",
			k.RasioErrorHTTP*100, k.HTTP500, k.TotalHTTP))
	}
	if k.MemTotalKB > 0 {
		sisa := float64(k.MemTersediaKB) / float64(k.MemTotalKB)
		if sisa < 0.10 {
			alasan = append(alasan, fmt.Sprintf("memori tersedia tinggal %.0f%%", sisa*100))
		}
	}
	if k.Load1 > 4.0 {
		alasan = append(alasan, fmt.Sprintf("load 1m %.2f di atas 4", k.Load1))
	}
	if k.P95ms > 2000 {
		alasan = append(alasan, fmt.Sprintf("latensi p95 %.0f ms", k.P95ms))
	}
	if len(alasan) == 0 {
		return "HIJAU", []string{"semua indikator normal"}
	}
	if !k.DBHidup || (k.RasioErrorHTTP > 0.5 && k.TotalHTTP >= 10) || k.P95ms > 5000 {
		return "MERAH", alasan
	}
	return "KUNING", alasan
}

// ---- LOG HTTP → STATISTIK ----------------------------------------------

// BacaStatHTTPHariIni: baris HTTP dari log CSV hari ini (kolom
// level=HTTP punya status & duration). Gagal baca = kosong (bukan
// error — panel tetap hidup saat log belum ada).
func BacaStatHTTPHariIni() []StatHTTP {
	tanggal := time.Now().Format("2006-01-02")
	nama := fmt.Sprintf("backend-%s.csv", tanggal)
	abs := filepath.Join(JailRoot, "logs", nama) // log ada di jail/logs
	f, err := os.Open(abs)
	if err != nil {
		// fallback: folder kerja (development lokal tanpa jail env)
		abs = filepath.Join(".", "logs", nama)
		f, err = os.Open(abs)
		if err != nil {
			return nil
		}
	}
	defer f.Close()
	return parseStatHTTP(f)
}

// parseStatHTTP: murni (diuji unit dengan string dummy). Baris HTTP
// logger: timestamp,level=HTTP,ip,user_id,user_name,method,path,
// status,duration_ms,message. Kolom lain diabaikan.
func parseStatHTTP(r io.Reader) []StatHTTP {
	daftar := []StatHTTP{}
	rd := csv.NewReader(r)
	rd.FieldsPerRecord = -1 // kolom variatif — jangan galat keras
	for {
		kolom, err := rd.Read()
		if err == io.EOF {
			break
		}
		if err != nil || len(kolom) < 9 {
			continue
		}
		if kolom[1] != "HTTP" {
			continue // baris INFO/WARN/ERROR bukan metrik HTTP
		}
		status, err := strconv.Atoi(kolom[7])
		if err != nil {
			continue
		}
		dur, err := strconv.ParseFloat(kolom[8], 64)
		if err != nil {
			continue
		}
		waktu, err := time.Parse("2006-01-02 15:04:05", kolom[0])
		if err != nil {
			// format ISO atau lain — pakai nol (durasi/status tetap dipakai)
			waktu = time.Time{}
		}
		daftar = append(daftar, StatHTTP{Waktu: waktu, Status: status, DurasiMS: dur})
	}
	return daftar
}

// ToDurasi: ekstrak []float64 untuk persentil.
func ToDurasi(h []StatHTTP) []float64 {
	d := make([]float64, len(h))
	for i, x := range h {
		d[i] = x.DurasiMS
	}
	return d
}

// persentil: nilai persentil-p dari slice terurut apa pun (murni).
func persentil(nilai []float64, p float64) float64 {
	if len(nilai) == 0 {
		return 0
	}
	salin := append([]float64(nil), nilai...)
	// urut naik (insertion sort — slice kecil, tanpa import sort di sini)
	for i := 1; i < len(salin); i++ {
		for j := i; j > 0 && salin[j] < salin[j-1]; j-- {
			salin[j], salin[j-1] = salin[j-1], salin[j]
		}
	}
	idx := int(math.Round(float64(len(salin)-1) * p / 100.0))
	return salin[idx]
}

// ---- PREDIKSI DOWN ------------------------------------------------------

// Sampel: satu potret metrik untuk ring prediksi.
type Sampel struct {
	Waktu       time.Time
	MemTersedia float64 // 0..1 rasio
	RasioError  float64 // 0..1
	P95ms       float64
}

// Prediksi: hasil regresi + verdict ke depan.
type Prediksi struct {
	TrenMem      float64  `json:"tren_mem"`     // delta rasio/detik
	TrenError    float64  `json:"tren_error"`   // delta rasio/detik
	TrenP95      float64  `json:"tren_p95_ms"`  // delta ms/detik
	MenitKritis  float64  `json:"menit_kritis"` // estimasi menit sampai kritis (0=aman)
	Verdict      string   `json:"verdict"`      // SEHAT/WASPADA/KRITIS/NA
	Alasan       []string `json:"alasan"`
	JumlahSampel int      `json:"jumlah_sampel"`
}

// ring: sampler sirkular (mutex ringan).
type ring struct {
	mu       sync.Mutex
	sampel   []Sampel
	maks     int
	terakhir time.Time
}

var ringPrediksi = &ring{maks: 360} // 30 menit riwayat @5 dtk

// CatatSampelOtomatis: dipanggil sampler latar (main goroutine
// tiap 5 detik) — menambah titik data untuk regresi.
func CatatSampelOtomatis() {
	s := Sampel{Waktu: time.Now()}
	if st, err := StatistikSistem(); err == nil && st.MemTotalKB > 0 {
		s.MemTersedia = float64(st.MemTersedia) / float64(st.MemTotalKB)
	}
	barisan := BacaStatHTTPHariIni()
	if len(barisan) > 0 {
		err500 := 0
		for _, h := range barisan {
			if h.Status >= 500 {
				err500++
			}
		}
		s.RasioError = float64(err500) / float64(len(barisan))
		s.P95ms = persentil(ToDurasi(barisan), 95)
	}
	ringPredikat(s)
}

// ringPredikat: masukkan ke ring (murni untuk tes juga).
func ringPredikat(s Sampel) {
	ringPrediksi.mu.Lock()
	defer ringPrediksi.mu.Unlock()
	ringPrediksi.sampel = append(ringPrediksi.sampel, s)
	if len(ringPrediksi.sampel) > ringPrediksi.maks {
		ringPrediksi.sampel = ringPrediksi.sampel[1:]
	}
}

// ResetPrediksi: kosongkan ring (dipakai tes).
func ResetPrediksi() {
	ringPrediksi.mu.Lock()
	ringPrediksi.sampel = nil
	ringPrediksi.mu.Unlock()
}

// PrediksiDown: regresi linear tiap metrik + estimasi menit sampai
// ambang kritis: mem tersedia 0.05, rasio error 0.5, p95 5000ms.
func PrediksiDown() *Prediksi {
	ringPrediksi.mu.Lock()
	sampel := append([]Sampel(nil), ringPrediksi.sampel...)
	ringPrediksi.mu.Unlock()

	p := &Prediksi{JumlahSampel: len(sampel)}
	if len(sampel) < 10 {
		p.Verdict = "NA"
		p.Alasan = []string{fmt.Sprintf("cukup %d sampel dulu (perlu 10, kini %d) — menunggu sampler 5 detik", 10, len(sampel))}
		return p
	}
	// sumbu x = detik sejak sampel pertama
	t0 := sampel[0].Waktu
	x := make([]float64, len(sampel))
	yMem := make([]float64, len(sampel))
	yErr := make([]float64, len(sampel))
	yP95 := make([]float64, len(sampel))
	for i, s := range sampel {
		x[i] = s.Waktu.Sub(t0).Seconds()
		yMem[i] = s.MemTersedia
		yErr[i] = s.RasioError
		yP95[i] = s.P95ms
	}
	p.TrenMem = kemiringan(x, yMem)
	p.TrenError = kemiringan(x, yErr)
	p.TrenP95 = kemiringan(x, yP95)

	terakhir := sampel[len(sampel)-1]
	menit := []float64{}
	// mem turun menuju 0.05
	if p.TrenMem < -1e-9 {
		sisa := terakhir.MemTersedia - 0.05
		if sisa > 0 {
			menit = append(menit, (sisa/-p.TrenMem)/60)
		} else {
			menit = append(menit, 0) // sudah di bawah ambang
		}
	}
	// error naik menuju 0.5
	if p.TrenError > 1e-9 && terakhir.RasioError < 0.5 {
		menit = append(menit, ((0.5-terakhir.RasioError)/p.TrenError)/60)
	}
	// p95 naik menuju 5000
	if p.TrenP95 > 1e-9 && terakhir.P95ms < 5000 {
		menit = append(menit, ((5000-terakhir.P95ms)/p.TrenP95)/60)
	}
	p.MenitKritis = minimum(menit)

	p.Verdict, p.Alasan = verdictPrediksi(p, terakhir)
	return p
}

// verdictPrediksi: murni (diuji unit).
func verdictPrediksi(p *Prediksi, terakhir Sampel) (string, []string) {
	if p.Verdict == "NA" {
		return "NA", p.Alasan
	}
	alasan := []string{}
	if p.TrenMem < -0.0001 {
		alasan = append(alasan, fmt.Sprintf("memori menurun %.2f%%/menit (kini %.0f%%)",
			p.TrenMem*60*100, terakhir.MemTersedia*100))
	}
	if p.TrenError > 0.0001 {
		alasan = append(alasan, fmt.Sprintf("rasio error naik %.1f%%/menit", p.TrenError*60*100))
	}
	if p.TrenP95 > 1 {
		alasan = append(alasan, fmt.Sprintf("latensi p95 naik %.0f ms/menit", p.TrenP95*60))
	}
	if len(alasan) == 0 {
		return "SEHAT", []string{"tren stabil, tidak ada indikator memburuk"}
	}
	if p.MenitKritis > 0 && p.MenitKritis < 10 {
		return "KRITIS", append(alasan, fmt.Sprintf("estimasi kritis dalam %.0f menit", p.MenitKritis))
	}
	return "WASPADA", alasan
}

// kemiringan: koefisien kemiringan regresi linear least-squares
// murni (diuji unit): slope = sum((x-x̄)(y-ȳ))/sum((x-x̄)²).
func kemiringan(x, y []float64) float64 {
	n := float64(len(x))
	if len(x) != len(y) || len(x) < 2 {
		return 0
	}
	sx, sy := 0.0, 0.0
	for i := range x {
		sx += x[i]
		sy += y[i]
	}
	mx, my := sx/n, sy/n
	atas, bawah := 0.0, 0.0
	for i := range x {
		atas += (x[i] - mx) * (y[i] - my)
		bawah += (x[i] - mx) * (x[i] - mx)
	}
	if bawah == 0 {
		return 0
	}
	return atas / bawah
}

// minimum: nilai terkecil slice (murni).
func minimum(v []float64) float64 {
	if len(v) == 0 {
		return 0
	}
	m := v[0]
	for _, x := range v[1:] {
		if x < m {
			m = x
		}
	}
	return m
}

// ---- AMBILDATA LAGI untuk E2E ------------------------------------------

// AmbilStatHTTPDummy: dipakai handler untuk ringkasan cepat.
func AmbilStatHTTPTotal() (total, e500 int, p95 float64) {
	h := BacaStatHTTPHariIni()
	for _, x := range h {
		if x.Status >= 500 {
			e500++
		}
	}
	return len(h), e500, persentil(ToDurasi(h), 95)
}

// helpers kecil yang dipakai handler
func strconvItoa(i int) string { return strconv.Itoa(i) }

var _ = strings.TrimSpace // jaga import strings saat parseStatHTTP dummy
var _ = fmt.Sprint
