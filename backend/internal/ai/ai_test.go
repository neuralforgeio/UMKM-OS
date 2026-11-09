package ai

// Unittest orkestrator generasi + uji sambungan + AI Developer +
// ramalan statistik + geo — port perilaku test_assistant_flow.py,
// test_dev_ai.py, test_forecast.py era Python, kini murni Go.

import (
        "context"
        "path/filepath"
        "strings"
        "testing"
        "time"
)

func TestGenerateAnswerUmumTanpaValidasi(t *testing.T) {
        // "5 tambah 5" = maksud umum: angka jawaban TIDAK diadukan ke DATA
        // (keluhan pemilik lama: "10, naik 100%" dicap gagal validasi).
        klien := &stubKlien{model: "uji", jawaban: []string{"10, naik 100%"}}
        hasil, err := GenerateAnswer(context.Background(), "5 tambah 5",
                &DataContext{Outlet: "W", Penjualan: map[string]PenjualanBlok{}}, nil, klien)
        if err != nil {
                t.Fatal(err)
        }
        if hasil.Intent != "umum" || !hasil.NumbersValidated || hasil.Retried {
                t.Fatalf("pertanyaan umum tidak boleh divalidasi: %+v", hasil)
        }
        if hasil.Mode != "ai" || hasil.Answer != "10, naik 100%" {
                t.Fatalf("jawaban harus diteruskan apa adanya: %+v", hasil)
        }
}

func TestGenerateAnswerBisnisRetrySekali(t *testing.T) {
        klien := &stubKlien{model: "uji", jawaban: []string{
                "Omzet hari ini Rp 9.999.999", // karangan -> harus retry
                "Omzet hari ini Rp 125.000",   // koreksi
        }}
        hasil, err := GenerateAnswer(context.Background(), "berapa omzet hari ini",
                &DataContext{
                        Outlet: "W",
                        Penjualan: map[string]PenjualanBlok{"hari_ini": {Omzet: 125000, Transaksi: 5}},
                }, nil, klien)
        if err != nil {
                t.Fatal(err)
        }
        if hasil.Intent != "penjualan" {
                t.Fatalf("maksud harus penjualan: %q", hasil.Intent)
        }
        if !hasil.Retried {
                t.Fatal("jawaban karangan pada maksud bisnis harus memicu retry")
        }
        if !hasil.NumbersValidated || hasil.Answer != "Omzet hari ini Rp 125.000" {
                t.Fatalf("retry harus menghasilkan jawaban sah: %+v", hasil)
        }
        // Instruksi koreksi terkirim sebagai pesan terakhir.
        terakhir := klien.terakhir[len(klien.terakhir)-1]
        if terakhir.Role != "user" || !strings.Contains(terakhir.Content, "Rp 9.999.999") {
                t.Errorf("instruksi koreksi harus menyebut angka pelanggar: %+v", terakhir)
        }
}

func TestGenerateAnswerTanpaKlienJujur503(t *testing.T) {
        _, err := GenerateAnswer(context.Background(), "omzet?",
                &DataContext{Outlet: "W"}, nil, nil)
        if _, ok := err.(*ModeAiNonaktif); !ok {
                t.Fatalf("tanpa klien harus ModeAiNonaktif (503 jujur): %v", err)
        }
}

func TestRunSelftest(t *testing.T) {
        s, _ := storeBaru(t, envUji())

        klien := &stubKlien{model: "uji", jawaban: []string{"SIAP"}}
        hasil := RunSelftest(context.Background(), s, klien)
        if !hasil.Ok || hasil.Mode != "ai" || hasil.AnswerSample == nil ||
                *hasil.AnswerSample != "SIAP" || hasil.Error != nil {
                t.Fatalf("selftest sukses: %+v", hasil)
        }
        if hasil.APIKeyMasked != MaskKey("gsk_envaja1234567890") {
                t.Errorf("kunci hanya boleh keluar dimasker: %q", hasil.APIKeyMasked)
        }

        klienGagal := &stubKlien{model: "uji", jawaban: []string{""}}
        hasil2 := RunSelftest(context.Background(), s, klienGagal)
        // Semantik ml-service: jawaban kosong dari klien SUNGGUHAN sudah
        // menjadi LlmError di klien; stub tanpa galat menghasilkan Ok=true
        // dengan contoh kosong (answer_sample = null).
        if !hasil2.Ok || hasil2.AnswerSample != nil || hasil2.Error != nil {
                t.Fatalf("jawaban kosong dari stub: ok + contoh null: %+v", hasil2)
        }

        // Konfigurasi mati: configured=false + pesan.
        s2, _ := storeBaru(t, EnvSource{Enabled: false})
        hasil3 := RunSelftest(context.Background(), s2, nil)
        if hasil3.Configured || hasil3.Mode != "data" || hasil3.Error == nil {
                t.Fatalf("konfigurasi mati harus jujur: %+v", hasil3)
        }
}

