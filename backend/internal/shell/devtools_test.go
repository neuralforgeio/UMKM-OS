package shell

// TES DEVTOOLS v2.5.0 (run-14): 20 perkakas developer baru, semua
// logika MURNI diuji tanpa OS/DB (permintaan pemilik: coverage
// tinggi). Setiap alat minimal satu kasus normal + tepi.

import (
	"strings"
	"testing"
	"time"
)

func TestRateLimiter(t *testing.T) {
	rl := RateLimiterBaru(3, time.Minute)
	kini := time.Now()
	// 3 izinkan
	for i := 0; i < 3; i++ {
		ok, tunggu := rl.Izinkan("ip-a", kini.Add(time.Duration(i)*time.Second))
		if !ok || tunggu != 0 {
			t.Fatalf("aksi %d seharusnya izin: ok=%v tunggu=%d", i, ok, tunggu)
		}
	}
	// ke-4 ditolak dengan retry-after > 0
	ok, tunggu := rl.Izinkan("ip-a", kini.Add(3*time.Second))
	if ok || tunggu <= 0 || tunggu > 60 {
		t.Fatalf("aksi ke-4 seharusnya tolak: ok=%v tunggu=%d", ok, tunggu)
	}
	// kunci lain tidak terpengaruh
	ok, _ = rl.Izinkan("ip-b", kini)
	if !ok {
		t.Fatal("kunci lain seharusnya izin")
	}
	// setelah jendela lewat, kuota pulih
	ok, _ = rl.Izinkan("ip-a", kini.Add(61*time.Second))
	if !ok {
		t.Fatal("setelah jendela lewat seharusnya izin lagi")
	}
}

func TestPenangkapWebhook(t *testing.T) {
	p := PenangkapWebhookBaru()
	p.Tangkap(WebhookTangkapan{Metode: "POST", Path: "/hook", Body: `{"a":1}`})
	p.Tangkap(WebhookTangkapan{Metode: "GET", Path: "/hook", Body: ""})
	daftar := p.Daftar()
	if len(daftar) != 2 || daftar[0].Metode != "POST" || daftar[1].Metode != "GET" {
		t.Fatalf("riwayat salah: %+v", daftar)
	}
	p.Kosongkan()
	if len(p.Daftar()) != 0 {
		t.Fatal("kosongkan gagal")
	}
	// ring maks 50
	for i := 0; i < 60; i++ {
		p.Tangkap(WebhookTangkapan{Path: "/hook", Body: strings.Repeat("x", i%20)})
	}
	if len(p.Daftar()) != 50 {
		t.Fatalf("ring seharusnya 50: %d", len(p.Daftar()))
	}
}

func TestStatusHeartbeat(t *testing.T) {
	h := Heartbeat{Nama: "backup", Periode: time.Hour, Grace: 10 * time.Minute, Terakhir: time.Now()}
	if down, telat := StatusHeartbeat(h, time.Now().Add(30*time.Minute)); down {
		t.Fatalf("belum telat tapi down (telat=%v)", telat)
	}
	down, telat := StatusHeartbeat(h, time.Now().Add(75*time.Minute))
	if !down || telat <= 0 {
		t.Fatalf("seharusnya down: %v %v", down, telat)
	}
}

func TestTandaiLambatDanRingkas(t *testing.T) {
	daftar := []QueryStat{
		{SQL: "SELECT 1", Ms: 12},
		{SQL: "SELECT besar", Ms: 340},
		{SQL: "SELECT sedang", Ms: 101},
	}
	tandai := TandaiLambat(daftar, 100)
	if !tandai[1].Lambat || !tandai[2].Lambat || tandai[0].Lambat {
		t.Fatalf("tag lambat salah: %+v", tandai)
	}
	r := RingkasQueryStat(tandai)
	if r.Jumlah != 3 || r.Lambat != 2 {
		t.Fatalf("ringkas salah: %+v", r)
	}
	if r.MaxMs != 340 || r.RataMs != (12+340+101)/3 {
		t.Fatalf("max/rata salah: %+v", r)
	}
	if kosong := RingkasQueryStat(nil); kosong.Jumlah != 0 || kosong.RataMs != 0 {
		t.Fatalf("kosong salah: %+v", kosong)
	}
}

