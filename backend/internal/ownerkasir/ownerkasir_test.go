package ownerkasir

// TES OWNER+KASIR v2.5.0 (run-14): 30 fitur owner + 10 fitur kasir,
// logika bisnis murni (BasketSize, split bill, FEFO, rekonsiliasi
// laci, dsb.). Setiap fitur punya kasus normal + tepi.

import (
	"strings"
	"testing"
	"time"
)

var kini = time.Date(2026, 11, 20, 12, 0, 0, 0, time.UTC)

// ==== KASIR ====

func TestParkirSimpanAmbil(t *testing.T) {
	daftar := []Parkir{{ID: "p1", Nama: "Bu Sari", Items: []ItemKeranjang{{ProdukID: 1, Nama: "kopi", Qty: 2, Harga: 5000}}}}
	// timpa ID sama
	baru := Parkir{ID: "p1", Nama: "Bu Sari", Items: []ItemKeranjang{{ProdukID: 2, Nama: "teh", Qty: 1, Harga: 4000}}}
	daftar = ParkirSimpan(daftar, baru)
	if len(daftar) != 1 || daftar[0].Items[0].Nama != "teh" {
		t.Fatalf("timpa parkir salah: %+v", daftar)
	}
	// tambah baru
	daftar = ParkirSimpan(daftar, Parkir{ID: "p2", Nama: "Pak Budi"})
	if len(daftar) != 2 {
		t.Fatalf("tambah parkir salah: %d", len(daftar))
	}
	// ambil
	p, sisa, ok := ParkirAmbil(daftar, "p1")
	if !ok || p.Nama != "Bu Sari" || len(sisa) != 1 || sisa[0].ID != "p2" {
		t.Fatalf("ambil parkir salah: %+v sisa=%v", p, sisa)
	}
	if _, _, ok := ParkirAmbil(sisa, "tidak-ada"); ok {
		t.Fatal("parkir tak ditemukan seharusnya false")
	}
}

func TestSplitBill(t *testing.T) {
	bagi, err := SplitBill(10000, 3)
	if err != nil {
		t.Fatal(err)
	}
	var total int64
	for _, v := range bagi {
		total += v
	}
	if total != 10000 {
		t.Fatalf("total bagi %d != 10000", total)
	}
	// selisih antar bagian maks 1
	min, max := bagi[0], bagi[0]
	for _, v := range bagi {
		if v < min {
			min = v
		}
		if v > max {
			max = v
		}
	}
	if max-min > 1 {
		t.Fatalf("sebar tidak rata: %v", bagi)
	}
	if _, err := SplitBill(1000, 0); err == nil {
		t.Fatal("bagi 0 seharusnya galat")
	}
	if _, err := SplitBill(-5, 2); err == nil {
		t.Fatal("negatif seharusnya galat")
	}
}

func TestValidasiDiskonManual(t *testing.T) {
	if err := ValidasiDiskonManual(10, 0, 50000); err != nil {
		t.Fatalf("persen valid ditolak: %v", err)
	}
	if err := ValidasiDiskonManual(0, 3000, 50000); err != nil {
		t.Fatalf("nominal valid ditolak: %v", err)
	}
	if err := ValidasiDiskonManual(101, 0, 50000); err == nil {
		t.Fatal("persen > 100 seharusnya galat")
	}
	if err := ValidasiDiskonManual(0, 60000, 50000); err == nil {
		t.Fatal("nominal > total seharusnya galat")
	}
	if err := ValidasiDiskonManual(10, 1000, 50000); err == nil {
		t.Fatal("persen+nominal sekaligus seharusnya galat")
	}
	if HitungDiskon(10, 0, 50000) != 5000 {
		t.Fatal("hitung persen salah")
	}
	if HitungDiskon(0, 2500, 50000) != 2500 {
		t.Fatal("hitung nominal salah")
	}
}

