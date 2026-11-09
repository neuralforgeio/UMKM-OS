package handler

// Endpoint OSCAR (era Go murni) — port dari routes/assistant.py
// (ml-service) ke backend Go. Kontrak JSON SAMA PERSIS dengan era
// FastAPI (plain JSON + field `detail` untuk galat, BUKAN envelope
// Go) supaya frontend tidak berubah bentuk panggilannya:
//
//      POST /api/v1/assistant/chat     — jawab pertanyaan pemilik dari DATA
//      GET  /api/v1/assistant/history  — riwayat percakapan (panel frontend)
//      GET  /api/v1/assistant/status   — status mode/model (PUBLIK)
//      GET  /api/v1/assistant/llm-config — pengaturan LLM efektif (masker)
//      PUT  /api/v1/assistant/llm-config — simpan pengaturan LLM dari UI
//      POST /api/v1/assistant/llm-selftest — uji sambungan penyedia
//      GET  /api/v1/assistant/oscar-developer-report[?pin=] — AI Developer
//
// Alur chat (pola blueprint BAB 6.5, kini satu proses dengan Go):
//   1. Gerbang X-Internal-Key (INTERNAL_API_KEY; kosong = dev lokal).
//      Identitas user_id DIPERCAYAI gateway frontend yang sudah
//      memeriksa sesi NextAuth.
//   2. Batas laju sliding-window per user (default 12/jam).
//   3. Cache jawaban per user+outlet+pertanyaan ternormalisasi (TTL
//      600 detik) — pertanyaan pagian yang sama tidak membakar token.
//   4. Retrieval SQL BACA-SAJA: ringkasan penjualan, tren mingguan,
//      produk terlaris, stok kritis, jam ramai, status ramalan,
//      kemajuan gerbang data.
//   5. Generasi dwi-mode "AI Bebas" + validasi angka KHUSUS maksud
//      bisnis + 1 retry koreksi. Tanpa klien aktif: 503 jujur.
//   6. Riwayat 2 baris (USER lalu ASSISTANT) + cache bila tervalidasi.
//
// Mode Developer (dev_laporan): laporan lintas toko ber-PIN dijawab
// LANGSUNG dari mesin, TIDAK lewat LLM — data toko lain tidak pernah
// mengalir ke prompt penyedia eksternal (privasi per-owner).

import (
        "context"
        "encoding/json"
        "fmt"
        "net/http"
        "strconv"
        "strings"
        "time"

        "github.com/neuralforgeio/internal/ai"
        "github.com/neuralforgeio/internal/config"
        "github.com/neuralforgeio/internal/db"
)

var (
        aiStore    *ai.ConfigStore
        aiCache    *ai.AnswerCache
        aiLimiter  *ai.SlidingWindowLimiter
        devLimiter *ai.SlidingWindowLimiter
)

// PasangAssistant memasang singleton OSCAR — dipanggil main.go saat
// boot (setelah db.Connect supaya retrieval lintas toko siap).
func PasangAssistant() {
        aiStore = ai.NewConfigStore(config.AIDataDir(), ai.EnvSource{
                Enabled:        config.LLMEnabled(),
                BaseURL:        config.LLMBaseURL(),
                APIKey:         config.LLMAPIKey(),
                Model:          config.LLMModel(),
                FallbackModels: config.LLMFallbackModels(),
        })
        aiCache = ai.NewAnswerCache(config.AssistantCacheSeconds(), 256)
        aiLimiter = ai.NewSlidingWindowLimiter(config.AssistantRateLimitPerHour(), 3600)
        devLimiter = ai.NewSlidingWindowLimiter(config.DevAIRateLimitPerHour(), 3600)

        ai.Dev = ai.NewDevReportStore(config.AIDataDir())
        ai.Dev.Ringkas = ringkasLintasToko
}

func tulisDetail(w http.ResponseWriter, status int, pesan string) {
        w.WriteHeader(status)
        _ = json.NewEncoder(w).Encode(map[string]string{"detail": pesan})
}

func bacaJSON(w http.ResponseWriter, r *http.Request, v interface{}) bool {
        if err := json.NewDecoder(r.Body).Decode(v); err != nil {
                tulisDetail(w, http.StatusBadRequest, "Permintaan tidak valid.")
                return false
        }
        return true
}

// =====================================================================
// Retrieval SQL baca-saja (konteks DATA per pertanyaan)
// =====================================================================

// jkt zona waktu warung — semua batas hari mengikuti WIB.
var jkt = mustZona("Asia/Jakarta")

func mustZona(nama string) *time.Location {
        z, err := time.LoadLocation(nama)
        if err != nil {
                return time.UTC
        }
        return z
}

func tanggalJKT(mundur int) string {
        return time.Now().In(jkt).AddDate(0, 0, -mundur).Format("2006-01-02")
}

// sqlKondisi: penyusun WHERE + argumen pgx yang menambah filter
// outlet_id bila konteks per-outlet (> 0).
type sqlKondisi struct {
        where []string
        args  []interface{}
}