func TestBuatCSVEscape(t *testing.T) {
	kolom := []string{"id", "nama"}
	baris := []map[string]interface{}{
		{"id": 1, "nama": `Kopi "Gula" Aceh`},
		{"id": 2, "nama": "teh, tarik"},
		{"id": 3, "nama": nil},
	}
	csv := BuatCSV(kolom, baris)
	bar := strings.Split(csv, "\r\n")
	if bar[0] != "id,nama" {
		t.Fatalf("header: %q", bar[0])
	}
	if bar[1] != `1,"Kopi ""Gula"" Aceh"` {
		t.Fatalf("escape kutip: %q", bar[1])
	}
	if bar[2] != `2,"teh, tarik"` {
		t.Fatalf("escape koma: %q", bar[2])
	}
	if bar[3] != "3," {
		t.Fatalf("nil kosong: %q", bar[3])
	}
	// angka float juga terformat
	if got := BuatCSV([]string{"x"}, []map[string]interface{}{{"x": 7}}); !strings.Contains(got, "7") {
		t.Fatalf("angka: %q", got)
	}
}

func TestUrutTabelTerbesar(t *testing.T) {
	daftar := []UkuranTabel{
		{Nama: "a", TotalKB: 100},
		{Nama: "b", TotalKB: 900},
		{Nama: "c", TotalKB: 300},
	}
	urut := UrutTotalTerbesar(daftar)
	if urut[0].Nama != "b" || urut[1].Nama != "c" || urut[2].Nama != "a" {
		t.Fatalf("urutan salah: %v %v %v", urut[0].Nama, urut[1].Nama, urut[2].Nama)
	}
	if daftar[0].Nama != "a" {
		t.Fatal("input asli tidak boleh terurut (pure)")
	}
}

func TestRotasiKunciOverlap(t *testing.T) {
	kini := time.Now()
	lama := []KunciApi{{Label: "lama", Aktif: true, Terbit: kini.Add(-72 * time.Hour), Kadaluarsa: kini.Add(24 * time.Hour)}}
	out := RotasiKunci(lama, kini, 7*24*time.Hour)
	if len(out) != 2 {
		t.Fatalf("seharusnya 2 kunci: %d", len(out))
	}
	if !out[0].Aktif {
		t.Fatal("kunci lama seharusnya masih aktif selama overlap")
	}
	if !out[1].Aktif || out[1].Kadaluarsa.Before(kini) {
		t.Fatal("kunci baru seharusnya aktif")
	}
	// kunci yang sudah lewat kadaluarsa dinonaktifkan
	lama2 := []KunciApi{{Label: "sudah-mati", Aktif: true, Terbit: kini.Add(-100 * time.Hour), Kadaluarsa: kini.Add(-1 * time.Hour)}}
	out2 := RotasiKunci(lama2, kini, 24*time.Hour)
	if out2[0].Aktif {
		t.Fatal("kunci kedaluwarsa seharusnya mati")
	}
}

func TestMaintenance(t *testing.T) {
	m := StatusMaintenance{Aktif: true, Izin: map[string]bool{"DEVELOPER": true}}
	if !BolehLewatMaintenance(m, "DEVELOPER") {
		t.Fatal("developer seharusnya boleh lewat")
	}
	if BolehLewatMaintenance(m, "KASIR") {
		t.Fatal("kasir seharusnya ditahan")
	}
	m.Aktif = false
	if !BolehLewatMaintenance(m, "KASIR") {
		t.Fatal("maintenance mati = semua lewat")
	}
	SetMaintenance(false, "")
	if aktif, _, _ := StatusMaintenanceSekarang(); aktif {
		t.Fatal("set false seharusnya mati")
	}
	SetMaintenance(true, "upgrade")
	if aktif, pesan, izin := StatusMaintenanceSekarang(); !aktif || pesan != "upgrade" || len(izin) == 0 {
		t.Fatalf("set true salah: %v %q %v", aktif, pesan, izin)
	}
	SetMaintenance(false, "")
}

func TestLevelLog(t *testing.T) {
	if !LolosAmbang(LevelWarn, LevelWarn) {
		t.Fatal("warn >= warn seharusnya lolos")
	}
	if LolosAmbang(LevelDebug, LevelError) {
		t.Fatal("debug < error tidak lolos")
	}
	if ParseLevelLog("debug") != LevelDebug || ParseLevelLog("WARN") != LevelWarn || ParseLevelLog("ERROR") != LevelError {
		t.Fatal("parse level salah")
	}
	if ParseLevelLog("aneh") != LevelInfo {
		t.Fatal("tak dikenal seharusnya INFO")
	}
	for _, l := range []LevelLog{LevelDebug, LevelInfo, LevelWarn, LevelError} {
		if l.String() == "" {
			t.Fatal("string level kosong")
		}
	}
}

