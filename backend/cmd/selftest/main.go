package main

// umkm-selftest — binary uji era Go murni, dibangun di stage builder
// Dockerfile dan dibawa ke image runtime. Tiga mode:
//
//      umkm-selftest --db        : GERBANG E — uji database SUNGGUHAN di dalam
//                                  container (migrasi, SKU per outlet, riwayat
//                                  chat, audit ber-IP, ramalan). Gagal = exit 1,
//                                  skrip delivery berhenti sebelum commit/push.
//      umkm-selftest --groq      : GERBANG F — bukti kunci + AI Bebas dari
//                                  mesin pengguna memakai kode yang baru
//                                  terpasang. Mencetak penanda HASIL/PROBE/
//                                  NORMA/UJI/BEBAS1/BEBAS2 persis konvensi
//                                  seed v1.2.0 supaya skrip delivery tinggal
//                                  mem-parse. Run-5: UJI/BEBAS kini mencetak
//                                  STATUS HTTP NYATA (401/403/429) hasil
//                                  LlmError.Status — bukan lagi ERR kabur —
//                                  sehingga gerbang delivery bisa membedakan
//                                  kunci mati dari hak model dari batas laju.
//      umkm-selftest --reset-llm : run-5 — hapus llm_config.json di volume
//                                  aidata. File itu MENIMPA env tanpa restart;
//                                  sisa kunci/model lama yang pernah disimpan
//                                  lewat UI bisa mengunci konfigurasi mati
//                                  meski .env sudah diganti. Setelah dihapus,
//                                  env (kunci di .env root) menjadi sumber
//                                  tunggal lagi.
//
//      RUN-7: (a) --groq kini mencetak FALLBACK= (utama + rantai cadangan),
//      PROBE= (status GET /models) dan PROBERAW= (ISI BALASAN MENTAH
//      penyedia) — dua wajah 403 dibedakan dari konsol: balasan
//      {"Forbidden"} polos = jaringan/IP diblokir di tepi penyedia
//      (permintaan tidak pernah sampai lapis kunci), kode invalid_api_key
//      = kunci mati. Gerbang F run-7 membandingkan ini dengan Uji-GroqHost
//      dari HOST sehingga matriks host-vs-container terbaca; (b) --db
//      kini juga menguji MESIN SALINAN (backend 2.1.0): dump backup gzip
//      diterapkan ke salinan, data terbaca, lalu PASCA-PEMKAIAN-PUSAT
//      disimulasikan: baris baru ditulis ke salinan, dump beda-waktu
//      dibuat, diterapkan ke pusat, kedua node diverifikasi sama —
//      inilah bukti sinkron balik yang diminta pemilik.
//
//      RUN-6: (a) uji bentrok SKU dibungkus SAVEPOINT + ROLLBACK TO
//      SAVEPOINT — akar kegagalan Gerbang E run-5: error 23505 yang
//      memang diharapkan menandai transaksi ABORTED sehingga uji
//      chat_history dan audit ber-IP berikutnya ditolak Postgres
//      dengan 25P02 current transaction is aborted (direproduksi lalu
//      diverifikasi penuh terhadap PostgreSQL 17 sungguhan: binary
//      lama gagal persis seperti di mesin pemilik, binary baru lolos
//      dan database tetap bersih); (b) uji Groq kini mencetak
//      MODEL=... — model yang BENAR-BENAR menjawab, termasuk hasil
//      promosi rantai cadangan LLM_FALLBACK_MODELS (backend 2.0.3).
//
// Semua pemeriksaan DB berjalan dalam SATU transaksi yang di-ROLLBACK
// — database pengguna tidak pernah kotor karena uji.

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/neuralforgeio/internal/ai"
	"github.com/neuralforgeio/internal/backup"
	"github.com/neuralforgeio/internal/config"
	"github.com/neuralforgeio/internal/db"
)