func (s *sqlKondisi) arg(v interface{}) string {
        s.args = append(s.args, v)
        return "$" + strconv.Itoa(len(s.args))
}

func (s *sqlKondisi) outlet(kolom string, outletID int64) {
        if outletID > 0 {
                s.where = append(s.where, kolom+" = "+s.arg(outletID))
        }
}

func (s *sqlKondisi) klausa() string {
        return strings.Join(s.where, " AND ")
}

// ringkasPenjualan: omzet + jumlah transaksi untuk 4 jendela waktu
// (termasuk hari berjalan sebagai potongan hidup — pemilik bertanya
// sepanjang hari, menunggu tutup buku justru membohongkan "hari ini").
func ringkasPenjualan(ctx context.Context, outletID int64) map[string]ai.PenjualanBlok {
        jendela := map[string][2]string{
                "hari_ini":        {tanggalJKT(0), tanggalJKT(0)},
                "kemarin":         {tanggalJKT(1), tanggalJKT(1)},
                "tujuh_hari":      {tanggalJKT(6), tanggalJKT(0)},
                "tiga_puluh_hari": {tanggalJKT(29), tanggalJKT(0)},
        }
        urut := []string{"hari_ini", "kemarin", "tujuh_hari", "tiga_puluh_hari"}
        hasil := map[string]ai.PenjualanBlok{}
        for _, nama := range urut {
                k := &sqlKondisi{where: []string{"t.status = 'COMPLETED'"}}
                k.where = append(k.where,
                        "(t.created_at AT TIME ZONE 'Asia/Jakarta')::date >= "+k.arg(jendela[nama][0])+"::date",
                        "(t.created_at AT TIME ZONE 'Asia/Jakarta')::date <= "+k.arg(jendela[nama][1])+"::date")
                k.outlet("t.outlet_id", outletID)
                var omzet, transaksi int64
                _ = db.Pool.QueryRow(ctx, fmt.Sprintf(
                        `SELECT COALESCE(SUM(t.total),0), COUNT(t.id) FROM transactions t WHERE %s`,
                        k.klausa()), k.args...).Scan(&omzet, &transaksi)
                hasil[nama] = ai.PenjualanBlok{Omzet: omzet, Transaksi: transaksi}
        }
        return hasil
}

// perubahanMingguan: WoW — 7 hari terakhir vs 7 hari sebelumnya
// (nil bila minggu lalu 0).
func perubahanMingguan(ctx context.Context, outletID int64) *float64 {
        kini := &sqlKondisi{where: []string{"t.status = 'COMPLETED'"}}
        kini.where = append(kini.where,
                "(t.created_at AT TIME ZONE 'Asia/Jakarta')::date >= "+kini.arg(tanggalJKT(6))+"::date")
        kini.outlet("t.outlet_id", outletID)

        dulu := &sqlKondisi{where: []string{"t.status = 'COMPLETED'"}}
        dulu.where = append(dulu.where,
                "(t.created_at AT TIME ZONE 'Asia/Jakarta')::date >= "+dulu.arg(tanggalJKT(13))+"::date",
                "(t.created_at AT TIME ZONE 'Asia/Jakarta')::date <= "+dulu.arg(tanggalJKT(7))+"::date")
        dulu.outlet("t.outlet_id", outletID)

        var vKini, vDulu int64
        _ = db.Pool.QueryRow(ctx,
                `SELECT COALESCE(SUM(t.total),0) FROM transactions t WHERE `+kini.klausa(),
                kini.args...).Scan(&vKini)
        _ = db.Pool.QueryRow(ctx,
                `SELECT COALESCE(SUM(t.total),0) FROM transactions t WHERE `+dulu.klausa(),
                dulu.args...).Scan(&vDulu)
        if vDulu == 0 {
                return nil
        }
        p := (float64(vKini) - float64(vDulu)) / float64(vDulu) * 100.0
        p = float64(int(p*10)) / 10 // round 1 desimal (gaya ml-service)
        return &p
}

// produkTop: produk terlaris 7 hari (qty + omzet).
func produkTop(ctx context.Context, outletID int64, limit int) []ai.ProdukTopItem {
        k := &sqlKondisi{where: []string{"t.status = 'COMPLETED'"}}
        k.where = append(k.where,
                "(t.created_at AT TIME ZONE 'Asia/Jakarta')::date >= "+k.arg(tanggalJKT(6))+"::date")
        k.outlet("t.outlet_id", outletID)
        rows, err := db.Pool.Query(ctx, fmt.Sprintf(`
                SELECT ti.product_name, COALESCE(SUM(ti.qty),0), COALESCE(SUM(ti.subtotal),0)
                FROM transaction_items ti
                JOIN transactions t ON ti.transaction_id = t.id
                WHERE %s
                GROUP BY ti.product_name
                ORDER BY COALESCE(SUM(ti.qty),0) DESC
                LIMIT %d`, k.klausa(), limit), k.args...)
        if err != nil {
                return nil
        }
        defer rows.Close()
        var hasil []ai.ProdukTopItem
        for rows.Next() {
                var p ai.ProdukTopItem
                if err := rows.Scan(&p.Nama, &p.Qty, &p.Omzet); err != nil {
                        return hasil
                }
                hasil = append(hasil, p)
        }
        return hasil
}

