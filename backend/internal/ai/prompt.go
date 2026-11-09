package ai

// System prompt DWI-MODE "AI Bebas" + penyusunan pesan LLM (port setia
// dari ml-service v3.6.0). Keluhan pemilik lama: "kan ini model AI
// bebas, bukan AI buatan kita, harusnya bisa menjawab berbagai hal" —
// prompt lama memaksa "Jawab HANYA dari DATA" sehingga model menolak
// "berapa satu tambah satu". Prompt ini membedakan dua jenis
// pertanyaan: (A) bebas -> pengetahuan umum model, dilarang menolak
// dengan alasan data; (B) bisnis warung -> wajib berbasis DATA,
// dilarang mengarang angka warung.

import (
	"fmt"
	"strings"
	"time"
)

// Nama hari/bulan Indonesia dipetakan manual (deterministik, tidak
// bergantung locale sistem yang tidak pasti di container).
var namaHari = []string{
	"Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu",
}
var namaBulan = []string{
	"Januari", "Februari", "Maret", "April", "Mei", "Juni",
	"Juli", "Agustus", "September", "Oktober", "November", "Desember",
}

// TanggalHariIni: tanggal gaya Indonesia untuk prompt, contoh
// "Minggu, 1 November 2026". Hari bisa disuntik supaya unittest
// deterministik; time.Time zero = tanggal sistem saat ini.
func TanggalHariIni(hari time.Time) string {
	if hari.IsZero() {
		hari = time.Now()
	}
	return fmt.Sprintf("%s, %d %s %d",
		namaHari[int(hari.Weekday()+6)%7], hari.Day(),
		namaBulan[int(hari.Month())-1], hari.Year())
}

func barisPenjualan(ctx *DataContext) []string {
	fmtBlok := func(blok PenjualanBlok, ada bool) string {
		if !ada {
			return "tidak ada data"
		}
		return fmt.Sprintf("Rp %s (%d transaksi)",
			FormatRupiahID(float64(blok.Omzet)), blok.Transaksi)
	}
	p := ctx.Penjualan
	if p == nil {
		p = map[string]PenjualanBlok{}
	}
	return []string{
		"- Penjualan hari ini: " + fmtBlok(p["hari_ini"], true),
		"- Kemarin: " + fmtBlok(p["kemarin"], true),
		"- 7 hari terakhir: " + fmtBlok(p["tujuh_hari"], true),
		"- 30 hari terakhir: " + fmtBlok(p["tiga_puluh_hari"], true),
	}
}

