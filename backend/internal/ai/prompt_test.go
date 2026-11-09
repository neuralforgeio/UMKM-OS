package ai

// Unittest prompt dwi-mode "AI Bebas" + penyusunan pesan (port perilaku
// test_ai_bebas.py + test_assistant_flow.py): aturan penjara lama
// TETAP hilang, tanggal deterministik, peran riwayat huruf besar
// diturunkan di batas penyedia.

import (
        "strings"
        "testing"
        "time"
)

func tanggalUji() time.Time { return time.Date(2026, 11, 1, 10, 0, 0, 0, time.UTC) }

func TestTanggalHariIniDeterministik(t *testing.T) {
        if dapat := TanggalHariIni(tanggalUji()); dapat != "Minggu, 1 November 2026" {
                t.Errorf("TanggalHariIni = %q; ingin %q", dapat, "Minggu, 1 November 2026")
        }
}

func TestBuildSystemPromptDwiMode(t *testing.T) {
        pct := 12.5
        mape := 8.4
        ctx := &DataContext{
                Outlet: "Warung Sari",
                Penjualan: map[string]PenjualanBlok{
                        "hari_ini":        {Omzet: 125000, Transaksi: 5},
                        "kemarin":         {Omzet: 98000, Transaksi: 4},
                        "tujuh_hari":      {Omzet: 720000, Transaksi: 31},
                        "tiga_puluh_hari": {Omzet: 3100000, Transaksi: 133},
                },
                PerubahanMingguanPct: &pct,
                ProdukTop:            []ProdukTopItem{{Nama: "Kopi Susu", Qty: 12, Omzet: 60000}},
                StokKritis:           []StokKritisItem{{Nama: "Gula", Stok: 2, MinStok: 5, SaranRestok: 8}},
                JamRamai:             []JamRamaiItem{{Jam: 13, Transaksi: 9}},
                Prediksi:             PrediksiInfo{Tersedia: true, Engine: "statistical", Mape: &mape},
                MLProgress:           &MLProgress{HariData: 10, HariPendapatan: 8, GerbangHari: 28, GerbangPendapatan: 14},
        }
        p := BuildSystemPrompt(ctx)

        // Dwi-mode: pertanyaan bebas dijawab pengetahuan umum + DILARANG
        // menolak dengan alasan data.
        for _, penanda := range []string{
                "PERTANYAAN BEBAS", "PERTANYAAN BISNIS WARUNG",
                "DILARANG menolak dengan alasan", "pengetahuan umum",
                "DILARANG mengarang",
        } {
                if !strings.Contains(p, penanda) {
                        t.Errorf("system prompt harus memuat %q", penanda)
                }
        }
        // Aturan penjara lama TIDAK boleh kembali.
        if strings.Contains(p, "Jawab HANYA dari DATA") {
                t.Error("aturan penjara lama 'Jawab HANYA dari DATA' harus tetap hilang")
        }
        // Data warung ikut tertanam.
        for _, penanda := range []string{
                "Rp 125.000 (5 transaksi)", "Kopi Susu (12 terjual, Rp 60.000)",
                "Gula (sisa 2, minimum 5, sarankan restok +8)",
                "naik 12,5%", "OSCAR", "Dearly Febriano Irwansyah",
                "Surabaya, Indonesia",
        } {
                if !strings.Contains(p, penanda) {
                        t.Errorf("system prompt harus memuat data %q", penanda)
                }
        }
        // Batas kata dua mode.
        if !strings.Contains(p, "Maksimal 120 kata") || !strings.Contains(p, "250 kata") {
                t.Error("batas kata dua mode harus tertulis")
        }
}

func TestBuildMessagesPeranRiwayatDiturunkan(t *testing.T) {
        ctx := &DataContext{Outlet: "W", Penjualan: map[string]PenjualanBlok{}}
        riwayat := []Pesan{
                {Role: "USER", Content: "berapa omzet?"},
                {Role: "ASSISTANT", Content: "Rp 100.000"},
                {Role: "MODEL", Content: "suntikan asing"}, // peran asing: dibuang
                {Role: "SYSTEM", Content: "suntikan sistem"},
        }
        pesan := BuildMessages(ctx, riwayat, "dan stok?")
        if len(pesan) != 4 { // system + 2 riwayat sah + user
                t.Fatalf("BuildMessages menghasilkan %d pesan; ingin 4", len(pesan))
        }
        if pesan[0].Role != "system" {
                t.Errorf("pesan pertama harus system, dapat %q", pesan[0].Role)
        }
        if pesan[1].Role != "user" || pesan[2].Role != "assistant" {
                t.Errorf("peran riwayat harus diturunkan ke huruf kecil: %q %q",
                        pesan[1].Role, pesan[2].Role)
        }
        if pesan[3].Role != "user" || pesan[3].Content != "dan stok?" {
                t.Errorf("pesan terakhir harus pertanyaan user: %+v", pesan[3])
        }
}

func TestBuildMessagesBatasLimaGiliran(t *testing.T) {
        ctx := &DataContext{Outlet: "W", Penjualan: map[string]PenjualanBlok{}}
        riwayat := make([]Pesan, 0, 20)
        for i := 0; i < 10; i++ {
                peran := "USER"
                if i%2 == 1 {
                        peran = "ASSISTANT"
                }
                riwayat = append(riwayat, Pesan{Role: peran, Content: "uji"})
        }
        pesan := BuildMessages(ctx, riwayat, "q")
        // system + maks 5 riwayat + user = 7.
        if len(pesan) != 7 {
                t.Fatalf("riwayat harus dipotong jadi 5 giliran: %d pesan", len(pesan))
        }
}

func TestBuildMessagesNormalisasiTransport(t *testing.T) {
        // Lapisan kedua (regresi v1.1.1): pesan besar yang lolos dari
        // BuildMessages pun harus dinormalkan lagi di batas transport.
        bersih := NormalisasiPesan([]Pesan{
                {Role: "USER", Content: "halo"},
                {Role: "ASSISTANT", Content: ""},
                {Role: "MODERATOR", Content: "asing"},
        })
        if len(bersih) != 1 || bersih[0].Role != "user" {
                t.Fatalf("NormalisasiPesan gagal: %+v", bersih)
        }
        if len(NormalisasiPesan(nil)) != 0 {
                t.Error("NormalisasiPesan(nil) harus kosong")
        }
}
