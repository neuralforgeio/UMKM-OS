package ai

// Angka format Indonesia — ekstraksi & validasi (port dari
// ml-service v3.6.0). Semua fungsi murni supaya unittest bisa
// mengunci perilaku tanpa database.

import (
        "fmt"
        "regexp"
        "strconv"
        "strings"
)

// Pembulatan yang dianggap JUJU: Rp 1.250.000 untuk data 1.252.340
// masih sah karena manusia warung bilang "sekitar satu dua lima".
// GRID berisi kelipatan 5/10/25/50 hingga 10 juta.
var roundingGrid = []float64{
        5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000,
        50000, 100000, 250000, 500000, 1000000, 2500000, 5000000,
        10000000,
}

const (
        toleranceRel       = 0.02  // 2% — selisih kecil dari redaksi LLM
        roundingToleranceRel = 0.025 // 2,5% — selisih akibat pembulatan GRID
)

// Pemindai angka bergaya Indonesia: opsional "Rp", deretan digit dengan
// pemisah titik/koma, opsional satuan (juta/rb), opsional "%".
var tokenRe = regexp.MustCompile(
        `(?:[Rr][Pp]\.?\s*)?` +
                `(?P<angka>\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)` +
                `\s*(?P<satuan>(?:juta|jt|ribu|rb|k)\b)?` +
                `(?P<persen>\s*%)?`)

var unitMult = map[string]float64{
        "juta": 1000000, "jt": 1000000,
        "ribu": 1000, "rb": 1000, "k": 1000,
}

var grupKomaRe = regexp.MustCompile(`^\d{1,3}(,\d{3})+$`)
var grupTitikRe = regexp.MustCompile(`^\d{1,3}(\.\d{3})+$`)
var adaDigitRe = regexp.MustCompile(`\d`)

// ParseNumberID parse satu token angka Indonesia -> float64 (ok=false
// bila gagal). Aturan pemisah konsisten bahasa Indonesia:
//
//      "1.250.000"    -> 1250000  (titik = ribuan)
//      "12,5"         -> 12.5     (koma = desimal)
//      "1.250.000,50" -> 1250000.5 (pemisah terakhir = desimal)
//      "1,250,000"    -> 1250000  (grup-3 berulang = ribuan)
//      "1.25"         -> 1.25     (titik tunggal pecahan < 3 digit:
//                                   desimal gaya Inggris dari LLM)
func ParseNumberID(token string) (float64, bool) {
        t := strings.ReplaceAll(strings.TrimSpace(token), " ", "")
        if t == "" || !adaDigitRe.MatchString(t) {
                return 0, false
        }
        hasDot := strings.Contains(t, ".")
        hasComma := strings.Contains(t, ",")
        if hasDot && hasComma {
                // Pemisah TERAKHIR = desimal; yang lain = ribuan.
                if strings.LastIndex(t, ",") > strings.LastIndex(t, ".") {
                        t = strings.ReplaceAll(t, ".", "")
                        t = strings.ReplaceAll(t, ",", ".")
                } else {
                        t = strings.ReplaceAll(t, ",", "")
                }
        } else if hasComma {
                if grupKomaRe.MatchString(t) {
                        t = strings.ReplaceAll(t, ",", "")
                } else {
                        t = strings.ReplaceAll(t, ",", ".")
                }
        } else if hasDot {
                if grupTitikRe.MatchString(t) {
                        t = strings.ReplaceAll(t, ".", "") // "1.250.000" -> "1250000"
                } else {
                        head, tail, _ := strings.Cut(t, ".")
                        // "1.25" -> desimal; "12.3456" tanpa satuan tak wajar -> ribuan.
                        if len(tail) > 0 && len(tail) < 3 {
                                t = head + "." + tail
                        } else {
                                t = strings.ReplaceAll(t, ".", "")
                        }
                }
        }
        v, err := strconv.ParseFloat(t, 64)
        if err != nil {
                return 0, false
        }
        return v, true
}

// AngkaTeks adalah satu angka hasil ekstraksi jawaban.
type AngkaTeks struct {
        Nilai  float64
        Rp     bool
        Persen bool
}