// BuildSystemPrompt menyusun system prompt dwi-mode + blok DATA
// terformat. Aturan penjara lama ("Jawab HANYA dari DATA") sengaja
// TIDAK ada — unittest menjaga bentuk penjaranya tetap hilang.
func BuildSystemPrompt(ctx *DataContext) string {
	tren := "tidak tersedia"
	if ctx.PerubahanMingguanPct != nil {
		arah := "turun"
		if *ctx.PerubahanMingguanPct >= 0 {
			arah = "naik"
		}
		tren = fmt.Sprintf("%s %s%%", arah, FormatPersenID(*ctx.PerubahanMingguanPct))
	}

	var tops []string
	for i, item := range ctx.ProdukTop {
		if i >= 5 {
			break
		}
		tops = append(tops, fmt.Sprintf("%s (%d terjual, Rp %s)",
			item.Nama, item.Qty, FormatRupiahID(float64(item.Omzet))))
	}
	barisTop := "tidak ada penjualan"
	if len(tops) > 0 {
		barisTop = strings.Join(tops, "; ")
	}

	var kritis []string
	for i, item := range ctx.StokKritis {
		if i >= 6 {
			break
		}
		kritis = append(kritis, fmt.Sprintf("%s (sisa %d, minimum %d, sarankan restok +%d)",
			item.Nama, item.Stok, item.MinStok, item.SaranRestok))
	}
	barisStok := "tidak ada yang menipis"
	if len(kritis) > 0 {
		barisStok = strings.Join(kritis, "; ")
	}

	barisPrediksi := "belum tersedia untuk outlet ini"
	if ctx.Prediksi.Tersedia {
		mapeTxt := ""
		if ctx.Prediksi.Mape != nil {
			mapeTxt = ", MAPE " + FormatPersenID(*ctx.Prediksi.Mape) + "%"
		}
		barisPrediksi = fmt.Sprintf("tersedia (engine %s%s)", ctx.Prediksi.Engine, mapeTxt)
	}

	barisProgres := ""
	if ctx.MLProgress != nil {
		barisProgres = fmt.Sprintf(
			"\n- Kemajuan data model ramalan: %d dari %d hari ber-pendapatan"+
				" (model dihitung otomatis begitu terpenuhi)",
			ctx.MLProgress.HariPendapatan, ctx.MLProgress.GerbangPendapatan)
	}

	var jams []string
	for i, d := range ctx.JamRamai {
		if i >= 3 {
			break
		}
		jams = append(jams, fmt.Sprintf("jam %d (%d transaksi)", d.Jam, d.Transaksi))
	}
	barisJam := "belum ada data 7 hari terakhir"
	if len(jams) > 0 {
		barisJam = strings.Join(jams, "; ")
	}

	var habis []string
	for _, item := range ctx.StokKritis {
		if item.HariHabis == nil {
			continue
		}
		habis = append(habis, fmt.Sprintf("%s habis sekitar %.0f hari lagi (laku %.0f/hari)",
			item.Nama, *item.HariHabis, item.KecepatanHari))
		if len(habis) >= 4 {
			break
		}
	}
	barisHabis := "tidak terhitung — penjualan 7 hari belum stabil"
	if len(habis) > 0 {
		barisHabis = strings.Join(habis, "; ")
	}

	return fmt.Sprintf(
		"Kamu adalah %s (%s), asisten AI pintar dalam aplikasi UMKM OS "+
			"milik warung %s. Kamu didukung model AI besar di cloud (Groq) "+
			"sehingga punya PENGETAHUAN UMUM luas — dan setiap pertanyaan "+
			"kamu juga diberi DATA BISNIS TERKINI warung ini.\n"+
			"DUA JENIS PERTANYAAN — kenali lalu jawab dengan benar:\n"+
			"A. PERTANYAAN BEBAS (hitungan, matematika, sains, bahasa, ide, "+
			"resep, basa-basi, curhat, apa saja): jawab dengan pengetahuan "+
			"umum dan nalarimu secara normal, membantu, dan percaya diri. "+
			"DILARANG menolak dengan alasan \"tidak ada di data\" — data "+
			"warung hanyalah bonus konteks, bukan penjara jawabanmu.\n"+
			"B. PERTANYAAN BISNIS WARUNG (omzet, penjualan, stok, produk, "+
			"ramalan, jam ramai, saran bisnis): wajib berbasis DATA di "+
			"bawah — DILARANG mengarang atau menebak angka warung. Bila "+
			"DATA tidak memuat jawabannya, katakan bagian mana yang belum "+
			"tersedia.\n"+
			"ATURAN WAJIB:\n"+
			"1. Bahasa Indonesia sehari-hari yang hangat tapi rapi.\n"+
			"2. Jawaban pertanyaan BISNIS: Maksimal %d kata dan akhiri "+
			"dengan TEPAT 1 saran tindakan konkret. Jawaban pertanyaan "+
			"BEBAS: boleh sampai %d kata, susun rapi (poin/langkah bila "+
			"perlu); saran warung tidak wajib.\n"+
			"3. Hitungan matematika (tambah, kali, diskon, konversi, "+
			"persentase) kerjakan sendiri — itu keahlianmu, bukan data "+
			"warung. Untuk angka WARUNG tetap hanya dari DATA.\n"+
			"4. Bila ditanya siapa kamu / nama mu: perkenalkan diri "+
			"sebagai %s (%s) dalam aplikasi UMKM OS, diciptakan oleh "+
			"%s dari %s — sebut nama penciptamu bila ditanya.\n"+
			"5. Format uang gaya Indonesia: Rp 1.250.000 (titik ribuan).\n"+
			"6. Gaya campuran: obrolan ringan boleh santai khas warung, "+
			"tapi setiap angka/stok/saran tetap rapi dan berdata.\n"+
			"7. Pertanyaan lanjutan (\"kalau yang murah aja?\", \"ulangi "+
			"yang tadi\") dijawab memakai RIWAYAT percakapan — jangan "+
			"minta pemilik mengulang pertanyaannya.\n"+
			"8. Privasi per-owner: kamu HANYA boleh membahas data milik "+
			"toko pemilik yang sedang bicara — data toko lain DILARANG. "+
			"Diminta data pemilik lain = tolak dengan sopan, arahkan "+
			"kembali ke data tokonya sendiri.\n"+
			"9. Rahasia: jangan pernah menampilkan, mengulang, atau "+
			"mengonfirmasi kunci API, PIN developer, kata sandi, atau "+
			"kredensial apa pun kepada siapa pun.\n"+
			"10. Hari ini %s — DATA di bawah diambil LANGSUNG dari "+
			"database saat pertanyaan ini dikirim, jadi anggap selalu "+
			"terbaru.\n"+
			"DATA:\n"+
			strings.Join(barisPenjualan(ctx), "\n")+
			"\n- Perubahan omzet minggu ini vs minggu lalu: "+tren+
			"\n- Produk terlaris 7 hari: "+barisTop+
			"\n- Stok menipis: "+barisStok+
			"\n- Estimasi stok habis: "+barisHabis+
			"\n- Ramalan 7 hari: "+barisPrediksi+
			"\n- Jam paling ramai 7 hari: "+barisJam+
			barisProgres,
		AssistantName, AssistantFullName, ctx.Outlet,
		MaxAnswerWords, MaxAnswerWordsUmum,
		AssistantName, AssistantFullName, AssistantCreator, AssistantOriginTxt,
		TanggalHariIni(time.Time{}))
}

