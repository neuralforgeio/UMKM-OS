package ai

// Otak murni OSCAR (era Go murni, backend 2.0.0) — port setia dari
// ml-service v3.6.0 (app/services/assistant.py era Python) yang kini
// hidup di dalam backend Go. 100% murni: tanpa DB, tanpa HTTP, tanpa
// env — supaya bisa diuji penuh dengan go test (unittest) tanpa jaringan.
//
// Bagian file ini: normalisasi bahasa informal Indonesia + klasifikasi
// maksud + ekstraksi periode. Urutan pengecekan mengikuti ml-service:
// pencipta -> dev_laporan -> saran -> stok -> produk -> penjualan
// (+masa depan => prediksi) -> jam ramai -> prediksi eksplisit ->
// identitas -> kemampuan -> obrolan -> sapaan -> terima kasih -> umum.

import (
	"regexp"
	"strings"
)

// Batas blueprint: jawaban ringkas, murah, dan jelas untuk pemilik warung.
const (
	MaxAnswerWords = 120
	// Era "AI Bebas": jawaban pertanyaan BEBAS boleh lebih panjang
	// (pengetahuan umum butuh ruang) — batas jawaban BISNIS tetap 120.
	MaxAnswerWordsUmum = 250
	// Riwayat yang dikirim ke LLM: cukup untuk konteks, hemat token.
	HistoryTurns = 5
	// Parameter generasi blueprint (deterministik, bukan kreatif).
	Temperature = 0.2
	MaxTokens   = 700
)

// MaxudBerdata: validasi angka jawaban HANYA berlaku untuk maksud BISNIS
// WARUNG — angka pada jawaban pertanyaan bebas ("5 tambah 5 = 10, dua
// kali lipat = 100%") adalah pengetahuan/hitungan, bukan klaim data
// warung, sehingga tidak boleh dicap "tidak lolos validasi data".
var MaxudBerdata = map[string]bool{
	"penjualan":      true,
	"stok":           true,
	"produk":         true,
	"prediksi":       true,
	"saran_tindakan": true,
	"jam_ramai":      true,
}

// Nama persona asisten — konsisten di jawaban identitas & system prompt.
const (
	AssistantName      = "OSCAR"
	AssistantFullName  = "Online Shop Center for Assistance & Response"
	AssistantCreator   = "Dearly Febriano Irwansyah"
	AssistantOriginTxt = "Surabaya, Indonesia"
)

// ---------------------------------------------------------------------
// 0) Normalisasi bahasa informal Indonesia (era v3.2.0 ml-service)
// ---------------------------------------------------------------------

// Gabungan kata yang dipecah SEBELUM pemecahan kata.
var gabungan = map[string]string{
	"namamu":        "nama kamu",
	"siapakamu":     "siapa kamu",
	"siapanama":     "siapa nama",
	"terimakasih":   "terima kasih",
	"terimakasihya": "terima kasih ya",
	"namanya":       "nama dia",
	"kamusiapa":     "kamu siapa",
}

// Singkatan & slang per KATA (nilai boleh berisi spasi — token dipecah
// ulang setelahnya). Semua kunci/nilai huruf kecil.
var slank = map[string]string{
	"gmn": "gimana", "gimana": "gimana", "gk": "tidak", "ga": "tidak",
	"gak": "tidak", "nggak": "tidak", "enggak": "tidak", "gg": "tidak",
	"yg": "yang", "udh": "sudah", "sdh": "sudah", "udah": "sudah",
	"blm": "belum", "bsk": "besok", "skrg": "sekarang", "skg": "sekarang",
	"brp": "berapa", "brapa": "berapa", "mu": "kamu", "lo": "kamu",
	"lu": "kamu", "km": "kamu", "kmu": "kamu", "elu": "kamu",
	"utk": "untuk", "dgn": "dengan", "dg": "dengan", "dpn": "depan",
	"kmrn": "kemarin", "kmren": "kemarin", "mng": "minggu",
	"bln": "bulan", "hr": "hari", "trx": "transaksi", "omset": "omzet",
	"thx": "terima kasih", "makasih": "terima kasih",
	"makasi": "terima kasih", "kamsia": "terima kasih",
	"tengkiu": "terima kasih", "plg": "paling", "dpt": "dapat",
	"mo": "mau", "pengen": "ingin", "pengin": "ingin", "aja": "saja",
	"sj": "saja", "kyk": "kayak", "klo": "kalau", "kalo": "kalau",
	"jgn": "jangan", "lbh": "lebih", "byk": "banyak", "bnyk": "banyak",
	"dikit": "sedikit", "sm": "sama", "bgt": "banget",
}