// ===== AI Developer =====

func TestDevReportPin(t *testing.T) {
        dir := t.TempDir()
        tulisFile(t, filepath.Join(dir, "dev_config.json"),
                `{"enabled": true, "pin": "PIN-UJI"}`)
        s := NewDevReportStore(dir)

        if !s.PinSah("PIN-UJI") {
                t.Error("PIN sah harus diterima")
        }
        if s.PinSah("PIN-SALAH") || s.PinSah("") {
                t.Error("PIN salah/kosong harus ditolak")
        }
        if !s.PesanDevSah("mode developer PIN-UJI laporan lintas toko") {
                t.Error("pesan ber-frasa + PIN sah harus lolos")
        }
        if s.PesanDevSah("mode developer PIN-SALAH laporan") {
                t.Error("pesan ber-PIN salah harus ditolak")
        }
        if s.PesanDevSah("PIN-UJI tanpa frasa developer") {
                t.Error("tanpa frasa developer harus ditolak (PIN saja tidak cukup)")
        }

        // Mode mati: semuanya ditolak walau PIN benar.
        tulisFile(t, filepath.Join(dir, "dev_config.json"), `{"enabled": false, "pin": "PIN-UJI"}`)
        if s.PinSah("PIN-UJI") {
                t.Error("mode mati harus menolak semua PIN")
        }
}

func TestDevReportJawabChatTerkunci(t *testing.T) {
        dir := t.TempDir()
        s := NewDevReportStore(dir)
        // Tanpa config: mode belum aktif.
        teks := s.JawabChat("mode developer 1234 laporan")
        if !strings.Contains(teks, "belum diaktifkan") {
                t.Errorf("tanpa config harus menjelaskan mode belum aktif: %q", teks)
        }
        tulisFile(t, filepath.Join(dir, "dev_config.json"), `{"enabled": true, "pin": "1234"}`)
        teks2 := s.JawabChat("mode developer PIN-SALAH laporan")
        if !strings.Contains(teks2, "terkunci") || !strings.Contains(teks2, "PIN") {
                t.Errorf("PIN salah harus menjelaskan kunci: %q", teks2)
        }
}

func TestDevReportCekPemicuDanTeks(t *testing.T) {
        s := NewDevReportStore(t.TempDir())
        cfg := devConfigDefault() // omzet turun > 20%, 3+ stok kritis
        kritis := make([]StokKritisLintas, 4)
        for i := range kritis {
                kritis[i] = StokKritisLintas{Nama: "P", Stok: 1, MinStok: 5, Toko: "T"}
        }
        r := &RingkasanLintas{
                Toko: []TokoInfo{
                        {Nama: "A", Transaksi: 10, Omzet: 600000, OmzetLalu: 1000000},
                        {Nama: "B", Transaksi: 5, Omzet: 70000, OmzetLalu: 70000},
                },
                TokoDiam:   []map[string]interface{}{{"nama": "C"}},
                StokKritis: kritis,
        }
        pemicu := s.CekPemicu(r, cfg)
        if len(pemicu) != 3 {
                t.Fatalf("pemicu seharusnya 3 (stok, omzet turun, toko diam): %v", pemicu)
        }
        teks := s.TeksLaporan(r, pemicu)
        for _, penanda := range []string{
                "LAPORAN DEVELOPER", "A: 10 transaksi, omzet Rp 600.000",
                "Stok kritis gabungan (4 produk)", "Toko tanpa transaksi minggu ini: C",
                "PEMICU LAPORAN",
        } {
                if !strings.Contains(teks, penanda) {
                        t.Errorf("teks laporan harus memuat %q\n%s", penanda, teks)
                }
        }
}

func TestDevReportMaksLimaPuluh(t *testing.T) {
        dir := t.TempDir()
        s := NewDevReportStore(dir)
        for i := 0; i < 60; i++ {
                if err := s.SimpanLaporan(LaporanEntri{
                        Waktu: time.Now().UTC().Format(time.RFC3339), Jenis: "uji", Teks: "t",
                }); err != nil {
                        t.Fatal(err)
                }
        }
        daftar := s.MuatLaporan()
        if len(daftar) != maksLaporan {
                t.Fatalf("laporan harus dijepit 50: %d", len(daftar))
        }
}

