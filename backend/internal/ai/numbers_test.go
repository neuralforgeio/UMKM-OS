package ai

// Unittest angka format Indonesia (port perilaku test_assistant.py /
// test_assistant_nlu.py era Python): parse, ekstraksi, validasi GRID,
// dan pemformatan.

import (
        "strings"
        "testing"
)

func TestParseNumberID(t *testing.T) {
        kasus := []struct {
                masuk string
                ingin float64
                ok    bool
        }{
                {"1.250.000", 1250000, true},
                {"12,5", 12.5, true},
                {"1.250.000,50", 1250000.5, true},
                {"1,250,000", 1250000, true},
                {"1.25", 1.25, true},
                {"100", 100, true},
                {"", 0, false},
                {"abc", 0, false},
        }
        for _, k := range kasus {
                dapat, ok := ParseNumberID(k.masuk)
                if ok != k.ok || (ok && dapat != k.ingin) {
                        t.Errorf("ParseNumberID(%q) = (%v, %v); ingin (%v, %v)",
                                k.masuk, dapat, ok, k.ingin, k.ok)
                }
        }
}

func TestExtractNumbers(t *testing.T) {
        dapat := ExtractNumbers("Omzet Rp 1.250.000 dari 5 transaksi, naik 12,5% — total 2 juta")
        // Yang dilaporkan: Rp 1.250.000 (rp), 5 (angka kecil ikut — hanya
        // TAHUN 1900-2100 yang dilewati, semantik ml-service), 12,5% (persen),
        // 2 juta (nilai besar).
        if len(dapat) != 4 {
                t.Fatalf("ExtractNumbers melaporkan %d angka; ingin 4: %+v", len(dapat), dapat)
        }
        if !dapat[0].Rp || dapat[0].Nilai != 1250000 {
                t.Errorf("angka pertama seharusnya Rp 1.250.000: %+v", dapat[0])
        }
        if dapat[1].Nilai != 5 {
                t.Errorf("angka kecil 5 ikut dilaporkan (semantik ml-service): %+v", dapat[1])
        }
        if !dapat[2].Persen || dapat[2].Nilai != 12.5 {
                t.Errorf("angka ketiga seharusnya 12,5%%: %+v", dapat[2])
        }
        if dapat[3].Nilai != 2000000 {
                t.Errorf("angka keempat seharusnya 2.000.000: %+v", dapat[3])
        }
}

func TestExtractNumbersLewatiTahun(t *testing.T) {
        dapat := ExtractNumbers("pada tahun 2026 warung berdiri")
        if len(dapat) != 0 {
                t.Errorf("tahun 2026 seharusnya dilewati, terlapor: %+v", dapat)
        }
}

func TestBisaDijelaskanPembulatanGrid(t *testing.T) {
        // Rp 1.250.000 sah untuk data 1.252.340 (GRID 250 ribu, selisih < 2,5%).
        if !bisaDijelaskan(1250000, 1252340) {
                t.Error("pembulatan GRID 1.250.000 untuk 1.252.340 harus dianggap jujur")
        }
        // Selisih 20% = karangan.
        if bisaDijelaskan(1500000, 1250000) {
                t.Error("selisih 20% tidak boleh lolos")
        }
}

func TestValidateNumbersPersenVsRp(t *testing.T) {
        allowed := []float64{25, 1250000}
        // Persentase hanya diadu dengan angka < 100 (stok/pct).
        sah, _ := ValidateNumbers("naik 25%", allowed)
        if !sah {
                t.Error("25% harus bisa dijelaskan oleh stok 25")
        }
        sah, _ = ValidateNumbers("naik 90%", allowed)
        if sah {
                t.Error("90% tidak punya pasangan DATA < 100 — harus mencurigakan")
        }
        // Uang hanya diadu dengan angka >= 100 supaya "Rp 25" tidak lolos
        // karena ada stok 25.
        sah, _ = ValidateNumbers("omzet Rp 25", allowed)
        if sah {
                t.Error("Rp 25 tidak boleh lolos karena stok 25")
        }
        sah, _ = ValidateNumbers("omzet Rp 1.250.000", allowed)
        if !sah {
                t.Error("Rp 1.250.000 harus sah")
        }
}

func TestValidateNumbersRetryInstruction(t *testing.T) {
        sah, pelanggar := ValidateNumbers("omzet Rp 9.999.999", []float64{1250000})
        if sah || len(pelanggar) != 1 || pelanggar[0] != 9999999 {
                t.Fatalf("angka karangan harus dilaporkan: sah=%v pelanggar=%v", sah, pelanggar)
        }
        instruksi := BuildRetryInstruction(pelanggar)
        if !strings.Contains(instruksi, "Rp 9.999.999") ||
                !strings.Contains(instruksi, "TIDAK ada di DATA") {
                t.Errorf("instruksi retry harus menyebut angka pelanggar: %q", instruksi)
        }
}

func TestFormatRupiahIDDanPersen(t *testing.T) {
        if FormatRupiahID(1250000) != "1.250.000" {
                t.Errorf("FormatRupiahID(1250000) = %q", FormatRupiahID(1250000))
        }
        if FormatRupiahID(-500) != "-500" {
                t.Errorf("FormatRupiahID(-500) = %q", FormatRupiahID(-500))
        }
        if FormatPersenID(12.5) != "12,5" {
                t.Errorf("FormatPersenID(12.5) = %q", FormatPersenID(12.5))
        }
}

func TestCollectAllowedNumbers(t *testing.T) {
        hh := 3.5
        pct := 12.5
        mape := 8.4
        ctx := &DataContext{
                Outlet: "Warung Uji",
                Penjualan: map[string]PenjualanBlok{
                        "hari_ini": {Omzet: 125000, Transaksi: 5},
                },
                PerubahanMingguanPct: &pct,
                ProdukTop:            []ProdukTopItem{{Nama: "Kopi", Qty: 12, Omzet: 60000}},
                StokKritis:           []StokKritisItem{{Nama: "Gula", Stok: 2, MinStok: 5, SaranRestok: 8, HariHabis: &hh}},
                JamRamai:             []JamRamaiItem{{Jam: 13, Transaksi: 9}},
                Prediksi:             PrediksiInfo{Tersedia: true, Engine: "statistical", Mape: &mape},
                MLProgress:           &MLProgress{HariData: 10, HariPendapatan: 8, GerbangHari: 28, GerbangPendapatan: 14},
        }
        nilai := CollectAllowedNumbers(ctx)
        ada := func(v float64) bool {
                for _, n := range nilai {
                        if n == v {
                                return true
                        }
                }
                return false
        }
        for _, v := range []float64{7, 30, 125000, 5, 12, 60000, 2, 5, 8, 3.5, 13, 9, 12.5, 8.4, 28, 14} {
                if !ada(v) {
                        t.Errorf("angka DATA %v seharusnya ikut diizinkan", v)
                }
        }
}