// laku7Hari: qty terjual per nama produk 7 hari (dipakai estimasi hari
// habis di stok kritis).
func laku7Hari(ctx context.Context, outletID int64) map[string]int64 {
        k := &sqlKondisi{where: []string{"t.status = 'COMPLETED'"}}
        k.where = append(k.where,
                "(t.created_at AT TIME ZONE 'Asia/Jakarta')::date >= "+k.arg(tanggalJKT(6))+"::date")
        k.outlet("t.outlet_id", outletID)
        rows, err := db.Pool.Query(ctx, fmt.Sprintf(`
                SELECT ti.product_name, COALESCE(SUM(ti.qty),0)
                FROM transaction_items ti
                JOIN transactions t ON ti.transaction_id = t.id
                WHERE %s
                GROUP BY ti.product_name`, k.klausa()), k.args...)
        if err != nil {
                return map[string]int64{}
        }
        defer rows.Close()
        hasil := map[string]int64{}
        for rows.Next() {
                var nama string
                var qty int64
                if err := rows.Scan(&nama, &qty); err == nil {
                        hasil[nama] = qty
                }
        }
        return hasil
}

// stokKritis: produk aktif dengan stok <= min_stok + saran restok
// ringan (cukup ke 2x min_stok — pembelian hati-hati UMKM) + estimasi
// hari habis dari kecepatan laku 7 hari.
func stokKritis(ctx context.Context, outletID int64, limit int) []ai.StokKritisItem {
        k := &sqlKondisi{where: []string{"p.is_active = TRUE", "p.stock <= p.min_stock"}}
        k.outlet("p.outlet_id", outletID)
        rows, err := db.Pool.Query(ctx, fmt.Sprintf(`
                SELECT p.name, p.stock, p.min_stock
                FROM products p
                WHERE %s
                ORDER BY (p.stock - p.min_stock) ASC
                LIMIT %d`, k.klausa(), limit), k.args...)
        if err != nil {
                return nil
        }
        defer rows.Close()
        laku := laku7Hari(ctx, outletID)
        var hasil []ai.StokKritisItem
        for rows.Next() {
                var s ai.StokKritisItem
                if err := rows.Scan(&s.Nama, &s.Stok, &s.MinStok); err != nil {
                        return hasil
                }
                s.SaranRestok = 2*s.MinStok - s.Stok
                if s.SaranRestok < 0 {
                        s.SaranRestok = 0
                }
                kecepatan := float64(laku[s.Nama]) / 7.0
                kecepatan = float64(int(kecepatan*100)) / 100 // round 2 desimal
                s.KecepatanHari = kecepatan
                if kecepatan > 0 {
                        hh := float64(s.Stok) / kecepatan
                        hh = float64(int(hh*10)) / 10
                        s.HariHabis = &hh
                } else if s.Stok <= 0 {
                        hh := 0.0
                        s.HariHabis = &hh
                }
                hasil = append(hasil, s)
        }
        return hasil
}

// jamRamai: jam belanja paling ramai 7 hari (jumlah transaksi/jam).
func jamRamai(ctx context.Context, outletID int64, limit int) []ai.JamRamaiItem {
        k := &sqlKondisi{where: []string{"t.status = 'COMPLETED'"}}
        k.where = append(k.where,
                "(t.created_at AT TIME ZONE 'Asia/Jakarta')::date >= "+k.arg(tanggalJKT(6))+"::date")
        k.outlet("t.outlet_id", outletID)
        rows, err := db.Pool.Query(ctx, fmt.Sprintf(`
                SELECT EXTRACT(HOUR FROM t.created_at AT TIME ZONE 'Asia/Jakarta'), COUNT(t.id)
                FROM transactions t
                WHERE %s
                GROUP BY 1
                ORDER BY COUNT(t.id) DESC
                LIMIT %d`, k.klausa(), limit), k.args...)
        if err != nil {
                return nil
        }
        defer rows.Close()
        var hasil []ai.JamRamaiItem
        for rows.Next() {
                var j ai.JamRamaiItem
                var jam float64
                if err := rows.Scan(&jam, &j.Transaksi); err == nil {
                        j.Jam = int64(jam)
                        hasil = append(hasil, j)
                }
        }
        return hasil
}

// gerbangRamalan: syarat data model ramalan (padanan ml_trainer:
// MIN_DAYS=28, MIN_NONZERO=14, window 180 hari).
const (
        gerbangMinHari     = 28
        gerbangMinBeromzet = 14
        gerbangWindowHari  = 180
)