// ExtractNumbers: semua angka dalam teks. Hanya angka BERISIKO
// halusinasi yang dilaporkan (Rp eksplisit, nilai >= 1000, atau
// persentase). Angka kecil ("1 saran", "2 produk") dan tahun
// 1900-2100 dilewati — terlalu umum untuk dipakai bukti.
func ExtractNumbers(text string) []AngkaTeks {
        var hasil []AngkaTeks
        for _, loc := range tokenRe.FindAllStringSubmatchIndex(text, -1) {
                angka := text[loc[2]:loc[3]]
                // Grup opsional (satuan/persen) bernilai -1 bila tidak
                // ikut serta dalam kecocokan — jangan dipakai memotong.
                satuan := ""
                if loc[4] >= 0 && loc[5] >= 0 {
                        satuan = strings.ToLower(text[loc[4]:loc[5]])
                }
                persen := loc[6] >= 0 && loc[7] >= 0 && text[loc[6]:loc[7]] != ""
                nilai, ok := ParseNumberID(angka)
                if !ok {
                        continue
                }
                if mult, ada := unitMult[satuan]; ada {
                        nilai *= mult
                }
                // "Rp" bisa menempel langsung ("Rp125") atau terpisah spasi
                // ("Rp 125") — lihat 3 karakter ke belakang dari awal token.
                awal := loc[0]
                prefiks := ""
                if awal >= 3 {
                        prefiks = strings.ToLower(text[awal-3 : awal])
                } else if awal > 0 {
                        prefiks = strings.ToLower(text[:awal])
                }
                rp := strings.Contains(prefiks, "rp") ||
                        regexp.MustCompile(`^\s*[Rr][Pp]`).MatchString(text[awal:])
                if !rp && !persen && nilai >= 1900 && nilai <= 2100 && nilai == float64(int64(nilai)) {
                        continue // tahun, bukan data bisnis
                }
                hasil = append(hasil, AngkaTeks{Nilai: nilai, Rp: rp, Persen: persen})
        }
        return hasil
}

// bisaDijelaskan: apakah nilai bisa dijelaskan oleh SATU angka DATA
// sumber. Eksak, atau selisih relatif <= 2%, atau pembulatan GRID
// dalam 2,5% (mis. jawaban "Rp 1.250.000" untuk data 1.252.340).
func bisaDijelaskan(nilai, sumber float64) bool {
        if nilai == sumber {
                return true
        }
        patok := abs(sumber)
        if patok < 1 {
                patok = 1
        }
        if abs(nilai-sumber)/patok <= toleranceRel {
                return true
        }
        for _, g := range roundingGrid {
                bulat := round(sumber/g) * g
                if abs(nilai-bulat) < 1e-9 && abs(nilai-sumber)/patok <= roundingToleranceRel {
                        return true
                }
        }
        return false
}

func abs(v float64) float64 {
        if v < 0 {
                return -v
        }
        return v
}

func round(v float64) float64 {
        if v >= 0 {
                return float64(int64(v + 0.5))
        }
        return float64(int64(v - 0.5))
}

// ValidateNumbers: (semuaSah, daftarAngkaMencurigakan).
//
// Sah = setiap angka berisiko di jawaban bisa dijelaskan >= 1 angka
// DATA. Persentase hanya diadu dengan angka DATA < 100 (pct, MAPE,
// stok kecil); nilai Rp/uang hanya diadu dengan angka DATA >= 100
// supaya "Rp 25" tidak lolos karena ada stok 25.
func ValidateNumbers(answer string, allowed []float64) (bool, []float64) {
        var pelanggar []float64
        for _, a := range ExtractNumbers(answer) {
                var kandidat []float64
                if a.Persen {
                        // Persentase hanya diadu dengan angka DATA < 100.
                        for _, s := range allowed {
                                if abs(s) < 100 {
                                        kandidat = append(kandidat, s)
                                }
                        }
                } else if a.Rp {
                        // Uang hanya diadu dengan angka DATA >= 100.
                        for _, s := range allowed {
                                if abs(s) >= 100 {
                                        kandidat = append(kandidat, s)
                                }
                        }
                } else {
                        kandidat = allowed
                }
                sah := false
                for _, s := range kandidat {
                        if bisaDijelaskan(a.Nilai, s) {
                                sah = true
                                break
                        }
                }
                if !sah {
                        pelanggar = append(pelanggar, a.Nilai)
                }
        }
        return len(pelanggar) == 0, pelanggar
}

// BuildRetryInstruction: instruksi koreksi untuk retry ke-1
// (satu-satunya) blueprint.
func BuildRetryInstruction(offenders []float64) string {
        var b strings.Builder
        for i, v := range offenders {
                if i > 0 {
                        b.WriteString(", ")
                }
                b.WriteString("Rp ")
                b.WriteString(FormatRupiahID(v))
        }
        return "Jawabanmu memuat angka yang TIDAK ada di DATA: " + b.String() +
                ". Tulis ulang jawabanmu HANYA memakai angka dari DATA di pesan " +
                "sistem. Jangan menambahkan angka baru."
}

// FormatRupiahID: 1250000 -> "1.250.000" (gaya Indonesia, tanpa Rp).
func FormatRupiahID(nilai float64) string {
        negatif := nilai < 0
        bulat := int64(round(abs(nilai)))
        s := strconv.FormatInt(bulat, 10)
        var b strings.Builder
        sisa := len(s) % 3
        if sisa == 0 {
                sisa = 3
        }
        b.WriteString(s[:sisa])
        for i := sisa; i < len(s); i += 3 {
                b.WriteString(".")
                b.WriteString(s[i : i+3])
        }
        if negatif {
                return "-" + b.String()
        }
        return b.String()
}

// FormatPersenID: 12.5 -> "12,5" (koma desimal Indonesia, tanpa %).
func FormatPersenID(nilai float64) string {
        return strings.ReplaceAll(fmt.Sprintf("%.1f", abs(nilai)), ".", ",")
}
