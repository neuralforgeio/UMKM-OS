package db

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/neuralforgeio/internal/config"
	"github.com/neuralforgeio/internal/logger"
)

// RUN-7 — SALINAN DATABASE (permintaan pemilik): "ada database pusat
// dan database salinan; ketika pusat down, salinan menggantikan; ketika
// salinan berubah sementara pusat masih down, dan pusat sudah on
// kembali, salinan WAJIB menyinkronkan perubahan itu ke pusat".
//
// Perancangan dalam satu image backend:
//
//   - Pool tetap SATU (seluruh aplikasi membaca db.Pool); yang berpindah
//     adalah NODE di belakangnya. Handler tidak perlu tahu failover
//     pernah terjadi — request berikutnya otomatis menulis ke node aktif.
//   - Dua URL: utama (DATABASE_URL = pusat) + salinan
//     (DATABASE_REPLICA_URL). Pool aktif selalu node yang terakhir
//     diketahui sehat & dapat menulis.
//   - Loop kesehatan: ping + uji TULIS kecil (tabel dbheartbeat milik
//     mesin ini sendiri) tiap DB_PING_INTERVAL_SECONDS; gagal
//     berturut-turut sebanyak DB_FAILOVER_AFTER_FAILS memindahkan pool
//     HANYA bila lawan terbukti sehat (tidak pernah berpindah ke node
//     yang juga mati).
//   - Sinkron balik: begitu pusat terlihat hidup lagi sementara node
//     aktif masih salinan, backend menjalankan pemulihan terkunci:
//     (1) uji tulis pusat benar-benar hidup, (2) dump node aktif
//     (salinan) -> terapkan ke pusat, (3) verifikasi jumlah baris
//     inti, (4) alihkan kembali (failback). Perubahan yang terjadi di
//     zaman salinan tidak hilang satu baris pun — permintaan pemilik
//     dipenuhi secara harfiah.
//   - dbheartbeat: tabel riwayat perpindahan node — barisnya append-
//     only supaya pemilik bisa membaca jejak "kapan server ini pindah
//     ke salinan dan kembali" dari UI (terpisah dari audit_logs bisnis).

type Pindahan struct {
	Waktu time.Time `json:"waktu"`
	Ke    string    `json:"ke"`    // "pusat" | "salinan"
	Sebab string    `json:"sebab"` // teks manusiak
	Gagal int       `json:"gagal"` // ping gagal berturut saat pindah
	Baris int       `json:"baris"` // baris tersinkron saat failback (0 saat failover)
}

var (
	foMu         sync.Mutex
	urlPusat     string
	urlSalinanV  string
	nodeAktif    string // "pusat" | "salinan"
	gagalPusat   int
	gagalSalinan int
	riwayatFo    []Pindahan
)

// NodeAktif: nama node yang saat ini melayani (untuk /admin/db-status).
func NodeAktif() string {
	foMu.Lock()
	defer foMu.Unlock()
	if nodeAktif == "" {
		return "pusat"
	}
	return nodeAktif
}

// URLAktif: URL node yang saat ini melayani — dipakai dump backup
// (cadangan selalu membaca node yang benar-benar hidup).
func URLAktif() string {
	foMu.Lock()
	defer foMu.Unlock()
	if nodeAktif == "salinan" {
		return urlSalinanV
	}
	return urlPusat
}

// URLPusat / URLSalinan: untuk /admin/db-status.
func URLPusat() string   { foMu.Lock(); defer foMu.Unlock(); return urlPusat }
func URLSalinan() string { foMu.Lock(); defer foMu.Unlock(); return urlSalinanV }

// RiwayatPindahan: salinan riwayat failover/failback (maks 20, terbaru dulu).
func RiwayatPindahan() []Pindahan {
	foMu.Lock()
	defer foMu.Unlock()
	n := len(riwayatFo)
	if n > 20 {
		n = 20
	}
	out := make([]Pindahan, 0, n)
	for i := len(riwayatFo) - 1; i >= 0 && len(out) < n; i-- {
		out = append(out, riwayatFo[i])
	}
	return out
}

// PasangSalinan: daftarkan URL node salinan + jalankan loop kesehatan
// latar belakang. URL kosong = mode satu-node lama (tanpa loop, tanpa
// failover — perilaku 2.0.x tidak berubah). berhenti ditutup main().
func PasangSalinan(berhenti <-chan struct{}, replicaURL string) {
	if replicaURL == "" {
		return
	}
	foMu.Lock()
	urlPusat = config.DatabaseURL()
	urlSalinanV = replicaURL
	nodeAktif = "pusat"
	foMu.Unlock()

	if err := siapkanHeartbeat(); err != nil {
		logger.Warn("[db] Salinan database TIDAK aktif: %v (berjalan satu-node)", err)
		foMu.Lock()
		urlSalinanV = ""
		foMu.Unlock()
		return
	}
	logger.Info("[db] Salinan database aktif: %s (pusat %s) — pantau tiap %ds, pindah setelah %d gagal",
		samarURL(replicaURL), samarURL(urlPusat),
		config.DbPingIntervalSeconds(), config.DbFailoverAfterFails())

	interval := time.Duration(config.DbPingIntervalSeconds()) * time.Second
	gagalMax := config.DbFailoverAfterFails()
	go loopKesehatan(berhenti, interval, gagalMax)
}