// progressML: kemajuan gerbang data model ramalan outlet.
func progressML(ctx context.Context, outletID int64) *ai.MLProgress {
        k := &sqlKondisi{where: []string{"t.status = 'COMPLETED'"}}
        k.where = append(k.where,
                "(t.created_at AT TIME ZONE 'Asia/Jakarta')::date >= "+k.arg(tanggalJKT(gerbangWindowHari-1))+"::date")
        k.outlet("t.outlet_id", outletID)
        var hariData, hariPendapatan int64
        err := db.Pool.QueryRow(ctx, fmt.Sprintf(`
                SELECT COUNT(*), COALESCE(SUM(CASE WHEN d.omzet > 0 THEN 1 ELSE 0 END),0)
                FROM (
                        SELECT (t.created_at AT TIME ZONE 'Asia/Jakarta')::date AS d,
                               SUM(t.total) AS omzet
                        FROM transactions t
                        WHERE %s
                        GROUP BY 1
                ) d`, k.klausa()), k.args...).Scan(&hariData, &hariPendapatan)
        if err != nil {
                return nil
        }
        return &ai.MLProgress{
                HariData:          hariData,
                HariPendapatan:    hariPendapatan,
                GerbangHari:       gerbangMinHari,
                GerbangPendapatan: gerbangMinBeromzet,
                GerbangTerpenuhi:  hariData >= gerbangMinHari && hariPendapatan >= gerbangMinBeromzet,
        }
}

// deretHarian: omzet per hari (kronologis naik) untuk ramalan + status.
func deretHarian(ctx context.Context, outletID int64, hari int) []ai.HariOmzet {
        k := &sqlKondisi{where: []string{"t.status = 'COMPLETED'"}}
        k.where = append(k.where,
                "(t.created_at AT TIME ZONE 'Asia/Jakarta')::date >= "+k.arg(tanggalJKT(hari-1))+"::date")
        k.outlet("t.outlet_id", outletID)
        rows, err := db.Pool.Query(ctx, fmt.Sprintf(`
                SELECT (t.created_at AT TIME ZONE 'Asia/Jakarta')::date AS d,
                       SUM(t.total), COUNT(t.id)
                FROM transactions t
                WHERE %s
                GROUP BY 1
                ORDER BY 1 ASC`, k.klausa()), k.args...)
        if err != nil {
                return nil
        }
        defer rows.Close()
        var hasil []ai.HariOmzet
        for rows.Next() {
                var d time.Time
                var omzet float64
                var trx int64
                if err := rows.Scan(&d, &omzet, &trx); err == nil {
                        hasil = append(hasil, ai.HariOmzet{Tanggal: d, Omzet: omzet, Transaksi: trx})
                }
        }
        return hasil
}

// statusPrediksi: status model ramalan outlet (statistical era Go
// murni; mape jujur dari backtest, nil bila belum bisa dihitung).
func statusPrediksi(ctx context.Context, outletID int64) ai.PrediksiInfo {
        if outletID <= 0 {
                return ai.PrediksiInfo{}
        }
        deret := deretHarian(ctx, outletID, 90)
        if len(deret) < 14 {
                return ai.PrediksiInfo{Tersedia: false, Engine: "statistical"}
        }
        mape := ai.BacktestMAPE(deret, deret[len(deret)-1].Tanggal)
        return ai.PrediksiInfo{Tersedia: true, Engine: "statistical", Mape: mape}
}

// bangunDataContext: konteks DATA lengkap untuk prompt/validasi.
func bangunDataContext(ctx context.Context, outletID int64, namaOutlet string) *ai.DataContext {
        return &ai.DataContext{
                Outlet:              namaOutlet,
                Penjualan:           ringkasPenjualan(ctx, outletID),
                PerubahanMingguanPct: perubahanMingguan(ctx, outletID),
                ProdukTop:           produkTop(ctx, outletID, 5),
                StokKritis:          stokKritis(ctx, outletID, 6),
                JamRamai:            jamRamai(ctx, outletID, 3),
                Prediksi:            statusPrediksi(ctx, outletID),
                MLProgress:          progressML(ctx, outletID),
        }
}

// =====================================================================
// Riwayat & persistensi
// =====================================================================

type riwayatBaris struct {
        Role      string    `json:"role"`
        Content   string    `json:"content"`
        CreatedAt time.Time `json:"created_at"`
}

func muatRiwayat(ctx context.Context, userID int64, limit int) []riwayatBaris {
        rows, err := db.Pool.Query(ctx, `
                SELECT role, content, created_at FROM chat_history
                WHERE user_id = $1
                ORDER BY created_at DESC, id DESC
                LIMIT $2`, userID, limit)
        if err != nil {
                return nil
        }
        defer rows.Close()
        var terbalik []riwayatBaris
        for rows.Next() {
                var b riwayatBaris
                if err := rows.Scan(&b.Role, &b.Content, &b.CreatedAt); err == nil {
                        terbalik = append(terbalik, b)
                }
        }
        // Kronologis naik (pesan terbaru di akhir) — untuk konteks LLM & panel.
        hasil := make([]riwayatBaris, 0, len(terbalik))
        for i := len(terbalik) - 1; i >= 0; i-- {
                hasil = append(hasil, terbalik[i])
        }
        return hasil
}