var buangBacaRe = regexp.MustCompile(`[^a-z0-9]+`)

// NormalizeText meratakan pertanyaan ke bentuk baku pencarian maksud.
//
// Urutan: huruf kecil -> buang tanda baca -> pecah gabungan kata ->
// petakan slang per kata -> lipat spasi. Contoh:
//
//	"Nama mu siapa??"        -> "nama kamu siapa"
//	"omzet gmn?"             -> "omzet gimana"
//	"saran minggu dpn dong"  -> "saran minggu depan dong"
func NormalizeText(question string) string {
	t := strings.ToLower(question)
	t = buangBacaRe.ReplaceAllString(t, " ")
	t = " " + strings.TrimSpace(t) + " "
	for asal, tujuan := range gabungan {
		t = strings.ReplaceAll(t, " "+asal+" ", " "+tujuan+" ")
	}
	var kata []string
	for _, token := range strings.Fields(t) {
		if v, ok := slank[token]; ok {
			kata = append(kata, strings.Fields(v)...)
		} else {
			kata = append(kata, token)
		}
	}
	return strings.Join(kata, " ")
}

// ---------------------------------------------------------------------
// 1) Kata kunci maksud (urutan yang pertama menang)
// ---------------------------------------------------------------------

var kwSaran = []string{
	"saran", "sarankan", "rekomendasi", "rekomendasikan", "tips", "nasihat",
	"strategi", "harus apa", " harus ", "apa yang harus", "apa yang bisa",
	"gimana cara", "bagaimana cara", "apa selanjutnya", "maka apa",
	"kira kira harus", "solusi", "bagaimana agar",
}
var kwStok = []string{
	"stok", "stock", "sisa", "habis", "menipis", "kosong", "restok",
	"restock", "persediaan", "gudang", "inventaris", "beli lagi",
	"tambah barang",
}
var kwProduk = []string{
	"produk", "barang", "item", "terlaris", "paling laku", "paling banyak",
	"populer", "best seller", "favorit", "kategori", "mana yang laku",
	"daftar menu", "menu apa", "andalan",
}
var kwPenjualan = []string{
	"omzet", "pendapatan", "penjualan", "terjual", "jual",
	"uang masuk", "penghasilan", "revenue", "transaksi", "laba", "untung",
	"rugi", "hasil", "cuan",
}
var kwMasaDepan = []string{
	"besok", "nanti", " depan ", "akan datang", "mendatang", "masa depan",
	"berikutnya", "selanjutnya", "lusa",
}
var kwPrediksi = []string{
	"prediksi", "ramal", "proyeksi", "forecast", "prognosis", "estimasi",
	"taksiran", "perkiraan",
}
var kwIdentitas = []string{
	"siapa kamu", "kamu siapa", "nama kamu", "siapa nama", "nama asisten",
	"kenalan", "perkenalkan diri", "kamu robot", "kamu manusia", "kamu ai",
	"kamu aplikasi", "kamu ini siapa", "siapa yang menjawab",
	"dibuat oleh siapa", "nama oscar", "oscar itu siapa",
}
var kwKemampuan = []string{
	"bisa apa", "apa yang bisa", "bisa bantu apa", "fitur", "bantuan",
	"help", "cara pakai", "apa saja yang bisa", "kemampuan", "kegunaan",
	"buat apa", "fungsinya apa", "apa fungsi", "daftar perintah",
	"perintah apa", "contoh pertanyaan",
}