func TestPembayaranCampur(t *testing.T) {
	p := PembayaranCampur{Tunai: 20000, QRIS: 30000, Kartu: 10000}
	if p.TotalCampur() != 60000 {
		t.Fatalf("total campur salah: %d", p.TotalCampur())
	}
	if k := KembalianCampur(p, 55000); k != 5000 {
		t.Fatalf("kembalian salah: %d", k)
	}
	if k := KembalianCampur(p, 70000); k >= 0 {
		t.Fatal("kurang bayar seharusnya negatif")
	}
}

func TestSalinanTeksStruk(t *testing.T) {
	tek := SalinanTeksStruk("Warung Barokah", []ItemKeranjang{
		{Nama: "kopi", Qty: 2, Harga: 5000, Catatan: "tanpa gula"},
		{Nama: "roti", Qty: 1, Harga: 3000},
	}, 13000)
	for wajib := range map[string]struct{}{
		"Warung Barokah": {}, "2x kopi @5000": {}, "catatan: tanpa gula": {},
		"TOTAL Rp 13000": {}, "Terima kasih!": {},
	} {
		if !strings.Contains(tek, wajib) {
			t.Fatalf("struk kehilangan %q:\n%s", wajib, tek)
		}
	}
}

func TestValidasiAlasanVoidRefund(t *testing.T) {
	if err := ValidasiAlasanVoidRefund("pesanan salah"); err != nil {
		t.Fatal(err)
	}
	if err := ValidasiAlasanVoidRefund("   "); err == nil {
		t.Fatal("alasan kosong seharusnya galat")
	}
	if err := ValidasiAlasanVoidRefund(strings.Repeat("a", 121)); err == nil {
		t.Fatal("alasan > 120 rune seharusnya galat")
	}
	if err := ValidasiAlasanVoidRefund(strings.Repeat("é", 100)); err != nil {
		t.Fatalf("non-ascii 100 rune seharusnya lolos: %v", err)
	}
}

func TestQuickKeys(t *testing.T) {
	k := SusunQuickKeys([]QuickKeyKandidat{
		{ProdukID: 1, Nama: "kopi", Frekuensi: 100, akhirJual: kini.Add(-24 * time.Hour)},
		{ProdukID: 2, Nama: "teh", Frekuensi: 90, akhirJual: kini},
		{ProdukID: 3, Nama: "susu", Frekuensi: 95, akhirJual: kini.Add(-7 * 24 * time.Hour)},
	}, kini, 2)
	if len(k) != 2 {
		t.Fatalf("quick keys n: %d", len(k))
	}
	if k[0].Nama != "teh" {
		t.Fatalf("teh (recency segar) seharusnya #1: %+v", k)
	}
	if SkorQuickKey(0, kini, kini) != 0 {
		t.Fatal("frekuensi 0 seharusnya skor 0")
	}
	if SkorQuickKey(10, kini, kini) <= SkorQuickKey(10, kini.Add(-30*24*time.Hour), kini) {
		t.Fatal("recency baru seharusnya menang")
	}
}

func TestCariProdukBarcode(t *testing.T) {
	daftar := []ProdukRef{
		{ID: 1, Nama: "kopi", Barcode: "8991001234567", Harga: 5000},
		{ID: 2, Nama: "teh", Barcode: "8991007654321", Harga: 3000},
	}
	p, ok := CariProdukBarcode(daftar, "8991001234567")
	if !ok || p.Nama != "kopi" {
		t.Fatalf("lookup barcode salah: %+v", p)
	}
	if _, ok := CariProdukBarcode(daftar, "xxx"); ok {
		t.Fatal("barcode tak dikenal seharusnya false")
	}
}