// simpanRiwayat menulis dua baris (USER lalu ASSISTANT) dengan SATU
// cap waktu — urutan tidak pernah terbalik karena selisih mikrodetik.
func simpanRiwayat(ctx context.Context, userID int64, outletID int64, pertanyaan, jawaban string) error {
        var oid interface{}
        if outletID > 0 {
                oid = outletID
        }
        now := time.Now().UTC()
        _, err := db.Pool.Exec(ctx, `
                INSERT INTO chat_history (user_id, outlet_id, role, content, created_at)
                VALUES ($1, $2, 'USER', $3, $4), ($1, $2, 'ASSISTANT', $5, $4)`,
                userID, oid, pertanyaan, now, jawaban)
        return err
}

// =====================================================================
// Endpoint
// =====================================================================

type chatRequest struct {
        UserID   int64  `json:"user_id"`
        Question string `json:"question"`
        OutletID string `json:"outlet_id"`
}

type chatResponse struct {
        Answer           string `json:"answer"`
        Mode             string `json:"mode"`
        Intent           string `json:"intent"`
        Period           string `json:"period"`
        NumbersValidated bool   `json:"numbers_validated"`
        Cached           bool   `json:"cached"`
        Retried          bool   `json:"retried"`
        Engine           string `json:"engine"`
        OutletID         string `json:"outlet_id"`
        OutletName       string `json:"outlet_name"`
}

// resolveOutletAssistant: outlet konteks + namanya (frontend mengirim
// outlet_id sesi pemilik; tanpa itu dipakai ikatan akun/outlet utama).
func resolveOutletAssistant(ctx context.Context, outletID string) (int64, string) {
        if v := strings.TrimSpace(outletID); v != "" {
                if id, err := strconv.ParseInt(v, 10, 64); err == nil && id > 0 {
                        var nama string
                        if err := db.Pool.QueryRow(ctx,
                                `SELECT name FROM outlets WHERE id = $1`, id).Scan(&nama); err == nil {
                                return id, nama
                        }
                }
        }
        var id int64
        var nama string
        if err := db.Pool.QueryRow(ctx, `
                SELECT o.id, o.name FROM outlets o
                ORDER BY o.created_at ASC, o.id ASC LIMIT 1`).Scan(&id, &nama); err != nil {
                return 0, "-"
        }
        return id, nama
}

// AssistantChat: POST /api/v1/assistant/chat.
func AssistantChat(w http.ResponseWriter, r *http.Request) {
        if aiStore == nil {
                tulisDetail(w, http.StatusServiceUnavailable, "Layanan asisten belum siap.")
                return
        }
        var payload chatRequest
        if !bacaJSON(w, r, &payload) {
                return
        }
        if payload.UserID < 1 {
                tulisDetail(w, http.StatusUnprocessableEntity, "Identitas pengguna tidak sah.")
                return
        }
        question := strings.TrimSpace(payload.Question)
        if question == "" {
                tulisDetail(w, http.StatusUnprocessableEntity, "Tulis pertanyaannya dulu.")
                return
        }
        if len(question) > 500 {
                question = question[:500]
        }

        kunci := "user:" + strconv.FormatInt(payload.UserID, 10)
        now := time.Now()
        if !aiLimiter.Allow(kunci, now) {
                tunggu := int(aiLimiter.RetryAfterSeconds(kunci, now)) + 1
                w.Header().Set("Retry-After", strconv.Itoa(tunggu))
                tulisDetail(w, http.StatusTooManyRequests, fmt.Sprintf(
                        "Batas %d pertanyaan per jam tercapai. Coba lagi dalam %d detik.",
                        config.AssistantRateLimitPerHour(), tunggu))
                return
        }

        outletID, namaOutlet := resolveOutletAssistant(r.Context(), payload.OutletID)
        outletStr := strconv.FormatInt(outletID, 10)

        if tercache := aiCache.Get(payload.UserID, outletStr, question, now); tercache != "" {
                klien := aiStore.Klien()
                engine := "offline"
                mode := "data"
                if klien != nil {
                        engine = klien.Model()
                        mode = "ai"
                }
                _ = json.NewEncoder(w).Encode(chatResponse{
                        Answer: tercache, Mode: mode,
                        Intent: ai.ClassifyIntent(question), Period: ai.ExtractPeriod(question),
                        NumbersValidated: true, Cached: true, Retried: false,
                        Engine: engine, OutletID: outletStr, OutletName: namaOutlet,
                })
                return
        }

        riwayat := muatRiwayat(r.Context(), payload.UserID, ai.HistoryTurns)
        var history []ai.Pesan
        for _, b := range riwayat {
                history = append(history, ai.Pesan{Role: b.Role, Content: b.Content})
        }

        var jawaban string
        var mode, intent, period string
        var tervalidasi, dicobaLagi bool

        if ai.ClassifyIntent(question) == "dev_laporan" {
                // Mode Developer — LANGSUNG dari mesin, TANPA LLM: data toko
                // lain tidak pernah mengalir ke prompt penyedia eksternal.
                jawaban = ai.Dev.JawabChat(question)
                mode = "data"
                intent = "dev_laporan"
                period = "hari"
                tervalidasi = true
        } else {
                konteks := bangunDataContext(r.Context(), outletID, namaOutlet)
                klien := aiStore.Klien()
                if klien == nil {
                        tulisDetail(w, http.StatusServiceUnavailable,
                                "OSCAR belum terhubung ke AI. Buka Pengaturan -> Asisten AI "+
                                        "lalu pastikan Mode AI aktif dan kunci penyedia terisi, "+
                                        "kemudian coba lagi.")
                        return
                }
                hasil, err := ai.GenerateAnswer(r.Context(), question, konteks, history, klien)
                if err != nil {
                        status := http.StatusBadGateway
                        if _, ok := err.(*ai.ModeAiNonaktif); ok {
                                status = http.StatusServiceUnavailable
                        }
                        tulisDetail(w, status, "OSCAR tidak bisa menghubungi AI saat ini. "+err.Error())
                        return
                }
                jawaban = hasil.Answer
                mode = hasil.Mode
                intent = hasil.Intent
                period = hasil.Period
                tervalidasi = hasil.NumbersValidated
                dicobaLagi = hasil.Retried
        }

        _ = simpanRiwayat(r.Context(), payload.UserID, outletID, question, jawaban)

        if tervalidasi {
                aiCache.Put(payload.UserID, outletStr, question, jawaban, now)
        }

        engine := "offline"
        if k := aiStore.Klien(); k != nil {
                engine = k.Model()
        }
        _ = json.NewEncoder(w).Encode(chatResponse{
                Answer: jawaban, Mode: mode, Intent: intent, Period: period,
                NumbersValidated: tervalidasi, Cached: false, Retried: dicobaLagi,
                Engine: engine, OutletID: outletStr, OutletName: namaOutlet,
        })
}