func main() {
	modeDb := flag.Bool("db", false, "uji database dalam container (Gerbang E)")
	modeGroq := flag.Bool("groq", false, "uji Groq LIVE dari container (Gerbang F)")
	modeReset := flag.Bool("reset-llm", false, "hapus llm_config.json di volume aidata agar env kembali berlaku (run-5)")
	flag.Parse()

	if *modeDb {
		os.Exit(ujiDatabase())
	}
	if *modeGroq {
		ujiGroq()
		return
	}
	if *modeReset {
		os.Exit(resetLlmConfig())
	}
	fmt.Println("pakai: umkm-selftest --db | --groq | --reset-llm")
	os.Exit(2)
}

// resetLlmConfig: lihat komentar header (mode --reset-llm).
func resetLlmConfig() int {
	jalur := filepath.Join(config.AIDataDir(), "llm_config.json")
	if _, err := os.Stat(jalur); err != nil {
		fmt.Println("RESET=TIDAKADA")
		fmt.Println("OK   tidak ada llm_config.json - env memang sumber tunggal")
		return 0
	}
	if err := os.Remove(jalur); err != nil {
		return fatal("gagal menghapus llm_config.json: %v", err)
	}
	fmt.Println("RESET=DIHAPUS")
	fmt.Println("OK   llm_config.json dihapus - env (kunci di .env root) kini sumber tunggal")
	return 0
}

func fatal(format string, a ...interface{}) int {
	fmt.Printf("GAGAL: "+format+"\n", a...)
	return 1
}