func TestValidasiKeranjangTotal(t *testing.T) {
	stok := map[int64]int{1: 10, 2: 1}
	items := []ItemKeranjang{{ProdukID: 1, Qty: 2, Harga: 5000}, {ProdukID: 2, Qty: 1, Harga: 4000}}
	if err := ValidasiKeranjang(items, stok); err != nil {
		t.Fatalf("keranjang valid ditolak: %v", err)
	}
	if TotalKeranjang(items) != 14000 {
		t.Fatalf("total salah: %d", TotalKeranjang(items))
	}
	bad := []ItemKeranjang{{ProdukID: 2, Qty: 2, Harga: 4000}}
	if err := ValidasiKeranjang(bad, stok); err == nil {
		t.Fatal("stok kurang seharusnya galat")
	}
	if err := ValidasiKeranjang([]ItemKeranjang{{ProdukID: 1, Qty: 0, Harga: 1}}, stok); err == nil {
		t.Fatal("qty 0 seharusnya galat")
	}
	if err := ValidasiKeranjang([]ItemKeranjang{{ProdukID: 1, Qty: 1, Harga: -1}}, stok); err == nil {
		t.Fatal("harga negatif seharusnya galat")
	}
}

// ==== OWNER ====

func TestBasketSizeBandingPeriod(t *testing.T) {
	if b := BasketSize(500000, 50); b != 10000 {
		t.Fatalf("basket size salah: %v", b)
	}
	if b := BasketSize(500000, 0); b != 0 {
		t.Fatal("transaksi 0 seharusnya 0 (bukan divide by zero)")
	}
	if d := BandingPeriod(600000, 500000); d < 19.9 || d > 20.1 {
		t.Fatalf("naik persen salah: %v", d)
	}
	if d := BandingPeriod(100, 0); d != 0 {
		t.Fatal("periode lalu 0 seharusnya 0")
	}
	if d := BandingPeriod(400000, 500000); d != -20 {
		t.Fatalf("turun persen salah: %v", d)
	}
}

func TestMargin(t *testing.T) {
	if m := MarginPerProduk(10000, 7000); m != 3000 {
		t.Fatalf("margin rupiah salah: %d", m)
	}
	if p := MarginPersen(10000, 7000); p < 29.9 || p > 30.1 {
		t.Fatalf("margin persen salah: %v", p)
	}
	if p := MarginPersen(0, 0); p != 0 {
		t.Fatal("harga 0 seharusnya 0")
	}
	if p := MarginPersen(5000, 5000); p != 0 {
		t.Fatal("margin 0 seharusnya 0")
	}
}

func TestSellThroughDeadStock(t *testing.T) {
	if s := SellThroughRate(70, 100); s < 69.9 || s > 70.1 {
		t.Fatalf("sell through salah: %v", s)
	}
	if s := SellThroughRate(10, 0); s != 0 {
		t.Fatal("diterima 0 seharusnya 0")
	}
	daftar := []ProdukJual{
		{ProdukID: 1, Nama: "kopi", Stok: 5, TerakhirJual: kini.Add(-3 * 24 * time.Hour)},
		{ProdukID: 2, Nama: "kerupuk", Stok: 10, TerakhirJual: kini.Add(-60 * 24 * time.Hour)},
		{ProdukID: 3, Nama: "susu", Stok: 2, TerakhirJual: time.Time{}},
		{ProdukID: 4, Nama: "teh-habis", Stok: 0, TerakhirJual: kini.Add(-90 * 24 * time.Hour)},
	}
	dead := DeadStock(daftar, 30, kini)
	if len(dead) != 2 {
		t.Fatalf("dead stock seharusnya 2: %+v", dead)
	}
	if dead[0].Nama != "kerupuk" || dead[1].Nama != "susu" {
		t.Fatalf("dead stock salah: %+v", dead)
	}
}

func TestPerluRestok(t *testing.T) {
	daftar := []ProdukJual{
		{ProdukID: 1, Stok: 3}, {ProdukID: 2, Stok: 10}, {ProdukID: 3, Stok: 5},
	}
	minimum := map[int64]int{1: 5, 3: 5}
	got := PerluRestok(daftar, minimum)
	if len(got) != 2 || got[0].ProdukID != 1 || got[1].ProdukID != 3 {
		t.Fatalf("restok salah: %+v", got)
	}
}