// AssistantHistory: GET /api/v1/assistant/history?user_id=&limit=.
func AssistantHistory(w http.ResponseWriter, r *http.Request) {
        q := r.URL.Query()
        userID, err := strconv.ParseInt(strings.TrimSpace(q.Get("user_id")), 10, 64)
        if err != nil || userID < 1 {
                tulisDetail(w, http.StatusUnprocessableEntity, "Parameter user_id wajib angka >= 1.")
                return
        }
        limit := 20
        if v, err := strconv.Atoi(strings.TrimSpace(q.Get("limit"))); err == nil && v > 0 && v <= 50 {
                limit = v
        }
        baris := muatRiwayat(r.Context(), userID, limit)
        pesan := make([]riwayatBaris, 0, len(baris))
        pesan = append(pesan, baris...)
        _ = json.NewEncoder(w).Encode(map[string]interface{}{
                "messages": pesan,
                "total":    len(pesan),
        })
}

// AssistantStatus: GET /api/v1/assistant/status (PUBLIK tanpa key —
// kejujuran status lebih berguna daripada menyembunyikannya).
func AssistantStatus(w http.ResponseWriter, r *http.Request) {
        cfg := aiStore.Efektif()
        model := (*string)(nil)
        if cfg.Terkonfigurasi() {
                m := cfg.Model
                model = &m
        }
        _ = json.NewEncoder(w).Encode(map[string]interface{}{
                "version":             config.AppVersion,
                "llm_configured":      cfg.Terkonfigurasi(),
                "llm_model":           model,
                "mode":                map[bool]string{true: "ai", false: "data"}[cfg.Terkonfigurasi()],
                "rate_limit_per_hour": config.AssistantRateLimitPerHour(),
                "cache_seconds":       config.AssistantCacheSeconds(),
                "dev_ai_rate_limit_per_hour": config.DevAIRateLimitPerHour(),
                "engine":              "go-statistical",
        })
}

type llmConfigOut struct {
        Enabled       bool    `json:"enabled"`
        BaseURL       string  `json:"base_url"`
        Model         string  `json:"model"`
        APIKeyMasked  string  `json:"api_key_masked"`
        Source        string  `json:"source"`
        LlmConfigured bool    `json:"llm_configured"`
        LlmModel      *string `json:"llm_model"`
        Mode          string  `json:"mode"`
        ModelLocked   bool    `json:"model_locked"`
}

func llmConfigKeluar() llmConfigOut {
        cfg := aiStore.Efektif()
        var model *string
        if cfg.Terkonfigurasi() {
                m := cfg.Model
                model = &m
        }
        mode := "data"
        if cfg.Terkonfigurasi() {
                mode = "ai"
        }
        return llmConfigOut{
                Enabled:       cfg.Enabled,
                BaseURL:       cfg.BaseURL,
                Model:         cfg.Model,
                APIKeyMasked:  ai.MaskKey(cfg.APIKey),
                Source:        cfg.Source,
                LlmConfigured: cfg.Terkonfigurasi(),
                LlmModel:      model,
                Mode:          mode,
                ModelLocked:   cfg.ModelLocked,
        }
}