// Sapaan singkat " hi "/" p " ber-spasi pengaman — bentuk polos menelan
// kata "HITUNG" dan semua frasa ber-huruf-p ("berapa", "apa").
var kwSapaan = []string{
	"halo", "hallo", "hai", "hei", "hello", " hi ", "pagi", "siang",
	"sore", "malam", "assalamualaikum", "salam", "permisi", "oi",
	"halo oscar", " p ", "woi",
}

// " top " ber-spasi pengaman — bentuk polos menelan kata "LAPTOP".
var kwTerimaKasih = []string{
	"terima kasih", "thanks", "thank you", "sip", "siip", "mantap",
	" top ", "good job", "bagus deh", "oke deh", "ok deh", "nice",
	"keren",
}
var kwObrolan = []string{
	"owalah", "oalah", "walah", "welah", "hadeh", "aduhai", "ya ampun",
	"gitu ya", "begitu ya", "gitu sih", "yaudah", "ya udah", "ya sudah",
	"sumpah", "ngakak", "wkwk", "lucu banget", "lucu ya", "bosen",
	"bosan", "capek deh", "gara gara", "gokil", "anjay", "keren banget",
	"pintar kamu", "hebat kamu", "kamu keren", "kamu lucu", "suka sama",
}
var kwJamRamai = []string{
	"jam ramai", "jam sibuk", "paling ramai", "jam paling", "kapan ramai",
	"waktu ramai", "jam laku", "jam belanja", "prime time", "paling sibuk",
	"ramai kapan", "jam sepi", "sepi kapan", "jam orang banyak",
}
var kwPencipta = []string{
	"pencipta", "penciptamu", "pembuat", "pembuatmu", "dibuat siapa",
	"diciptakan", "yang bikin kamu", "yang membuat kamu", "creator",
	"who created you", "who made you", "oscar dari mana", "asal oscar",
}
var kwHari = []string{
	"hari ini", "kemarin", " tadi ", "harian", "per hari", "sehari",
	"hari kemarin",
}
var kwMinggu = []string{
	"minggu", "pekan", "7 hari", "tujuh hari", "seminggu", "sepekan",
}
var kwBulan = []string{
	"bulan", "30 hari", "tiga puluh hari", "sebulan", "bulanan",
	"bulan ini", "bulan lalu",
}

// Kata penghubung yang TIDAK dihitung saat pencocokan kabur.
var stopwordFrasa = map[string]bool{
	"apa": true, "yang": true, "kamu": true, "saya": true, "untuk": true,
	"dengan": true, "hari": true, "ini": true, "itu": true, "dong": true,
	"ya": true, "sih": true, "deh": true, "kok": true,
}

// miripRatio menghitung kemiripan dua kata (0..1) untuk pencocokan
// typo-toleran — padanan difflib.SequenceMatcher.ratio() >= 0.8 di
// ml-service, diimplementasikan lewat jarak Levenshtein (perilaku sama
// untuk kata pendek: satu huruf beda pada kata 4 huruf = 0.75).
func miripRatio(a, b string) float64 {
	if len(a) == 0 && len(b) == 0 {
		return 1
	}
	la, lb := len(a), len(b)
	d := make([]int, lb+1)
	for j := 0; j <= lb; j++ {
		d[j] = j
	}
	for i := 1; i <= la; i++ {
		prev := d[0]
		d[0] = i
		for j := 1; j <= lb; j++ {
			cur := d[j]
			cost := 1
			if a[i-1] == b[j-1] {
				cost = 0
			}
			m := d[j] + 1
			if d[j-1]+1 < m {
				m = d[j-1] + 1
			}
			if prev+cost < m {
				m = prev + cost
			}
			d[j] = m
			prev = cur
		}
	}
	total := la
	if lb > total {
		total = lb
	}
	return 1 - float64(d[lb])/float64(total)
}