func TestLabaKotor(t *testing.T) {
	if l := LabaKotor(1000000, 600000, 50000); l != 350000 {
		t.Fatalf("laba kotor salah: %d", l)
	}
}

func TestRekonsiliasiLaci(t *testing.T) {
	r := Rekonsiliasi{SaldoAwal: 50000, Tunai: 400000, RefundTunai: 20000, KasKeluar: 30000, KasMasuk: 10000}
	exp := r.ExpectedCash()
	if exp != 410000 {
		t.Fatalf("expected cash salah: %d", exp)
	}
	if s := SelisihLaci(r, 405000); s != -5000 {
		t.Fatalf("selisih laci salah: %d", s)
	}
}

func TestValidasiKasKeluar(t *testing.T) {
	if err := ValidasiKasKeluar(20000, "bensin", "antar barang"); err != nil {
		t.Fatalf("valid ditolak: %v", err)
	}
	if err := ValidasiKasKeluar(0, "x", "y"); err == nil {
		t.Fatal("nominal 0 seharusnya galat")
	}
	if err := ValidasiKasKeluar(1000, "", "y"); err == nil {
		t.Fatal("kategori kosong seharusnya galat")
	}
	if err := ValidasiKasKeluar(1000, "x", " "); err == nil {
		t.Fatal("alasan kosong seharusnya galat")
	}
}

func TestOpname(t *testing.T) {
	baris := []OpnameBaris{
		{ProdukID: 1, Fisik: 10, Sistem: 10},
		{ProdukID: 2, Fisik: 8, Sistem: 10},
		{ProdukID: 3, Fisik: 12, Sistem: 10},
	}
	if s := SelisihOpname(baris[1]); s != -2 {
		t.Fatalf("selisih opname salah: %d", s)
	}
	ada, total := RingkasOpname(baris)
	if ada != 2 || total != 0 {
		t.Fatalf("ringkas opname salah: %d %d", ada, total)
	}
}

func TestFefoBatch(t *testing.T) {
	batches := []BatchStok{
		{ProdukID: 1, Exp: kini.Add(100 * 24 * time.Hour), Qty: 5},
		{ProdukID: 1, Exp: kini.Add(5 * 24 * time.Hour), Qty: 3},
		{ProdukID: 1, Exp: kini.Add(40 * 24 * time.Hour), Qty: 2},
	}
	urut := UrutFEFO(batches)
	if urut[0].Qty != 3 || urut[1].Qty != 2 || urut[2].Qty != 5 {
		t.Fatalf("FEFO salah: %+v", urut)
	}
	segera := BatchSegeraExp(batches, 7, kini)
	if len(segera) != 1 || segera[0].Qty != 3 {
		t.Fatalf("batch segera exp salah: %+v", segera)
	}
	// batch exp kemarin tidak ikut (sudah lewat, bukan mendekati)
	lewat := []BatchStok{{Exp: kini.Add(-24 * time.Hour), Qty: 1}}
	if len(BatchSegeraExp(lewat, 7, kini)) != 0 {
		t.Fatal("batch sudah exp tidak masuk segera")
	}
}

func TestPoinLoyalty(t *testing.T) {
	if p := PoinDariBelanja(125000, 25000); p != 5 {
		t.Fatalf("poin salah: %d", p)
	}
	if p := PoinDariBelanja(10000, 0); p != 0 {
		t.Fatal("rupiah per poin 0 seharusnya 0")
	}
	if d := DiskonDariPoin(5, 1000); d != 5000 {
		t.Fatalf("diskon poin salah: %d", d)
	}
}