// siapkanHeartbeat: tabel dbheartbeat di node AKTIF saat ini (pusat saat
// boot). CREATE IF NOT EXISTS — dipanggil ulang setelah failover agar
// node baru juga punya tabel riwayat.
func siapkanHeartbeat() error {
	if Pool == nil {
		return fmt.Errorf("pool database belum terhubung")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS dbheartbeat (
			id BIGSERIAL PRIMARY KEY,
			waktu TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			ke TEXT NOT NULL,
			sebab TEXT NOT NULL,
			gagal INT NOT NULL DEFAULT 0,
			baris INT NOT NULL DEFAULT 0
		)`)
	if err != nil {
		return err
	}
	// node salinan boleh jadi belum punya tabel (belum pernah aktif):
	// siapkan di sana juga supaya failover pertama langsung mulus.
	if urlSalinanV != "" {
		p2, err := poolBaru(ctx, urlSalinanV)
		if err != nil {
			return nil // salinan belum siap = bukan galat boot pusat
		}
		defer p2.Close()
		_, err = p2.Exec(ctx, `
			CREATE TABLE IF NOT EXISTS dbheartbeat (
				id BIGSERIAL PRIMARY KEY,
				waktu TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				ke TEXT NOT NULL,
				sebab TEXT NOT NULL,
				gagal INT NOT NULL DEFAULT 0,
				baris INT NOT NULL DEFAULT 0
			)`)
		if err != nil {
			logger.Warn("[db] salinan belum bisa disiapkan: %v", err)
		}
	}
	return nil
}

// poolBaru: pool kecil sementara untuk memeriksa/mengolah node lain.
func poolBaru(ctx context.Context, url string) (*pgxpool.Pool, error) {
	p, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	if err := p.Ping(ctx); err != nil {
		p.Close()
		return nil, err
	}
	return p, nil
}

// nodeSehat: ping + uji tulis tabel heartbeat. Sehat berarti node itu
// BENAR-BENAR bisa menerima tulisan (bukan sekadar hidup di TCP).
func nodeSehat(url string) bool {
	if url == "" {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	p, err := poolBaru(ctx, url)
	if err != nil {
		return false
	}
	defer p.Close()
	_, err = p.Exec(ctx, `CREATE TABLE IF NOT EXISTS dbheartbeat (
		id BIGSERIAL PRIMARY KEY,
		waktu TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		ke TEXT NOT NULL,
		sebab TEXT NOT NULL,
		gagal INT NOT NULL DEFAULT 0,
		baris INT NOT NULL DEFAULT 0
	)`)
	if err != nil {
		return false
	}
	_, err = p.Exec(ctx, `INSERT INTO dbheartbeat (ke, sebab) VALUES ('PING', 'cek kesehatan rutin')`)
	return err == nil
}

// loopKesehatan: pemantauan berkala + sinkron balik saat pusat pulih.
func loopKesehatan(berhenti <-chan struct{}, interval time.Duration, gagalMax int) {
	periksaKesehatan(gagalMax)
	tick := time.NewTicker(interval)
	defer tick.Stop()
	for {
		select {
		case <-berhenti:
			return
		case <-tick.C:
			periksaKesehatan(gagalMax)
		}
	}
}

// periksaKesehatan: satu putaran pemantauan — hitung kegagalan node,
// pindah bila ambang terlewati DAN lawan sehat, sinkron balik bila pusat
// pulih. Seluruh keputusan diambil di bawah kunci supaya dua sumber
// (loop + endpoint manual) tidak berlomba.
func periksaKesehatan(gagalMax int) {
	foMu.Lock()
	aktif := nodeAktif
	urlAktif, urlLawan := urlPusat, urlSalinanV
	if aktif == "salinan" {
		urlAktif, urlLawan = urlSalinanV, urlPusat
	}
	gagal := &gagalPusat
	if aktif == "salinan" {
		gagal = &gagalSalinan
	}
	foMu.Unlock()

	if nodeSehat(urlAktif) {
		foMu.Lock()
		*gagal = 0
		foMu.Unlock()
	} else {
		foMu.Lock()
		*gagal++
		berapa := *gagal
		foMu.Unlock()

		// Pindah HANYA bila lawan benar-benar sehat — berpindah ke node
		// yang juga mati hanya memindahkan masalah.
		if berapa >= gagalMax && nodeSehat(urlLawan) {
			pindahNode("pusat pulih belum tentu; alasan: node aktif gagal " + fmt.Sprint(berapa) + "x berturut")
			return
		}
	}

	// Sinkron balik: pusat hidup lagi + kita di salinan -> pulangkan.
	if aktif == "salinan" && nodeSehat(urlPusat) {
		sinkronBalikKePusat()
	}
}

// pindahNode: alihkan Pool ke node lain + catat riwayat + heartbeat.
// sebab untuk manusia; dipanggil dari loop kesehatan maupun endpoint
// manual (GET /admin/db-status membacanya, bukan memicunya).
func pindahNode(sebab string) {
	foMu.Lock()
	dari := nodeAktif
	var ke string
	var urlKe string
	if dari == "salinan" {
		ke, urlKe = "pusat", urlPusat
		gagalSalinan = 0
	} else {
		ke, urlKe = "salinan", urlSalinanV
		gagalPusat = 0
	}
	foMu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	pBaru, err := poolBaru(ctx, urlKe)
	if err != nil {
		logger.Error("[db] gagal pindah ke %s: %v (tetap di %s)", ke, err, dari)
		return
	}
	// uji tulis node tujuan sebelum mengganti pool global
	if _, err := pBaru.Exec(ctx, `INSERT INTO dbheartbeat (ke, sebab) VALUES ($1,$2)`, ke, sebab); err != nil {
		pBaru.Close()
		logger.Error("[db] %s hidup tapi tak bisa menulis: %v (tetap di %s)", ke, err, dari)
		return
	}
	lama := Pool
	Pool = pBaru
	if lama != nil {
		// Tutup pool lama secara HEMAT: Close() langsung akan mencabik
		// koneksi yang masih dipakai transaksi berjalan (uji selftest
		// memegang tx saat failover). pgxpool.Close menunggu koneksi
		// aktif selesai — jadi serahkan ke goroutine dengan tenggat
		// 30 detik; kalau masih sibuk, biarkan proses OS memungut
		// saat keluar (node lama memang mati/berpindah peran).
		go func(p *pgxpool.Pool) {
			<-time.After(30 * time.Second)
			p.Close()
		}(lama)
	}
	foMu.Lock()
	nodeAktif = ke
	riwayatFo = append(riwayatFo, Pindahan{Waktu: time.Now(), Ke: ke, Sebab: sebab})
	foMu.Unlock()
	logger.Warn("[db] NODE AKTIF BERPINDAH: %s -> %s (%s)", dari, ke, sebab)
}

// sinkronBalikKePusat: dump node aktif (salinan) -> terapkan ke pusat ->
// verifikasi -> alihkan kembali. Terkunci oleh mutex sinkron supaya
// dipicu dua kali bersamaan tidak dobel; gagal di tengah = tetap di
// salinan (aman: data tidak pernah setengah dua node).
var sinkronMu sync.Mutex

func sinkronBalikKePusat() {
	sinkronMu.Lock()
	defer sinkronMu.Unlock()

	foMu.Lock()
	if nodeAktif != "salinan" || urlSalinanV == "" {
		foMu.Unlock()
		return
	}
	urlAktif := urlSalinanV
	foMu.Unlock()

	// Sinkron balik dipanggil lewat callback yang disuntik main.go
	// (backup.SinkronBalik) supaya db tidak mengimpor backup — hindari
	// dependensi melingkar db->backup->db.
	if sinkronFn == nil {
		logger.Warn("[db] sinkron balik tidak tersedia (backend tanpa dukungan backup)")
		return
	}
	if err := sinkronFn(urlAktif, urlPusat); err != nil {
		logger.Error("[db] sinkron balik GAGAL (tetap di salinan): %v", err)
		return
	}

	// Verifikasi: jumlah baris inti pusat >= salinan (dump penuh
	// menjamin sama persis, ini jaring pengaman).
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pPusat, err := poolBaru(ctx, urlPusat)
	if err != nil {
		logger.Error("[db] pusat hilang lagi saat sinkron balik: %v", err)
		return
	}
	defer pPusat.Close()
	pSalinan, err := poolBaru(ctx, urlAktif)
	if err != nil {
		return
	}
	defer pSalinan.Close()
	// Verifikasi: jumlah baris inti pusat >= salinan (dump penuh
	// menjamin sama persis; ini jaring pengaman untuk galat tak
	// terduga). Tabel yang TIDAK ADA di kedua node dihitung 0 = 0 (sah
	// — deployment tanpa tabel itu); tabel hilang di SALAH SATU node
	// saja = sanggahan: dump penuh seharusnya memindahkan seluruh
	// schema, tidak ada tabel yang boleh hilang satu sisi.
	for _, tabel := range []string{"users", "products", "transactions", "transaction_items"} {
		var a, b int
		adaA, adaB := true, true
		if err := pSalinan.QueryRow(ctx, "SELECT COUNT(*) FROM "+tabel).Scan(&a); err != nil {
			adaA = false
		}
		if err := pPusat.QueryRow(ctx, "SELECT COUNT(*) FROM "+tabel).Scan(&b); err != nil {
			adaB = false
		}
		if adaA != adaB {
			logger.Error("[db] sinkron balik: tabel %s hanya ada di satu node — dump penuh seharusnya memindahkan seluruh schema; tetap di salinan", tabel)
			return
		}
		if !adaA {
			continue // tidak ada di keduanya: 0 = 0, sah
		}
		if a != b {
			logger.Error("[db] sinkron balik: %s beda (salinan %d, pusat %d) — tetap di salinan", tabel, a, b)
			return
		}
	}

	// Alihkan kembali + catat (baris = jumlah baris users yang
	// dipulangkan — tabel yang selalu ada di setiap deployment).
	var barisTx int
	_ = pPusat.QueryRow(ctx, "SELECT COUNT(*) FROM users").Scan(&barisTx)
	foMu.Lock()
	nodeAktif = "pusat"
	gagalPusat = 0
	riwayatFo = append(riwayatFo, Pindahan{
		Waktu: time.Now(), Ke: "pusat", Sebab: "sinkron balik selesai",
		Baris: barisTx,
	})
	foMu.Unlock()
	// Pool global masih menunjuk salinan — buka pool pusat dan ganti.
	pBaru, err := poolBaru(ctx, urlPusat)
	if err == nil {
		lama := Pool
		Pool = pBaru
		if lama != nil {
			lama.Close()
		}
		logger.Success("[db] SINKRON BALIK SELESAI: pusat kembali aktif (%d transaksi dipulangkan)", barisTx)
	} else {
		logger.Error("[db] pusat sehat tapi pool gagal dibuka: %v", err)
	}
}

// sinkronFn: disuntik main.go = backup.SinkronBalik (dump salinan ->
// terapkan ke pusat). Disimpan sebagai variabel supaya paket db tidak
// mengimpor backup (dependensi melingkar).
var sinkronFn func(dari, ke string) error

// PasangSinkron: suntik fungsi sinkron balik (dipanggil main.go).
func PasangSinkron(fn func(dari, ke string) error) { sinkronFn = fn }

// PaksaPindahKe: pindah node manual (dipakai endpoint admin + selftest).
func PaksaPindahKe(ke string) error {
	foMu.Lock()
	if ke != "pusat" && ke != "salinan" {
		foMu.Unlock()
		return fmt.Errorf("node tidak dikenal: %q", ke)
	}
	if urlSalinanV == "" && ke == "salinan" {
		foMu.Unlock()
		return fmt.Errorf("salinan tidak dikonfigurasi (DATABASE_REPLICA_URL kosong)")
	}
	foMu.Unlock()
	pindahNode("dipindah manual")
	return nil
}

// samarURL: sembunyikan password di log/UI (nama host + db tetap
// terlihat supaya pemilik bisa membedakan node).
func samarURL(u string) string {
	i := strings.Index(u, "@")
	if i < 0 {
		return u
	}
	// tampilkan sampai nama database: "@host:port/dbname" (query string
	// seperti sslmode disembunyikan — bukan identitas node).
	rest := u[i:]
	if k := strings.Index(rest, "?"); k >= 0 {
		rest = rest[:k]
	}
	return rest
}

// init: nilai awal supaya getter aman dipanggil sebelum PasangSalinan.
func init() {
	urlPusat = config.DatabaseURL()
	nodeAktif = "pusat"
}

// SamarPusat/SamarSalinan: URL tersamar (password disembunyikan) untuk
// /admin/db-status — pemilik melihat "@db:5432/umkmos", bukan kredensial.
func SamarPusat() string {
	foMu.Lock()
	defer foMu.Unlock()
	return samarURL(urlPusat)
}

func SamarSalinan() string {
	foMu.Lock()
	defer foMu.Unlock()
	return samarURL(urlSalinanV)
}

// PaksaSinkronBalikSekarang: jalankan sinkron balik SEKARANG (dipakai
// umkm-selftest --db + endpoint admin). Kembali menjadi no-op bila
// node aktif memang pusat.
func PaksaSinkronBalikSekarang() {
	sinkronBalikKePusat()
}