// GetLlmConfig: GET /api/v1/assistant/llm-config.
func GetLlmConfig(w http.ResponseWriter, r *http.Request) {
        _ = json.NewEncoder(w).Encode(llmConfigKeluar())
}

type llmConfigIn struct {
        Enabled      bool   `json:"enabled"`
        BaseURL      string `json:"base_url"`
        APIKey       string `json:"api_key"`
        Model        string `json:"model"`
        ModelLocked  *bool  `json:"model_locked"`
}

// PutLlmConfig: PUT /api/v1/assistant/llm-config — simpan pengaturan
// LLM ke volume aidata, langsung berlaku tanpa restart.
//
// Validasi ditolak 422 (bukan 500) dengan pesan bahasa Indonesia.
// ERA GO MURNI — MODEL LOCK: bila model dikunci developer
// (llm_config.json model_locked=true), pemilik (OWNER) ditolak 403;
// hanya DEVELOPER yang boleh mengubah pengaturan (dan membuka kunci).
// Peran pelaku dibawa header X-Acting-Role dari gateway frontend yang
// sudah memeriksa sesi (pola kepercayaan yang sama dengan user_id).
func PutLlmConfig(w http.ResponseWriter, r *http.Request) {
        var payload llmConfigIn
        if !bacaJSON(w, r, &payload) {
                return
        }
        base := strings.TrimSpace(payload.BaseURL)
        kunci := strings.TrimSpace(payload.APIKey)
        model := strings.TrimSpace(payload.Model)

        cfg := aiStore.Efektif()
        peran := strings.ToUpper(strings.TrimSpace(r.Header.Get("X-Acting-Role")))

        if cfg.ModelLocked && peran != "DEVELOPER" {
                tulisDetail(w, http.StatusForbidden,
                        "Model AI dikunci developer: pengaturan model beku sampai developer "+
                                "membuka kuncinya (llm_config.json). Hubungi developer Anda.")
                return
        }

        if payload.Enabled {
                if !strings.HasPrefix(base, "http://") && !strings.HasPrefix(base, "https://") {
                        tulisDetail(w, http.StatusUnprocessableEntity,
                                "Base URL harus berawalan http:// atau https:// (contoh: "+
                                        "https://api.groq.com/openai/v1).")
                        return
                }
                if model == "" {
                        tulisDetail(w, http.StatusUnprocessableEntity,
                                "Nama model wajib diisi (contoh: openai/gpt-oss-20b).")
                        return
                }
        }

        terkunci := cfg.ModelLocked
        if payload.ModelLocked != nil {
                // Hanya developer yang boleh mengubah status kunci.
                if peran == "DEVELOPER" {
                        terkunci = *payload.ModelLocked
                }
        }

        if err := aiStore.Simpan(base, kunci, model, payload.Enabled, terkunci); err != nil {
                tulisDetail(w, http.StatusInternalServerError,
                        "Gagal menyimpan pengaturan (volume aidata tidak bisa ditulis).")
                return
        }
        _ = json.NewEncoder(w).Encode(llmConfigKeluar())
}

// LlmSelftest: POST /api/v1/assistant/llm-selftest — tombol "Tes
// Koneksi" di Pengaturan -> Asisten AI.
func LlmSelftest(w http.ResponseWriter, r *http.Request) {
        hasil := ai.RunSelftest(r.Context(), aiStore, nil)
        _ = json.NewEncoder(w).Encode(hasil)
}

// OscarDeveloperReport: GET /api/v1/assistant/oscar-developer-report
// ?pin=... — laporan lintas toko khusus AI Developer. Sengaja TIDAK
// memakai X-Internal-Key supaya bisa dibuka langsung dari browser
// developer dengan PIN; dibatasi laju per IP (DEV_AI_RATE_LIMIT_PER_HOUR).
func OscarDeveloperReport(w http.ResponseWriter, r *http.Request) {
        batasDevAI(w, r)
        sah, muatan := ai.Dev.ApiReport(strings.TrimSpace(r.URL.Query().Get("pin")))
        if !sah {
                _ = json.NewEncoder(w).Encode(muatan)
                return
        }
        _ = json.NewEncoder(w).Encode(muatan)
}

// OscarDeveloperReportRun: GET .../oscar-developer-report/run?pin=... —
// paksa satu laporan proaktif dibuat SEKARANG.
func OscarDeveloperReportRun(w http.ResponseWriter, r *http.Request) {
        batasDevAI(w, r)
        if !ai.Dev.PinSah(strings.TrimSpace(r.URL.Query().Get("pin"))) {
                _ = json.NewEncoder(w).Encode(map[string]interface{}{
                        "ok": false, "error": "PIN developer salah.",
                })
                return
        }
        entri := ai.Dev.LaporanProaktif(true)
        _ = json.NewEncoder(w).Encode(map[string]interface{}{
                "ok": true, "laporan": entri,
        })
}

