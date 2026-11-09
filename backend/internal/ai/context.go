package ai

// Konteks DATA warung untuk prompt & validasi (port ml-service).
// Di Python ini dict bebas; di Go dipakai struct bertipe supaya
// kontrak antara retrieval SQL dan prompt terkunci saat kompilasi.

// PenjualanBlok: omzet + jumlah transaksi satu jendela waktu.
type PenjualanBlok struct {
	Omzet      int64 `json:"omzet"`
	Transaksi  int64 `json:"transaksi"`
}

// ProdukTopItem: produk terlaris 7 hari.
type ProdukTopItem struct {
	Nama  string `json:"nama"`
	Qty   int64  `json:"qty"`
	Omzet int64  `json:"omzet"`
}

// StokKritisItem: produk aktif di bawah stok minimum + saran restok.
type StokKritisItem struct {
	Nama        string   `json:"nama"`
	Stok        int64    `json:"stok"`
	MinStok     int64    `json:"min_stok"`
	SaranRestok int64    `json:"saran_restok"`
	KecepatanHari float64 `json:"kecepatan_hari"`
	HariHabis   *float64 `json:"hari_habis"`
}

// JamRamaiItem: jam belanja paling ramai 7 hari.
type JamRamaiItem struct {
	Jam       int64 `json:"jam"`
	Transaksi int64 `json:"transaksi"`
}

// PrediksiInfo: status model ramalan outlet.
type PrediksiInfo struct {
	Tersedia bool    `json:"tersedia"`
	Engine   string  `json:"engine"`
	Mape     *float64 `json:"mape"`
}

// MLProgress: kemajuan gerbang data model ramalan outlet.
type MLProgress struct {
	HariData         int64 `json:"hari_data"`
	HariPendapatan   int64 `json:"hari_pendapatan"`
	GerbangHari      int64 `json:"gerbang_hari"`
	GerbangPendapatan int64 `json:"gerbang_pendapatan"`
	GerbangTerpenuhi bool  `json:"gerbang_terpenuhi"`
}

// DataContext: seluruh DATA bisnis warung yang menyertai satu
// pertanyaan. Dibangun handler dari SQL baca-saja per permintaan —
// pemilik melihat OSCAR "membaca data terbaru" setiap saat tanpa
// perlu dilatih ulang.
type DataContext struct {
	Outlet              string           `json:"outlet"`
	Penjualan           map[string]PenjualanBlok `json:"penjualan"`
	PerubahanMingguanPct *float64        `json:"perubahan_mingguan_pct"`
	ProdukTop           []ProdukTopItem  `json:"produk_top"`
	StokKritis          []StokKritisItem `json:"stok_kritis"`
	JamRamai            []JamRamaiItem   `json:"jam_ramai"`
	Prediksi            PrediksiInfo     `json:"prediksi"`
	MLProgress          *MLProgress      `json:"ml_progress"`
}

// CollectAllowedNumbers: semua angka DATA yang boleh muncul di jawaban
// (+ jendela waktu 7/30 hari supaya frasa template tidak salah bunyi).
// Nilai bool DIBUANG — bukan angka data.
func CollectAllowedNumbers(ctx *DataContext) []float64 {
	nilai := []float64{7.0, 30.0}
	for _, blok := range ctx.Penjualan {
		nilai = append(nilai, float64(blok.Omzet), float64(blok.Transaksi))
	}
	for _, p := range ctx.ProdukTop {
		nilai = append(nilai, float64(p.Qty), float64(p.Omzet))
	}
	for _, s := range ctx.StokKritis {
		nilai = append(nilai, float64(s.Stok), float64(s.MinStok), float64(s.SaranRestok))
		if s.HariHabis != nil {
			nilai = append(nilai, *s.HariHabis)
		}
	}
	for _, j := range ctx.JamRamai {
		nilai = append(nilai, float64(j.Jam), float64(j.Transaksi))
	}
	if ctx.MLProgress != nil {
		nilai = append(nilai,
			float64(ctx.MLProgress.HariData),
			float64(ctx.MLProgress.HariPendapatan),
			float64(ctx.MLProgress.GerbangHari),
			float64(ctx.MLProgress.GerbangPendapatan))
	}
	if ctx.Prediksi.Mape != nil {
		nilai = append(nilai, *ctx.Prediksi.Mape)
	}
	if ctx.PerubahanMingguanPct != nil {
		nilai = append(nilai, *ctx.PerubahanMingguanPct)
	}
	return nilai
}
