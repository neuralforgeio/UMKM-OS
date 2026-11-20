package shell

// TES FITUR 6 UMKM2Shell: KENDALI & PREDIKSI SERVER (server_test.go)
// — permintaan pemilik: matikan server, indikasi down, prediksi down;
// WAJIB unit testing. Semua fungsi murni diuji tanpa OS.

import (
	"context"
	"strings"
	"testing"
	"time"
)

func TestMatikanServerSekaliSaja(t *testing.T) {
	// bersihkan antrian dulu
	for len(Matikan) > 0 {
		<-Matikan
	}
	if !MatikanServer() {
		t.Fatal("permintaan mati pertama seharusnya diterima")
	}
	if StatusMatikan() != true {
		t.Fatal("status mati seharusnya menyala setelah permintaan")
	}
	// klik kedua DITOLAK (idempoten — jangan dobel shutdown)
	if MatikanServer() {
		t.Fatal("permintaan mati kedua seharusnya ditolak")
	}
	// konsumsi supaya tes lain tidak terganggu
	<-Matikan
	if StatusMatikan() {
		t.Fatal("status mati seharusnya padam setelah dikonsumsi")
	}
}

func TestParseStatHTTP(t *testing.T) {
	csv := `timestamp,level,ip,user_id,user_name,method,path,status,duration_ms,message
2026-11-20 09:00:01,HTTP,::1,2,Developer,POST,/api/v1/shell/cmd,200,1.5,x
2026-11-20 09:00:02,HTTP,::1,2,Developer,GET,/health,200,0.3,x
2026-11-20 09:00:03,HTTP,::1,2,Developer,GET,/api/v1/produk,500,9.9,boom
2026-11-20 09:00:04,INFO,-,0,-,-,-,-,-,bukan http
2026-11-20 09:00:05,HTTP,::1,1,Owner,GET,/x,502,3.2,bad gateway`
	daftar := parseStatHTTP(strings.NewReader(csv))
	if len(daftar) != 4 {
		t.Fatalf("harusnya 4 baris HTTP (baris INFO dibuang), dapat %d", len(daftar))
	}
	if daftar[0].Status != 200 || daftar[0].DurasiMS != 1.5 {
		t.Fatalf("baris pertama salah: %+v", daftar[0])
	}
	if daftar[2].Status != 500 {
		t.Fatalf("baris 500 hilang: %+v", daftar[2])
	}
	if !daftar[0].Waktu.Equal(time.Date(2026, 11, 20, 9, 0, 1, 0, time.UTC)) {
		t.Fatalf("waktu tidak terparse: %v", daftar[0].Waktu)
	}
}

func TestPersentil(t *testing.T) {
	// 1..100: p95 harus 95
	v := make([]float64, 100)
	for i := range v {
		v[i] = float64(i + 1)
	}
	if p := persentil(v, 95); p != 95 {
		t.Fatalf("p95 salah: %v", p)
	}
	if p := persentil(nil, 95); p != 0 {
		t.Fatal("persentil kosong seharusnya 0")
	}
	if p := persentil([]float64{7}, 95); p != 7 {
		t.Fatalf("satu elemen: %v", p)
	}
}

func TestKemiringanRegresi(t *testing.T) {
	// y = 2x + 1 -> slope 2 persis
	x := []float64{0, 1, 2, 3, 4}
	y := []float64{1, 3, 5, 7, 9}
	if k := kemiringan(x, y); k != 2 {
		t.Fatalf("slope seharusnya 2: %v", k)
	}
	// datar -> 0
	if k := kemiringan(x, []float64{5, 5, 5, 5, 5}); k != 0 {
		t.Fatalf("slope datar seharusnya 0: %v", k)
	}
	// turun -> negatif
	if k := kemiringan(x, []float64{9, 7, 5, 3, 1}); k != -2 {
		t.Fatalf("slope turun seharusnya -2: %v", k)
	}
	// input invalid -> 0
	if k := kemiringan([]float64{1}, []float64{1}); k != 0 {
		t.Fatal("slope satu titik seharusnya 0")
	}
	if k := kemiringan(nil, nil); k != 0 {
		t.Fatal("slope kosong seharusnya 0")
	}
}

func TestVerdictKesehatan(t *testing.T) {
	sehat := &Kesehatan{DBHidup: true, RasioErrorHTTP: 0.001, TotalHTTP: 100,
		MemTersediaKB: 800000, MemTotalKB: 1000000, Load1: 0.5, P95ms: 80}
	v, _ := verdictKesehatan(sehat)
	if v != "HIJAU" {
		t.Fatalf("sehat harus HIJAU: %v", v)
	}
	// DB mati = MERAH
	dbMati := &Kesehatan{DBHidup: false, MemTersediaKB: 900000, MemTotalKB: 1000000, Load1: 0.5}
	v, a := verdictKesehatan(dbMati)
	if v != "MERAH" || len(a) == 0 {
		t.Fatalf("DB mati harus MERAH ber-alasan: %v %v", v, a)
	}
	// mem tinggal 8% = KUNING (memburuk)
	memTipis := &Kesehatan{DBHidup: true, MemTersediaKB: 80000, MemTotalKB: 1000000, Load1: 0.5}
	v, a = verdictKesehatan(memTipis)
	if v != "KUNING" {
		t.Fatalf("mem tipis harus KUNING: %v %v", v, a)
	}
	// rasio error tinggi tapi < 0.5 = KUNING
	errNaik := &Kesehatan{DBHidup: true, RasioErrorHTTP: 0.10, TotalHTTP: 100,
		MemTersediaKB: 900000, MemTotalKB: 1000000, Load1: 0.5}
	v, _ = verdictKesehatan(errNaik)
	if v != "KUNING" {
		t.Fatalf("rasio 10%% harus KUNING: %v", v)
	}
	// rasio 0.6 = MERAH
	v, _ = verdictKesehatan(&Kesehatan{DBHidup: true, RasioErrorHTTP: 0.6, TotalHTTP: 100,
		MemTersediaKB: 900000, MemTotalKB: 1000000, Load1: 0.5})
	if v != "MERAH" {
		t.Fatalf("rasio 60%% harus MERAH: %v", v)
	}
	// load tinggi = KUNING; p95 6s = MERAH
	v, _ = verdictKesehatan(&Kesehatan{DBHidup: true, MemTersediaKB: 900000,
		MemTotalKB: 1000000, Load1: 6.0})
	if v != "KUNING" {
		t.Fatalf("load 6 harus KUNING: %v", v)
	}
	v, _ = verdictKesehatan(&Kesehatan{DBHidup: true, MemTersediaKB: 900000,
		MemTotalKB: 1000000, Load1: 0.5, P95ms: 6000})
	if v != "MERAH" {
		t.Fatalf("p95 6 dtk harus MERAH: %v", v)
	}
}