func TestKlasifikasiPelanggan(t *testing.T) {
	if k := KlasifikasiPelanggan(3); k != "aktif" {
		t.Fatal("3 hari seharusnya aktif")
	}
	if k := KlasifikasiPelanggan(14); k != "sedang" {
		t.Fatal("14 hari seharusnya sedang")
	}
	if k := KlasifikasiPelanggan(60); k != "hilang" {
		t.Fatal("60 hari seharusnya hilang")
	}
}

func TestTargetPersen(t *testing.T) {
	tr := TargetRealisasi{Target: 1000000, Realisasi: 750000}
	if p := tr.PersenTarget(); p != 75 {
		t.Fatalf("persen target salah: %v", p)
	}
	if p := (TargetRealisasi{Target: 0}).PersenTarget(); p != 0 {
		t.Fatal("target 0 seharusnya 0")
	}
}

func TestJamRamai(t *testing.T) {
	daftar := []JamOmzet{{Jam: 8, Omzet: 100000}, {Jam: 12, Omzet: 500000}, {Jam: 19, Omzet: 300000}}
	jam, omzet := JamRamaiLaporan(daftar)
	if jam != 12 || omzet != 500000 {
		t.Fatalf("jam ramai salah: %d %d", jam, omzet)
	}
	if jam, _ := JamRamaiLaporan(nil); jam != -1 {
		t.Fatal("kosong seharusnya -1")
	}
}

func TestRekapMetodeBayar(t *testing.T) {
	items := []MetodeItem{
		{Metode: "TUNAI", Nominal: 100000},
		{Metode: "QRIS", Nominal: 250000},
		{Metode: "KARTU", Nominal: 50000},
		{Metode: "TUNAI", Nominal: 50000},
	}
	tunai, non := RekapMetodeBayar(items)
	if tunai != 150000 || non != 300000 {
		t.Fatalf("rekap metode salah: %d %d", tunai, non)
	}
}

func TestRankingTerlaris(t *testing.T) {
	daftar := []ItemTerjual{
		{ProdukID: 1, Nama: "kopi", Qty: 50},
		{ProdukID: 2, Nama: "teh", Qty: 80},
		{ProdukID: 3, Nama: "susu", Qty: 30},
	}
	top := RankingTerlaris(daftar, 2)
	if len(top) != 2 || top[0].Nama != "teh" || top[1].Nama != "kopi" {
		t.Fatalf("ranking salah: %+v", top)
	}
	if len(RankingTerlaris(daftar, 99)) != 3 {
		t.Fatal("n melebihi panjang = semua")
	}
}

func TestCashDropTransferTopAksi(t *testing.T) {
	if !SaranCashDrop(1000000, 800000) {
		t.Fatal("laci melebihi ambang seharusnya drop")
	}
	if SaranCashDrop(500000, 800000) {
		t.Fatal("laci di bawah ambang tidak drop")
	}
	tr := TransferStok{Asal: "pusat", Tujuan: "cabang", Diminta: 10, Diterima: 4}
	if tr.Status() != "SEBAGIAN" {
		t.Fatalf("status transfer salah: %s", tr.Status())
	}
	if (TransferStok{Diminta: 10, Diterima: 10}).Status() != "LENGKAP" {
		t.Fatal("lengkap salah")
	}
	if (TransferStok{Diminta: 10, Diterima: 0}).Status() != "BELUM" {
		t.Fatal("belum salah")
	}
	if (TransferStok{Diminta: 10, Diterima: 12}).Status() != "LEBIH" {
		t.Fatal("lebih salah")
	}
	top := TopAksi([]string{"LOGIN", "REFUND", "LOGIN", "LOGIN", "VOID"}, 2)
	if len(top) != 2 || top[0].Aksi != "LOGIN" || top[0].Jumlah != 3 {
		t.Fatalf("top aksi salah: %+v", top)
	}
	if RingkasHarian(500000, 25) != 20000 {
		t.Fatal("ringkas harian salah")
	}
}
