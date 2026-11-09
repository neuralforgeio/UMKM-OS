package ai

// Unittest era Go murni — klasifikasi maksud "AI Bebas" (port perilaku
// test_ai_bebas.py): pertanyaan bebas TIDAK lagi dipenjara jadi saran
// data; sapaan singkat ber-spasi pengaman tidak menelan kata lain.

import (
        "os"
        "path/filepath"
        "testing"
)

func TestNormalizeText(t *testing.T) {
        kasus := map[string]string{
                "Nama mu siapa??":        "nama kamu siapa",
                "omzet gmn?":             "omzet gimana",
                "saran minggu dpn dong":  "saran minggu depan dong",
                "brp omzet hari ini":     "berapa omzet hari ini",
                "Terima kasih ya!":       "terima kasih ya",
                "yg udh habis":           "yang sudah habis",
        }
        for masuk, ingin := range kasus {
                if dapat := NormalizeText(masuk); dapat != ingin {
                        t.Errorf("NormalizeText(%q) = %q; ingin %q", masuk, dapat, ingin)
                }
        }
}

func TestClassifyIntentPertanyaanBebas(t *testing.T) {
        // Keluhan pemilik lama: model bebas menolak hitungan mudah.
        kasus := map[string]string{
                "berapa satu tambah satu":   "umum",
                "5 tambah 5":                "umum",
                "apa ibu kota Indonesia":    "umum",
                "berapa harga laptop":       "umum", // "top" polos dulu menelan LAPTOP
                "hitung diskon 20% dari 50 ribu": "umum", // "hi" polos dulu menelan HITUNG
                "resep ayam geprek":         "umum",
        }
        for q, ingin := range kasus {
                if dapat := ClassifyIntent(q); dapat != ingin {
                        t.Errorf("ClassifyIntent(%q) = %q; ingin %q", q, dapat, ingin)
                }
        }
}

func TestClassifyIntentBisnisWarung(t *testing.T) {
        kasus := map[string]string{
                "berapa omzet hari ini":      "penjualan",
                "halo, omzet berapa?":        "penjualan", // data menang atas basa-basi
                "omzet minggu ini":           "penjualan",
                "berapa omzet besok":         "prediksi",  // penanda masa depan
                "ramalan minggu depan":       "prediksi",
                "stok apa yang menipis":      "stok",
                "produk paling laku apa":     "produk",
                "saran minggu depan dong":    "saran_tindakan",
                "jam paling ramai kapan":     "jam_ramai",
                "siapa kamu":                 "identitas",
                "siapa penciptamu":           "pencipta",
                "kamu bisa apa":              "kemampuan",
                "apa saja yang bisa":         "kemampuan",
                "halo":                       "sapaan",
                "p":                          "sapaan",
                "terima kasih":               "terima_kasih",
                "wkwk lucu":                  "obrolan",
        }
        for q, ingin := range kasus {
                if dapat := ClassifyIntent(q); dapat != ingin {
                        t.Errorf("ClassifyIntent(%q) = %q; ingin %q", q, dapat, ingin)
                }
        }
}

func TestClassifyIntentSapaanTidakMenelanKataLain(t *testing.T) {
        // Bug lama: keyword "p"/"hi" polos menelan semua frasa ber-huruf-p
        // dan kata HITUNG — "berapa satu tambah satu" malah dianggap sapaan.
        for _, q := range []string{"berapa saja menunya", "hitung total belanja"} {
                if dapat := ClassifyIntent(q); dapat == "sapaan" {
                        t.Errorf("ClassifyIntent(%q) salah dianggap sapaan", q)
                }
        }
}

func TestMaxudBerdataHanyaBisnis(t *testing.T) {
        for _, m := range []string{"penjualan", "stok", "produk", "prediksi", "saran_tindakan", "jam_ramai"} {
                if !MaxudBerdata[m] {
                        t.Errorf("maksud bisnis %q harus masuk MaxudBerdata", m)
                }
        }
        for _, m := range []string{"umum", "sapaan", "identitas", "kemampuan", "obrolan", "terima_kasih", "pencipta"} {
                if MaxudBerdata[m] {
                        t.Errorf("maksud bebas %q TIDAK boleh divalidasi angka", m)
                }
        }
}

func TestExtractPeriod(t *testing.T) {
        kasus := map[string]string{
                "omzet hari ini":   "hari",
                "omzet kemarin":    "hari",
                "omzet minggu ini": "minggu",
                "omzet 7 hari":     "minggu",
                "omzet bulan ini":  "bulan",
                "omzet":            "hari",
        }
        for q, ingin := range kasus {
                if dapat := ExtractPeriod(q); dapat != ingin {
                        t.Errorf("ExtractPeriod(%q) = %q; ingin %q", q, dapat, ingin)
                }
        }
}

func TestDevLaporanButuhPINSah(t *testing.T) {
        dir := t.TempDir()
        tulisFile(t, filepath.Join(dir, "dev_config.json"),
                `{"enabled": true, "pin": "1234"}`)
        lama := Dev
        Dev = NewDevReportStore(dir)
        defer func() { Dev = lama }()

        if ClassifyIntent("mode developer 1234 laporan lintas toko") != "dev_laporan" {
                t.Error("pesan ber-PIN sah harus dienali sebagai dev_laporan")
        }
        if ClassifyIntent("mode developer PIN-SALAH laporan") == "dev_laporan" {
                t.Error("pesan ber-PIN salah tidak boleh dianggap dev_laporan")
        }
        if ClassifyIntent("laporan penjualan minggu ini") == "dev_laporan" {
                t.Error("pertanyaan owner biasa tidak boleh jadi dev_laporan")
        }
}

func tulisFile(t *testing.T, path, isi string) {
        t.Helper()
        if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
                t.Fatal(err)
        }
        if err := os.WriteFile(path, []byte(isi), 0o644); err != nil {
                t.Fatal(err)
        }
}