func TestVerdictPrediksi(t *testing.T) {
	// stabil = SEHAT
	p := &Prediksi{TrenMem: -1e-7, TrenError: 1e-7, TrenP95: 0.1}
	v, a := verdictPrediksi(p, Sampel{MemTersedia: 0.8, RasioError: 0.01, P95ms: 100})
	if v != "SEHAT" || len(a) == 0 {
		t.Fatalf("tren stabil harus SEHAT: %v %v", v, a)
	}
	// mem turun cepat + kritis < 10 menit = KRITIS
	p = &Prediksi{TrenMem: -0.001, TrenError: 0, TrenP95: 0, MenitKritis: 5}
	v, a = verdictPrediksi(p, Sampel{MemTersedia: 0.30, RasioError: 0.01, P95ms: 100})
	if v != "KRITIS" || len(a) == 0 {
		t.Fatalf("kritis 5 menit harus KRITIS: %v %v", v, a)
	}
	// memburuk tapi lama = WASPADA
	p = &Prediksi{TrenMem: -0.0002, TrenError: 0, TrenP95: 0, MenitKritis: 60}
	v, _ = verdictPrediksi(p, Sampel{MemTersedia: 0.30, RasioError: 0.01, P95ms: 100})
	if v != "WASPADA" {
		t.Fatalf("memburuk lama harus WASPADA: %v", v)
	}
}

func TestPrediksiDownButuhSampel(t *testing.T) {
	ResetPrediksi()
	p := PrediksiDown()
	if p.Verdict != "NA" || p.JumlahSampel != 0 {
		t.Fatalf("tanpa sampel harus NA: %+v", p)
	}
}

func TestRingPrediksiDanRegresi(t *testing.T) {
	ResetPrediksi()
	// tanam tren mem turun: 0.8 -> 0.1 dalam 100 detik (10 sampel)
	awal := time.Now()
	for i := 0; i < 10; i++ {
		s := Sampel{
			Waktu:       awal.Add(time.Duration(i*10) * time.Second),
			MemTersedia: 0.8 - 0.07*float64(i), // -0.007/dtk
			RasioError:  0.01,
			P95ms:       100,
		}
		ringPredikat(s)
	}
	p := PrediksiDown()
	if p.JumlahSampel != 10 {
		t.Fatalf("sampel: %d", p.JumlahSampel)
	}
	if p.TrenMem > -0.006 || p.TrenMem < -0.008 {
		t.Fatalf("tren mem salah: %v (mau ~-0.007)", p.TrenMem)
	}
	// sisa 0.1-0.05=0.05 pada -0.007/dtk = ~7.1 dtk = 0.12 menit -> KRITIS
	if p.MenitKritis > 1 || p.MenitKritis <= 0 {
		t.Fatalf("menit kritis salah: %v", p.MenitKritis)
	}
	if p.Verdict != "KRITIS" {
		t.Fatalf("tren cepat harus KRITIS: %v %v", p.Verdict, p.Alasan)
	}
	ResetPrediksi()
}

func TestRingMaksTerpotong(t *testing.T) {
	ResetPrediksi()
	awal := time.Now()
	for i := 0; i < 400; i++ {
		ringPredikat(Sampel{Waktu: awal.Add(time.Duration(i) * time.Second), MemTersedia: 0.5})
	}
	ringPrediksi.mu.Lock()
	n := len(ringPrediksi.sampel)
	ringPrediksi.mu.Unlock()
	if n != ringPrediksi.maks {
		t.Fatalf("ring seharusnya %d, dapat %d", ringPrediksi.maks, n)
	}
	ResetPrediksi()
}

func TestMinimum(t *testing.T) {
	if m := minimum([]float64{5, 3, 8, 1, 9}); m != 1 {
		t.Fatalf("minimum salah: %v", m)
	}
	if m := minimum(nil); m != 0 {
		t.Fatal("minimum kosong harus 0")
	}
}

func TestKesehatanLewatDBPingInject(t *testing.T) {
	// pasang ping dummy: gagal -> DBHidup false -> MERAH
	lama := dbPing
	dbPing = func(ctx context.Context) error { return context.DeadlineExceeded }
	defer func() { dbPing = lama }()
	k := AmbilKesehatan()
	if k.DBHidup {
		t.Fatal("ping gagal seharusnya DBHidup=false")
	}
	if k.Verdict != "MERAH" {
		t.Fatalf("DB mati harus MERAH: %v", k.Verdict)
	}
	// pasang ping sukses -> tidak MERAH karena DB
	dbPing = func(ctx context.Context) error { return nil }
	k = AmbilKesehatan()
	if !k.DBHidup {
		t.Fatal("ping sukses seharusnya DBHidup=true")
	}
}
