package main

// umkm-selftest — binary uji era Go murni, dibangun di stage builder
// Dockerfile dan dibawa ke image runtime. Dua mode:
//
//      umkm-selftest --db    : GERBANG E — uji database SUNGGUHAN di dalam
//                              container (migrasi, SKU per outlet, riwayat
//                              chat, audit ber-IP, ramalan). Gagal = exit 1,
//                              skrip delivery berhenti sebelum commit/push.
//      umkm-selftest --groq  : [4b] Groq LIVE — bukti kunci + AI Bebas dari
//                        mesin pengguna memakai kode yang baru terpasang.
//                        Mencetak penanda HASIL/PROBE/NORMA/UJI/BEBAS1/
//                        BEBAS2 persis konvensi seed v1.2.0 supaya
//                        skrip delivery tinggal mem-parse.
//
// Semua pemeriksaan DB berjalan dalam SATU transaksi yang di-ROLLBACK
// — database pengguna tidak pernah kotor karena uji. Pernyataan yang
// MEMANG diharapkan gagal (uji bentrok SKU) dibungkus SAVEPOINT lalu
// dipulihkan dengan ROLLBACK TO SAVEPOINT — tanpa itu transaksi masuk
// keadaan aborted (SQLSTATE 25P02) dan SEMUA uji berikutnya ditolak
// Postgres (akar kegagalan run-4 di Gerbang E).

import (
        "context"
        "flag"
        "fmt"
        "os"
        "strings"
        "time"

        "github.com/neuralforgeio/internal/ai"
        "github.com/neuralforgeio/internal/config"
        "github.com/neuralforgeio/internal/db"
)

func main() {
        modeDb := flag.Bool("db", false, "uji database dalam container (Gerbang E)")
        modeGroq := flag.Bool("groq", false, "uji Groq LIVE dari container (bukti [4b])")
        flag.Parse()

        if *modeDb {
                os.Exit(ujiDatabase())
        }
        if *modeGroq {
                ujiGroq()
                return
        }
        fmt.Println("pakai: umkm-selftest --db | --groq")
        os.Exit(2)
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
        // SAVEPOINT (fix run-5): insert bentrok ini MEMANG harus gagal dengan
        // 23505. Tanpa savepoint, error itu memasukkan transaksi ke keadaan
        // aborted — uji chat_history/audit berikutnya ditolak dengan 25P02
        // "current transaction is aborted" (persis kegagalan run-4).
        // ROLLBACK TO SAVEPOINT memulihkan transaksi supaya uji lanjutan
        // tetap jalan; seluruh transaksi tetap di-ROLLBACK penuh di akhir
        // sehingga data uji tidak pernah tersimpan.
        if _, err := tx.Exec(ctx, "SAVEPOINT uji_sku_bentrok"); err != nil {
                return fatal("gagal membuat savepoint uji SKU: %v", err)
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
        if _, err := tx.Exec(ctx, "ROLLBACK TO SAVEPOINT uji_sku_bentrok"); err != nil {
                return fatal("gagal memulihkan transaksi dari savepoint uji SKU: %v", err)
        }
        fmt.Println("OK  SKU per outlet: SKU kembar DALAM satu outlet DITOLAK (23505)")

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
// RUN-5: MODEL= dan FALLBACK= ikut dicetak supaya log delivery jelas
// memakai model mana; galat kini membawa kode HTTP + balasan penyedia
// apa adanya (jendela diagnosis 403 Groq).
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
                return
        }
        fmt.Println("HASIL=SUDAH")
        fmt.Printf("MODEL=%s\n", cfg.Model)
        if len(cfg.FallbackModels) > 0 {
                fmt.Printf("FALLBACK=%s\n", strings.Join(cfg.FallbackModels, ","))
        }

        // PROBE: GET /models dengan Bearer — validasi kunci langsung di Groq.
        probe := probeStatus(cfg)
        fmt.Printf("PROBE=%d\n", probe)

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

        klien := store.Klien()
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

func probeStatus(cfg ai.ConfigEfektif) int {
        klien := ai.NewHttpLlmClient(cfg.BaseURL, cfg.APIKey, cfg.Model)
        return klien.Probe()
}

func ujiChat(ctx context.Context, klien ai.Client, riwayat []ai.Pesan, nama string) {
        question := "5 tambah 5? Jawab singkat."
        if nama == "BEBAS2" {
                question = "Apa ibu kota Indonesia? Jawab satu kalimat."
        }
        pesan := append([]ai.Pesan{}, riwayat...)
        pesan = append(pesan, ai.Pesan{Role: "user", Content: question})
        jawaban, err := klien.Complete(ctx, pesan, 0.2, 700)
        if err != nil {
                teks := err.Error()
                if len(teks) > 300 {
                        teks = teks[:300]
                }
                // RUN-5: kode HTTP dibawa keluar lewat penanda angka supaya
                // gate [4b] skrip delivery menampilkan penyebab PERSIS dari
                // penyedia (403 izin model, 404 model tak dikenal, 401 kunci,
                // 429 laju) — bukan sekadar ERR misterius.
                status := 0
                if le, ok := err.(*ai.LlmError); ok {
                        status = le.Status()
                }
                switch {
                case status >= 400:
                        fmt.Printf("%s=%d\n", nama, status)
                case strings.Contains(teks, "tidak terjangkau"):
                        fmt.Printf("%s=GAGAL\n", nama)
                default:
                        fmt.Printf("%s=ERR\n", nama)
                }
                fmt.Printf("%sRAW=%s\n", nama, teks)
                return
        }
        fmt.Printf("%s=200\n", nama)
        // model yang BENAR-BENAR menjawab — bila berbeda dari MODEL= di
        // atas, rantai cadangan run-5-lah yang menyelamatkan jawaban ini.
        fmt.Printf("%sMODEL=%s\n", nama, klien.Model())
        teks := strings.Join(strings.Fields(jawaban), " ")
        if len(teks) > 140 {
                teks = teks[:140]
        }
        fmt.Printf("%sTEKS=%s\n", nama, teks)
}