func TestStatRuntimePersen(t *testing.T) {
	s := StatRuntime{HeapInUseKB: 300, HeapIdleKB: 100}
	if p := s.PersenHeapInUse(); p < 74.9 || p > 75.1 {
		t.Fatalf("persen salah: %v", p)
	}
	kosong := StatRuntime{}
	if kosong.PersenHeapInUse() != 0 {
		t.Fatal("kosong seharusnya 0")
	}
}

func TestSweepSesi(t *testing.T) {
	kini := time.Now()
	sesi := map[string]time.Time{
		"sid-baru":  kini.Add(time.Hour),
		"sid-lama":  kini.Add(-time.Hour),
		"sid-tepat": kini,
	}
	got := SweepSesi(sesi, kini)
	if len(got) != 1 || got[0] != "sid-lama" {
		t.Fatalf("sweep salah: %v", got)
	}
}

func TestCariAudit(t *testing.T) {
	daftar := []BarisAudit{
		{ID: 1, UserID: 2, Nama: "Dev", Aksi: "LOGIN", Waktu: time.Date(2026, 11, 18, 9, 0, 0, 0, time.UTC)},
		{ID: 2, UserID: 5, Nama: "Owner", Aksi: "SHELL_FS_HAPUS", Waktu: time.Date(2026, 11, 19, 10, 0, 0, 0, time.UTC)},
		{ID: 3, UserID: 2, Nama: "Dev", Aksi: "REFUND", Waktu: time.Date(2026, 11, 20, 11, 0, 0, 0, time.UTC)},
	}
	got := CariAudit(daftar, 2, "", "", "")
	if len(got) != 2 {
		t.Fatalf("filter user salah: %d", len(got))
	}
	got = CariAudit(daftar, 0, "shell", "", "")
	if len(got) != 1 || got[0].Aksi != "SHELL_FS_HAPUS" {
		t.Fatalf("filter aksi substring salah: %+v", got)
	}
	got = CariAudit(daftar, 0, "", "2026-11-19", "2026-11-20")
	if len(got) != 2 {
		t.Fatalf("filter tanggal salah: %+v", got)
	}
	// rentang satu hari inklusif
	got = CariAudit(daftar, 0, "", "2026-11-19", "2026-11-19")
	if len(got) != 1 {
		t.Fatalf("satu hari seharusnya 1: %+v", got)
	}
	if got := CariAudit(nil, 1, "x", "y", "z"); got != nil {
		t.Fatal("kosong seharusnya nil")
	}
}

func TestBersihkanSejarahCmd(t *testing.T) {
	var daftar []HasilPerintah
	for i := 0; i < 60; i++ {
		daftar = append(daftar, HasilPerintah{ID: int64(i + 1)})
	}
	daftar = BersihkanSejarahCmd(daftar, 50)
	if len(daftar) != 50 || daftar[0].ID != 11 {
		t.Fatalf("pembersihan salah: len=%d pertama=%d", len(daftar), daftar[0].ID)
	}
	if daftar := BersihkanSejarahCmd(daftar[:3], 50); len(daftar) != 3 {
		t.Fatal("di bawah maks tidak dipotong")
	}
}

func TestHistogramJam(t *testing.T) {
	h := TambahHistogram(nil, 9, 120)
	h = TambahHistogram(h, 9, 140)
	h = TambahHistogram(h, 10, 50)
	if len(h) != 2 || h[0].Sampel != 2 || h[0].TotalMs != 260 || h[1].Sampel != 1 {
		t.Fatalf("histogram salah: %+v", h)
	}
}

func TestValidasiEnv(t *testing.T) {
	temuan := ValidasiEnv(map[string]string{
		"DATABASE_URL": "postgres://x",
		"JWT_SECRET":   "umkm-os-dev-secret",
		"PORT":         "8080",
	})
	if len(temuan) != 1 || temuan[0].Kunci != "JWT_SECRET" || !strings.Contains(temuan[0].Masalah, "default") {
		t.Fatalf("temuan seharusnya JWT default: %+v", temuan)
	}
	temuan = ValidasiEnv(map[string]string{"PORT": "abc"})
	if len(temuan) != 3 { // DATABASE_URL + JWT_SECRET + PORT
		t.Fatalf("temuan salah: %+v", temuan)
	}
}