// mirip: pencocokan kabur TOKEN-LEVEL untuk frasa >= 2 kata isi.
// Setiap kata isi wajib punya pasangan token pertanyaan ber-kemiripan
// >= 0.8; kata penghubung diabaikan supaya "stok apa yang menipis"
// tidak dianggap mirip "apa yang harus".
func mirip(toks []string, frasa string) bool {
	kata := strings.Fields(frasa)
	if len(kata) < 2 || len(frasa) < 8 {
		return false
	}
	isi := 0
	for _, k := range kata {
		if !stopwordFrasa[k] {
			isi++
		}
	}
	if isi < 2 {
		return false
	}
	for _, k := range kata {
		if stopwordFrasa[k] {
			continue
		}
		ketemu := false
		for _, t := range toks {
			if miripRatio(k, t) >= 0.8 {
				ketemu = true
				break
			}
		}
		if !ketemu {
			return false
		}
	}
	return true
}

// hit: cocok eksak (substring ber-spasi pengaman) LALU kabur typo.
func hit(text string, keywords []string) bool {
	t := " " + strings.ToLower(text) + " "
	toks := strings.Fields(t)
	for _, k := range keywords {
		if strings.Contains(t, k) {
			return true
		}
		if mirip(toks, strings.TrimSpace(k)) {
			return true
		}
	}
	return false
}

// CekPencipta: true bila pesan menanyakan pencipta/asal-usul OSCAR.
func CekPencipta(question string) bool {
	t := " " + strings.ToLower(question) + " "
	for _, k := range kwPencipta {
		if strings.Contains(t, k) {
			return true
		}
	}
	return false
}

// ClassifyIntent mengembalikan maksud pertanyaan.
//
// Default = "umum" (era "AI Bebas"): pertanyaan yang tidak menyentuh
// bisnis warung ("berapa satu tambah satu", "5 tambah 5", "apa ibu
// kota Indonesia") dijawab model dengan pengetahuan umumnya, bukan
// dipaksa menjadi saran data. Pertanyaan data tetap menang atas
// basa-basi ("halo, omzet berapa?" -> penjualan), dan penanda masa
// depan memindah pertanyaan penjualan ke prediksi.
func ClassifyIntent(question string) string {
	if CekPencipta(question) {
		return "pencipta"
	}
	if CekDevLaporanQuestion(question) {
		return "dev_laporan"
	}
	t := NormalizeText(question)
	if hit(t, kwSaran) {
		return "saran_tindakan"
	}
	if hit(t, kwStok) {
		return "stok"
	}
	if hit(t, kwProduk) {
		return "produk"
	}
	if hit(t, kwPenjualan) {
		if hit(t, kwMasaDepan) {
			return "prediksi"
		}
		return "penjualan"
	}
	if hit(t, kwJamRamai) {
		return "jam_ramai"
	}
	if hit(t, kwPrediksi) {
		return "prediksi"
	}
	if hit(t, kwIdentitas) {
		return "identitas"
	}
	if hit(t, kwKemampuan) {
		return "kemampuan"
	}
	if hit(t, kwObrolan) {
		return "obrolan"
	}
	if hit(t, kwSapaan) {
		return "sapaan"
	}
	if hit(t, kwTerimaKasih) {
		return "terima_kasih"
	}
	return "umum"
}

// ExtractPeriod: periode yang DIMAKSUD penanya: hari | minggu | bulan.
func ExtractPeriod(question string) string {
	t := NormalizeText(question)
	if hit(t, kwBulan) {
		return "bulan"
	}
	if hit(t, kwMinggu) {
		return "minggu"
	}
	return "hari"
}