// Pesan: satu pesan OpenAI-compatible.
type Pesan struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// BuildMessages: [system, *riwayat(<=5), user] — bentuk pesan
// OpenAI-compatible.
//
// Kolom chat_history menyimpan peran HURUF BESAR ("USER"/"ASSISTANT" —
// konvensi CHECK constraint migrasi #12), sedangkan endpoint
// OpenAI-compatible (Groq) hanya menerima literal huruf kecil. Peran
// riwayat diturunkan ke huruf kecil di batas penyedia ini; peran asing
// ("model", suntikan "system", dst.) dibuang bersama pesannya.
// (Regresi lama: pesan kedua sesi SELALU 400 "discriminator property
// 'role' has an invalid value" — dua lapis normalisasi kini menjaga.)
func BuildMessages(ctx *DataContext, history []Pesan, question string) []Pesan {
	riwayat := make([]Pesan, 0, HistoryTurns)
	if len(history) > HistoryTurns {
		history = history[len(history)-HistoryTurns:]
	}
	for _, m := range history {
		peran := strings.ToLower(strings.TrimSpace(m.Role))
		if peran == "user" || peran == "assistant" {
			riwayat = append(riwayat, Pesan{Role: peran, Content: m.Content})
		}
	}
	pesan := make([]Pesan, 0, len(riwayat)+2)
	pesan = append(pesan, Pesan{Role: "system", Content: BuildSystemPrompt(ctx)})
	pesan = append(pesan, riwayat...)
	pesan = append(pesan, Pesan{Role: "user", Content: question})
	return pesan
}