func TestDevReportLaporanProaktifPaksa(t *testing.T) {
        dir := t.TempDir()
        tulisFile(t, filepath.Join(dir, "dev_config.json"), `{"enabled": true, "pin": "1"}`)
        s := NewDevReportStore(dir)
        s.Ringkas = func() (*RingkasanLintas, error) {
                return &RingkasanLintas{JumlahOutlet: 1, Toko: []TokoInfo{
                        {Nama: "A", Transaksi: 3, Omzet: 100000, OmzetLalu: 100000},
                }}, nil
        }
        // Prime digest segar supaya siklus tanpa pemicu tidak membuat apa pun
        // (semantik ml-service: digest jatuh tempo tiap 20 jam).
        if err := s.SimpanLaporan(LaporanEntri{
                Waktu: time.Now().UTC().Format(time.RFC3339), Jenis: "digest-harian", Teks: "t",
        }); err != nil {
                t.Fatal(err)
        }
        if s.LaporanProaktif(false) != nil {
                t.Fatal("tanpa pemicu/digest/paksa: tidak ada laporan")
        }
        entri := s.LaporanProaktif(true)
        if entri == nil || entri.Jenis != "digest-harian" {
                t.Fatalf("paksa harus menghasilkan digest: %+v", entri)
        }
        // Ringkasan gagal: laporan tetap dibuat dengan catatan jujur.
        s.Ringkas = func() (*RingkasanLintas, error) {
                return nil, &LlmError{msg: "db"}
        }
        if e := s.LaporanProaktif(true); e == nil || !strings.Contains(e.Teks, "belum ada transaksi") {
                t.Fatalf("ringkasan gagal harus tetap menghasilkan laporan jujur: %+v", e)
        }
}

// ===== Ramalan statistik =====

func TestRamalPendapatanFlatSaatDataTipis(t *testing.T) {
        deret := []HariOmzet{
                {Tanggal: time.Date(2026, 10, 28, 0, 0, 0, 0, time.UTC), Omzet: 100000},
                {Tanggal: time.Date(2026, 10, 29, 0, 0, 0, 0, time.UTC), Omzet: 200000},
        }
        titik := RamalPendapatan(deret, deret[len(deret)-1].Tanggal, 7)
        if len(titik) != 7 {
                t.Fatalf("horizon 7 titik: %d", len(titik))
        }
        for _, p := range titik {
                if p.Point != 150000 {
                        t.Fatalf("data tipis: titik = rata-rata 150000, dapat %v", p.Point)
                }
        }
        if titik[0].Tanggal != "2026-10-30" {
                t.Errorf("ramalan mulai besoknya: %s", titik[0].Tanggal)
        }
        if titik[0].Low != 112500 || titik[0].High != 187500 {
                t.Errorf("pita +-25%%: low=%v high=%v", titik[0].Low, titik[0].High)
        }
}

func TestRamalPendapatanFaktorHari(t *testing.T) {
        // 21 hari: Minggu ramai (300rb), lainnya 100rb -> faktor Minggu > 1.
        dasar := time.Date(2026, 10, 11, 0, 0, 0, 0, time.UTC) // Minggu
        deret := make([]HariOmzet, 0, 21)
        for i := 0; i < 21; i++ {
                tgl := dasar.AddDate(0, 0, i)
                omzet := 100000.0
                if tgl.Weekday() == time.Sunday {
                        omzet = 300000
                }
                deret = append(deret, HariOmzet{Tanggal: tgl, Omzet: omzet})
        }
        akhir := deret[len(deret)-1].Tanggal
        titik := RamalPendapatan(deret, akhir, 7)
        // akhir = Sabtu 31 Okt -> titik pertama = Minggu 1 Nov (hari ramai).
        if titik[0].Hari != "Sunday" {
                t.Fatalf("titik pertama seharusnya Minggu: %+v", titik[0])
        }
        if titik[0].Point <= titik[1].Point {
                t.Errorf("Minggu (ramai) harus lebih tinggi dari Senin: %+v vs %+v",
                        titik[0], titik[1])
        }
}

func TestBacktestMAPEDanKualitas(t *testing.T) {
        if BacktestMAPE(nil, time.Time{}) != nil {
                t.Error("deret kosong: MAPE nil")
        }
        dasar := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
        deret := make([]HariOmzet, 0, 20)
        for i := 0; i < 20; i++ {
                deret = append(deret, HariOmzet{
                        Tanggal: dasar.AddDate(0, 0, i), Omzet: 100000 + float64(i%4)*1000,
                })
        }
        mape := BacktestMAPE(deret, deret[len(deret)-1].Tanggal)
        if mape == nil || *mape < 0 || *mape > 100 {
                t.Fatalf("MAPE jujur harus terhitung untuk 20 hari: %v", mape)
        }
        q := SusunKualitas(deret, deret[len(deret)-1].Tanggal)
        if q == nil || q.Winner != "statistical" || q.MapeProphet != nil {
                t.Fatalf("kualitas era Go murni: winner statistical, mape_prophet nil: %+v", q)
        }
        if SusunKualitas(deret[:5], deret[4].Tanggal) != nil {
                t.Error("data < 8 hari: kualitas nil (belum bisa di-backtest)")
        }
}