func batasDevAI(w http.ResponseWriter, r *http.Request) {
        ip := clientIPRingkas(r)
        if !devLimiter.Allow("devai:"+ip, time.Now()) {
                tulisDetail(w, http.StatusTooManyRequests, fmt.Sprintf(
                        "Batas %d permintaan laporan developer per jam tercapai. Coba lagi nanti.",
                        config.DevAIRateLimitPerHour()))
                return
        }
}

func clientIPRingkas(r *http.Request) string {
        if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
                bagian := strings.Split(fwd, ",")
                return strings.TrimSpace(bagian[0])
        }
        if real := r.Header.Get("X-Real-IP"); real != "" {
                return strings.TrimSpace(real)
        }
        alamat := r.RemoteAddr
        for i := len(alamat) - 1; i >= 0; i-- {
                if alamat[i] == ':' {
                        return alamat[:i]
                }
        }
        return alamat
}

// =====================================================================
// Retrieval lintas toko (khusus Mode Developer — ber-PIN)
// =====================================================================

func ringkasLintasToko() (*ai.RingkasanLintas, error) {
        ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
        defer cancel()

        namaOutlet := map[int64]string{0: "(tanpa outlet)"}
        rows, err := db.Pool.Query(ctx, `SELECT id, name FROM outlets WHERE is_active = TRUE`)
        if err == nil {
                for rows.Next() {
                        var id int64
                        var nama string
                        if err := rows.Scan(&id, &nama); err == nil {
                                namaOutlet[id] = nama
                        }
                }
                rows.Close()
        }

        omzetPeriode := func(mundurMulai, mundurAkhir int) map[int64]ai.TokoInfo {
                k := &sqlKondisi{where: []string{"t.status = 'COMPLETED'"}}
                k.where = append(k.where,
                        "(t.created_at AT TIME ZONE 'Asia/Jakarta')::date >= "+k.arg(tanggalJKT(mundurMulai))+"::date",
                        "(t.created_at AT TIME ZONE 'Asia/Jakarta')::date <= "+k.arg(tanggalJKT(mundurAkhir))+"::date")
                hasil := map[int64]ai.TokoInfo{}
                r, err := db.Pool.Query(ctx, fmt.Sprintf(`
                        SELECT t.outlet_id, COUNT(t.id), COALESCE(SUM(t.total),0)
                        FROM transactions t WHERE %s GROUP BY t.outlet_id`, k.klausa()), k.args...)
                if err != nil {
                        return hasil
                }
                defer r.Close()
                for r.Next() {
                        var oidRaw interface{}
                        var trx, omzet int64
                        if err := r.Scan(&oidRaw, &trx, &omzet); err == nil {
                                oid := int64(0)
                                if oidRaw != nil {
                                        switch v := oidRaw.(type) {
                                        case int64:
                                                oid = v
                                        case int32:
                                                oid = int64(v)
                                        }
                                }
                                hasil[oid] = ai.TokoInfo{OutletID: oid, Transaksi: trx, Omzet: omzet}
                        }
                }
                return hasil
        }

        kini := omzetPeriode(6, 0)
        lalu := omzetPeriode(13, 7)

        var toko []ai.TokoInfo
        for oid, info := range kini {
                info.OutletID = oid
                info.Nama = namaOutlet[oid]
                if info.Nama == "" {
                        info.Nama = fmt.Sprintf("outlet %d", oid)
                }
                info.OmzetLalu = lalu[oid].Omzet
                toko = append(toko, info)
        }
        ai.UrutkanToko(toko)

        var diam []map[string]interface{}
        for oid := range lalu {
                if _, ada := kini[oid]; !ada {
                        nama := namaOutlet[oid]
                        if nama == "" {
                                nama = fmt.Sprintf("outlet %d", oid)
                        }
                        diam = append(diam, map[string]interface{}{
                                "outlet_id": oid, "nama": nama,
                        })
                }
        }

        var kritis []ai.StokKritisLintas
        r2, err := db.Pool.Query(ctx, `
                SELECT p.outlet_id, p.name, p.stock, p.min_stock
                FROM products p
                WHERE p.is_active = TRUE AND p.stock <= p.min_stock
                ORDER BY (p.stock - p.min_stock) ASC
                LIMIT 20`)
        if err == nil {
                for r2.Next() {
                        var oidRaw interface{}
                        var s ai.StokKritisLintas
                        if err := r2.Scan(&oidRaw, &s.Nama, &s.Stok, &s.MinStok); err == nil {
                                oid := int64(0)
                                if oidRaw != nil {
                                        switch v := oidRaw.(type) {
                                        case int64:
                                                oid = v
                                        case int32:
                                                oid = int64(v)
                                        }
                                }
                                s.Toko = namaOutlet[oid]
                                if s.Toko == "" {
                                        s.Toko = "?"
                                }
                                kritis = append(kritis, s)
                        }
                }
                r2.Close()
        }

        return &ai.RingkasanLintas{
                Dibuat:       time.Now().UTC().Format("2006-01-02T15:04:05Z"),
                JumlahOutlet: len(namaOutlet) - 1, // kurangi placeholder 0
                Toko:         toko,
                TokoDiam:     diam,
                StokKritis:   kritis,
        }, nil
}