func TestBandingkanSkema(t *testing.T) {
	aktual := map[string][]string{"produk": {"id", "nama", "harga"}, "aneh": {"x"}}
	eks := map[string][]string{"produk": {"id", "nama", "stok"}, "pelanggan": {"id"}}
	beda := BandingkanSkema(aktual, eks)
	if len(beda) != 4 {
		t.Fatalf("jumlah beda salah: %+v", beda)
	}
	var gabung strings.Builder
	for _, b := range beda {
		gabung.WriteString(b.Tabel + b.Kolom + b.Masalah + ";")
	}
	g := gabung.String()
	for wajib := range map[string]struct{}{
		"produkstokkolom hilang;":        {},
		"pelangganidkolom hilang;":       {},
		"produkhargaakolom tak dikenal;": {},
		"anehtabel tidak dikenal;":       {},
	} {
		if !strings.Contains(g, strings.Replace(wajib, "akolom", "kolom", 1)) {
			if !strings.Contains(g, wajib) {
				t.Fatalf("temuan hilang: %s dalam %s", wajib, g)
			}
		}
	}
}

func TestBenderaResolusi(t *testing.T) {
	b := BenderaBaru()
	b.Set("fitur-x", "outlet-1", false)
	if b.Resolusi("fitur-x", "outlet-1", true) {
		t.Fatal("scope spesifik seharusnya menang")
	}
	if !b.Resolusi("fitur-x", "outlet-2", true) {
		t.Fatal("scope lain fallback default")
	}
	b.Purge("fitur-x")
	if !b.Resolusi("fitur-x", "outlet-1", true) {
		t.Fatal("setelah purge kembali default")
	}
}

func TestEstimasiBackup(t *testing.T) {
	tabel := []UkuranTabel{{TotalKB: 1024}} // 1 MB
	e := EstimasiBackupDari(tabel, 10)
	if e.DumpKB != 1382 { // 1024*1.35
		t.Fatalf("dump salah: %d", e.DumpKB)
	}
	if e.Menit <= 0 {
		t.Fatalf("menit seharusnya > 0: %v", e.Menit)
	}
	// kecepatan 0 -> default 10
	if d := EstimasiBackupDari(tabel, 0); d.Menit != e.Menit {
		t.Fatal("default kecepatan salah")
	}
}

func TestIdempoten(t *testing.T) {
	idm := IdempotenBaru(time.Minute)
	kini := time.Now()
	if !idm.Klaim("aksi-1", kini) {
		t.Fatal("klaim pertama seharusnya sukses")
	}
	if idm.Klaim("aksi-1", kini.Add(time.Second)) {
		t.Fatal("dobel klik seharusnya ditolak")
	}
	if !idm.Klaim("aksi-1", kini.Add(2*time.Minute)) {
		t.Fatal("setelah TTL lewat bisa klaim lagi")
	}
	if !idm.Klaim("aksi-2", kini) {
		t.Fatal("kunci lain seharusnya sukses")
	}
}

func TestVerdictHealth(t *testing.T) {
	daftar := []HasilHealth{{Nama: "db", Hidup: true, Ms: 10}, {Nama: "cache", Hidup: true, Ms: 20}}
	if v := VerdictHealth(daftar, 100); v != "OK" {
		t.Fatalf("seharusnya OK: %v", v)
	}
	daftar[0].Hidup = false
	if v := VerdictHealth(daftar, 100); v != "DOWN" {
		t.Fatalf("ada mati seharusnya DOWN: %v", v)
	}
	daftar[0].Hidup = true
	daftar[0].Ms = 300
	daftar[1].Ms = 400
	if v := VerdictHealth(daftar, 100); v != "DEGRADED" {
		t.Fatalf("semua lambat seharusnya DEGRADED: %v", v)
	}
	if v := VerdictHealth(nil, 100); v != "NA" {
		t.Fatalf("kosong seharusnya NA: %v", v)
	}
	// satu lambat saja = OK (bukan semua)
	if v := VerdictHealth([]HasilHealth{{Hidup: true, Ms: 5}, {Hidup: true, Ms: 900}}, 100); v != "OK" {
		t.Fatalf("satu lambat masih OK: %v", v)
	}
}