func ujiDatabase() int {
	db.Connect()
	defer func() {
		if db.Pool != nil {
			db.Pool.Close()
		}
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// --- 1) Migrasi: tabel + kolom era go murni harus ada ---------------
	for _, uji := range []struct {
		nama string
		sql  string
	}{
		{"tabel chat_history", `SELECT to_regclass('public.chat_history') IS NOT NULL`},
		{"kolom audit_logs.ip", `SELECT EXISTS(SELECT 1 FROM information_schema.columns
                        WHERE table_name='audit_logs' AND column_name='ip')`},
		{"index SKU per outlet", `SELECT EXISTS(SELECT 1 FROM pg_indexes
                        WHERE indexname='idx_products_outlet_sku')`},
		{"kolom products.outlet_id", `SELECT EXISTS(SELECT 1 FROM information_schema.columns
                        WHERE table_name='products' AND column_name='outlet_id')`},
	} {
		var ada bool
		if err := db.Pool.QueryRow(ctx, uji.sql).Scan(&ada); err != nil || !ada {
			return fatal("migrasi belum lengkap: %s (ada=%v err=%v)", uji.nama, ada, err)
		}
		fmt.Printf("OK  migrasi: %s\n", uji.nama)
	}

	// --- 1b) RUN-7: MESIN SALINAN (backup + failover + sinkron balik) ------
	// Dijalankan SEBELUM transaksi uji utama dibuka: failover mengganti
	// Pool global, sedangkan tx terbuka memegang koneksi pool lama —
	// keduanya tidak boleh bersaing. Matriks Gerbang H (runner run-7)
	// mem-parse penanda SALINAN_* yang dicetak fungsi ini.
	if uji := ujiSalinan(ctx); uji != 0 {
		return uji
	}

	// Satu transaksi untuk SEMUA uji tulis — rollback di akhir.
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return fatal("gagal membuka transaksi uji: %v", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// --- 2) SKU PER OUTLET: dua outlet boleh punya SKU sama -------------
	var outlet1, outlet2 int64
	if err := tx.QueryRow(ctx,
		`INSERT INTO outlets (name) VALUES ('uji-sku-1') RETURNING id`).Scan(&outlet1); err != nil {
		return fatal("gagal membuat outlet uji 1: %v", err)
	}
	if err := tx.QueryRow(ctx,
		`INSERT INTO outlets (name) VALUES ('uji-sku-2') RETURNING id`).Scan(&outlet2); err != nil {
		return fatal("gagal membuat outlet uji 2: %v", err)
	}
	var ownerID int64
	if err := tx.QueryRow(ctx,
		`SELECT id FROM users WHERE role='OWNER' ORDER BY id ASC LIMIT 1`).Scan(&ownerID); err != nil {
		ownerID = 0
	}
	buatProduk := func(outlet int64, sku, nama string) (int64, error) {
		var id int64
		err := tx.QueryRow(ctx, `
                        INSERT INTO products (name, sku, category, price, cost, stock, min_stock, unit, outlet_id)
                        VALUES ($1, NULLIF($2,''), 'Umum', 1000, 500, 10, 5, 'pcs', $3)
                        RETURNING id`, nama, sku, outlet).Scan(&id)
		return id, err
	}
	if _, err := buatProduk(outlet1, "UJI-SKU-001", "Produk uji A"); err != nil {
		return fatal("gagal insert produk uji A: %v", err)
	}
	if _, err := buatProduk(outlet2, "UJI-SKU-001", "Produk uji B"); err != nil {
		return fatal("SKU per outlet RUSAK: SKU sama di outlet lain ditolak padahal seharusnya boleh: %v", err)
	}
	fmt.Println("OK  SKU per outlet: SKU sama di dua outlet DITERIMA (keunikan per outlet)")
	// RUN-6 — SAVEPOINT: bentrok SKU berikut MEMANG diharapkan (bukti
	// index per-outlet bekerja), tetapi begitu error itu terjadi
	// Postgres menandai transaksi ABORTED — tanpa pemulihan, uji
	// chat_history dan audit ber-IP di bawah ditolak dengan 25P02
	// current transaction is aborted. Itulah akar kegagalan Gerbang
	// E run-5: error yang seharusnya “bagus” membunuh seluruh uji
	// berikutnya. Dibungkus SAVEPOINT + ROLLBACK TO SAVEPOINT, dan
	// kesalahan eksekusi savepoint sendiri DIPERIKSA (tidak boleh
	// senyap). Transaksi uji tetap satu dan tetap di-ROLLBACK di
	// akhir — database pemilik tidak pernah kotor.
	if _, err := tx.Exec(ctx, "SAVEPOINT sp_sku_bentrok"); err != nil {
		return fatal("gagal membuka SAVEPOINT uji SKU: %v", err)
	}
	_, err = tx.Exec(ctx, `
                INSERT INTO products (name, sku, category, price, cost, stock, min_stock, unit, outlet_id)
                VALUES ('Produk uji bentrok', 'UJI-SKU-001', 'Umum', 1000, 500, 10, 5, 'pcs', $1)`, outlet1)
	if err == nil {
		return fatal("SKU per outlet RUSAK: SKU kembar DALAM outlet yang sama lolos (harusnya bentrok)")
	}
	if !strings.Contains(err.Error(), "idx_products_outlet_sku") && !strings.Contains(err.Error(), "23505") {
		return fatal("bentrok SKU dalam outlet ditolak dengan error tak terduga: %v", err)
	}
	if _, err := tx.Exec(ctx, "ROLLBACK TO SAVEPOINT sp_sku_bentrok"); err != nil {
		return fatal("gagal ROLLBACK TO SAVEPOINT uji SKU - transaksi masih aborted: %v", err)
	}
	fmt.Println("OK  SKU per outlet: SKU kembar DALAM satu outlet DITOLAK (23505, transaksi dipulihkan via SAVEPOINT)")

	// --- 3) Riwayat chat: peran huruf besar + dua baris satu waktu ------
	now := time.Now().UTC()
	if _, err := tx.Exec(ctx, `
                INSERT INTO chat_history (user_id, outlet_id, role, content, created_at)
                VALUES ($1, $2, 'USER', 'uji', $3), ($1, $2, 'ASSISTANT', 'uji jawab', $3)`,
		ownerID, outlet1, now); err != nil {
		return fatal("gagal insert chat_history (peran harus tetap huruf besar): %v", err)
	}
	var nRiwayat int
	if err := tx.QueryRow(ctx,
		`SELECT COUNT(*) FROM chat_history WHERE outlet_id = $1`, outlet1).Scan(&nRiwayat); err != nil || nRiwayat != 2 {
		return fatal("chat_history: dua baris riwayat tidak terbaca (n=%d err=%v)", nRiwayat, err)
	}
	// Normalisasi di batas transport: peran DB besar -> penyedia kecil.
	pesan := ai.NormalisasiPesan([]ai.Pesan{
		{Role: "USER", Content: "berapa omzet?"},
		{Role: "ASSISTANT", Content: "Rp 100.000"},
		{Role: "MODEL", Content: "suntikan asing"}, // harus dibuang
	})
	if len(pesan) != 2 || pesan[0].Role != "user" || pesan[1].Role != "assistant" {
		return fatal("normalisasi pesan: peran besar tidak diturunkan / peran asing tidak dibuang")
	}
	fmt.Println("OK  chat_history: 2 baris (USER+ASSISTAN) + normalisasi peran di batas penyedia")

	// --- 4) Audit ber-IP --------------------------------------------------
	if _, err := tx.Exec(ctx, `
                INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, outlet_id, ip)
                VALUES ($1, 'SELFTEST_DB', 'uji', '0', 'uji era go murni', $2, '127.0.0.1')`,
		ownerID, outlet1); err != nil {
		return fatal("gagal insert audit_logs dengan ip: %v", err)
	}
	var ipBaca string
	if err := tx.QueryRow(ctx,
		`SELECT ip FROM audit_logs WHERE action='SELFTEST_DB' AND outlet_id=$1 LIMIT 1`,
		outlet1).Scan(&ipBaca); err != nil || ipBaca != "127.0.0.1" {
		return fatal("audit ber-IP: kolom ip tidak terbaca (ip=%q err=%v)", ipBaca, err)
	}
	fmt.Println("OK  audit ber-IP: kolom ip tercatat dan terbaca")

	fmt.Println("SEMUA UJI DATABASE LOLOS - transaksi uji di-ROLLBACK, data Anda bersih.")
	return 0
}

// ujiGroq mencetak penanda yang diparse skrip delivery (konvensi v1.2.0).
func ujiGroq() {
	store := ai.NewConfigStore(config.AIDataDir(), ai.EnvSource{
		Enabled:        config.LLMEnabled(),
		BaseURL:        config.LLMBaseURL(),
		APIKey:         config.LLMAPIKey(),
		Model:          config.LLMModel(),
		FallbackModels: config.LLMFallbackModels(),
	})
	cfg := store.Efektif()
	if !cfg.Terkonfigurasi() {
		fmt.Println("HASIL=BELUM")
		fmt.Println("PROBE=GAGAL")
		fmt.Println("PROBERAW=mode AI belum dikonfigurasi")
		return
	}
	fmt.Println("HASIL=SUDAH")
	// RUN-7: rantai cadangan yang AKAN dipakai klien — dibaca dari env
	// (atau default) supaya Gerbang F tampil jelas tanpa menunggu
	// kegagalan: pemilik melihat utama + cadangan dalam satu baris.
	rantai := append([]string{cfg.Model}, config.LLMFallbackModels()...)
	fmt.Printf("FALLBACK=%s\n", strings.Join(rantai, ","))

	// PROBE + PROBERAW (run-7): GET /models membawa STATUS dan ISI
	// BALASAN MENTAH penyedia. Inilah pembanding diagnosis: {"Forbidden"}
	// polos dari container = jaringan/IP docker diblokir di tepi penyedia;
	// kode invalid_api_key = kunci mati; kosong = tidak terjangkau.
	// Gerbang F run-7 menjalankan ini BERDAMPINGAN dengan Uji-GroqHost
	// dari HOST sehingga matriks host-vs-container langsung terbaca.
	klien := store.Klien()
	if hp, ok := klien.(*ai.HttpLlmClient); ok {
		hasil := hp.ProbeDetail()
		fmt.Printf("PROBE=%d\n", hasil.Status)
		fmt.Printf("PROBERAW=%s\n", hasil.Tubuh)
	} else {
		k := ai.NewHttpLlmClient(cfg.BaseURL, cfg.APIKey, cfg.Model)
		hasil := k.ProbeDetail()
		fmt.Printf("PROBE=%d\n", hasil.Status)
		fmt.Printf("PROBERAW=%s\n", hasil.Tubuh)
	}

	// NORMA: kode terpasang mengenali pertanyaan umum + validasi hanya
	// untuk maksud bisnis warung (dijalankan in-process, tanpa jaringan).
	umum := ai.ClassifyIntent("5 tambah 5") == "umum" &&
		ai.ClassifyIntent("berapa satu tambah satu") == "umum" &&
		ai.ClassifyIntent("apa ibu kota Indonesia") == "umum" &&
		ai.ClassifyIntent("berapa omzet hari ini") == "penjualan" &&
		ai.MaxudBerdata["penjualan"] && !ai.MaxudBerdata["umum"]
	if umum {
		fmt.Println("NORMA=OK")
	} else {
		fmt.Println("NORMA=GAGAL")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// UJI: obrolan multi-pesan (regresi v1.1.1: peran besar dari DB harus
	// diterima penyedia setelah normalisasi di batas transport).
	ujiChat(ctx, klien, []ai.Pesan{
		{Role: "USER", Content: "Halo, siapa kamu? Satu kalimat saja."},
		{Role: "ASSISTANT", Content: "Saya OSCAR, asisten bisnis warung Anda."},
		{Role: "USER", Content: "Lanjutan: sebut nama penciptamu, satu kalimat."},
	}, "UJI")

	// BEBAS1: hitungan sederhana dijawab model (bukan ditolak).
	ujiChat(ctx, klien, nil, "BEBAS1")

	// BEBAS2: pengetahuan umum dijawab model.
	ujiChat(ctx, klien, nil, "BEBAS2")
}

func ujiChat(ctx context.Context, klien ai.Client, riwayat []ai.Pesan, nama string) {
	question := "5 tambah 5? Jawab singkat."
	if nama == "BEBAS2" {
		question = "Apa ibu kota Indonesia? Jawab satu kalimat."
	}
	pesan := append([]ai.Pesan{}, riwayat...)
	pesan = append(pesan, ai.Pesan{Role: "user", Content: question})
	jawaban, err := klien.Complete(ctx, pesan, 0.2, 700)
	// run-5: model reasoning kadang membakar seluruh anggaran untuk
	// berpikir lalu mengirim isi kosong; coba SEKALI lagi sebelum
	// menyatakan gagal (kegagalan kosong bersifat sesaat).
	if err != nil && strings.Contains(err.Error(), "jawaban kosong") {
		jawaban, err = klien.Complete(ctx, pesan, 0.2, 700)
	}
	if err != nil {
		teks := err.Error()
		if len(teks) > 300 {
			teks = teks[:300]
		}
		// run-5: status HTTP NYATA dari LlmError.Status — gerbang
		// delivery membedakan 401 (kunci ditolak) / 403 (hak model /
		// kunci nonaktif) / 429 (batas laju) tanpa mengurai teks.
		var le *ai.LlmError
		if errors.As(err, &le) && le.Status > 0 {
			fmt.Printf("%s=%d\n", nama, le.Status)
			fmt.Printf("%sRAW=%s\n", nama, teks)
			return
		}
		if strings.Contains(teks, "tidak terjangkau") {
			fmt.Printf("%s=GAGAL\n", nama)
			fmt.Printf("%sRAW=%s\n", nama, teks)
		} else {
			fmt.Printf("%s=ERR\n", nama)
			fmt.Printf("%sRAW=%s\n", nama, teks)
		}
		return
	}
	fmt.Printf("%s=200\n", nama)
	// run-6: model yang benar-benar menjawab — termasuk hasil promosi
	// rantai cadangan saat model utama ditolak 403/404 penyedia.
	fmt.Printf("%sMODEL=%s\n", nama, klien.Model())
	teks := strings.Join(strings.Fields(jawaban), " ")
	if len(teks) > 140 {
		teks = teks[:140]
	}
	fmt.Printf("%sTEKS=%s\n", nama, teks)
}

// ujiSalinan: seluruh siklus CADANGAN + SALINAN (run-7) dalam satu
// fungsi agar Gerbang H runner cukup mem-parse penanda SALINAN_*:
//
//	SALINAN=LEWATI  — DATABASE_REPLICA_URL tidak diatur (mode satu
//	                  node sah; tidak ada yang diuji)
//	SALINAN=OK ...  — seluruh siklus terbukti
//
// Siklus: (1) backup dari pusat (node aktif) — berkas gzip benar
// ada; (2) terapkan backup ke salinan (db-salinan menerima schema+data
// termasuk owner seed); (3) simulasikan "pusat down": paksa pindah ke
// salinan + tulis transaksi zaman-salinan lewat Pool aktif; (4) pusat
// "pulih": sinkron balik (dump salinan -> terapkan ke pusat); (5)
// verifikasi baris zaman-salinan hidup di PUSAT dan node aktif
// kembali pusat. Seluruh perubahan dipulangkan — permintaan pemilik
// dipenuhi kata per kata.
func ujiSalinan(ctx context.Context) int {
	urlSalinan := config.DatabaseReplicaURL()
	if urlSalinan == "" {
		fmt.Println("SALINAN=LEWATI")
		fmt.Println("OK  salinan: DATABASE_REPLICA_URL kosong - mode satu-node (tanpa failover) sah")
		return 0
	}
	dir := config.BackupDir()

	// selftest berjalan DI LUAR main() — mesin failover harus dipasang
	// dulu (main() memakai db.PasangSalinan + db.PasangSinkron saat
	// produksi; loop latar tidak dibutuhkan di sini, cukup kemampuan
	// pindah + sinkron balik).
	bersambung := make(chan struct{})
	defer close(bersambung)
	db.PasangSinkron(func(dari, ke string) error {
		c, batal := context.WithTimeout(context.Background(), 10*time.Minute)
		defer batal()
		return backup.SinkronBalik(c, dari, ke)
	})
	db.PasangSalinan(bersambung, urlSalinan)

	// (1) cadangkan node aktif (pusat saat uji ini berjalan)
	nama, ukuran, _, err := backup.Jalankan(ctx, dir, db.URLAktif(), 0)
	if err != nil {
		return fatal("SALINAN: backup node aktif gagal: %v", err)
	}
	fmt.Printf("SALINAN_BACKUP=%s (%d byte)\n", nama, ukuran)
	fmt.Println("OK  salinan: backup dibuat dari node aktif (gzip SQL, bisa diterapkan ulang)")

	// (2) salinan menerima seluruh isi pusat
	if err := backup.Terapkan(ctx, dir, nama, urlSalinan); err != nil {
		return fatal("SALINAN: gagal menerapkan backup ke salinan: %v", err)
	}
	fmt.Println("OK  salinan: backup diterapkan ke database salinan (schema + data + seed)")

	// (3) pusat "down": pindah ke salinan + jualan zaman-salinan
	if err := db.PaksaPindahKe("salinan"); err != nil {
		return fatal("SALINAN: gagal pindah ke salinan: %v", err)
	}
	fmt.Println("SALINAN_NODE=salinan")
	fmt.Println("OK  salinan: pusat dianggap down - node aktif sekarang SALINAN")
	if _, err := db.Pool.Exec(ctx,
		`INSERT INTO chat_history (user_id, outlet_id, role, content)
		 SELECT id, NULL, 'USER', 'transaksi zaman salinan (uji)' FROM users WHERE role='OWNER' LIMIT 1`); err != nil {
		return fatal("SALINAN: tulis zaman-salinan gagal: %v", err)
	}
	var nZaman int
	if err := db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM chat_history WHERE content='transaksi zaman salinan (uji)'`).Scan(&nZaman); err != nil || nZaman == 0 {
		return fatal("SALINAN: baris zaman-salinan tidak terbaca (n=%d err=%v)", nZaman, err)
	}
	fmt.Printf("OK  salinan: %d baris zaman-salinan tertulis lewat Pool aktif\n", nZaman)

	// (4) pusat "pulih": sinkron balik memulangkan perubahan
	db.PaksaSinkronBalikSekarang()
	if db.NodeAktif() != "pusat" {
		return fatal("SALINAN: sinkron balik tidak mengembalikan node aktif ke pusat (aktif=%s)", db.NodeAktif())
	}
	var nPusat int
	if err := db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM chat_history WHERE content='transaksi zaman salinan (uji)'`).Scan(&nPusat); err != nil || nPusat != nZaman {
		return fatal("SALINAN: baris zaman-salinan TIDAK dipulangkan ke pusat (pusat=%d salinan=%d)", nPusat, nZaman)
	}
	fmt.Println("SALINAN_NODE=pusat")
	fmt.Printf("OK  salinan: sinkron balik memulangkan %d baris zaman-salinan ke PUSAT\n", nPusat)
	fmt.Println("SALINAN=OK")
	return 0
}
