package backup

// CADANGAN DATA (run-7, permintaan pemilik): "buat yang namanya backup
// data setiap saat, dan buat salinan database". Dua kebutuhan itu satu
// mesin: SALINAN menukar isi lewat berkas dump SQL gzip yang sama
// dengan yang dipakai tombol Cadangkan di Pengaturan.
//
// DUMP & PEMULIHAN MURNI GO (HOTFIX 2.1.1): versi 2.1.0 memanggil
// pg_dump eksternal dari image runtime — dan itu GAGAL di mesin
// pemilik dengan "server version mismatch; pg_dump version: 15.20
// (Debian), server version: 18.6" karena apt Debian bookworm hanya
// punya klien PostgreSQL 15 sementara compose menjalankan PostgreSQL
// 18 (pg_dump menolak beda versi mayor, titik). Versi klien apt tidak
// akan pernah bisa dijamin mengikuti versi server compose — maka
// seluruh cadangan kini dikerjakan KODE GO dan tidak memanggil alat
// luar sama sekali:
//
//   - daftar tabel + tipe kolom + kunci primer + foreign key dibaca
//     dari katalog (information_schema / pg_attribute / pg_constraint
//     / pg_sequences);
//   - urutan DROP = topo-BALIK (anak dulu), urutan INSERT = topo-MAJU
//     (induk dulu) supaya foreign key terpenuhi tanpa mematikan
//     pemicu;
//   - DDL di-emit dari internal/schema — SATU sumber kebenaran dengan
//     migrasi boot; seluruhnya IF NOT EXISTS sehingga replay aman;
//   - nilai baris dikirim sebagai ::text oleh server lalu ditulis
//     kembali sebagai literal '<nilai>'::<tipe kolom> — satu jalur
//     yang sama untuk TIPE APA PUN (bytea hex, timestamptz beroffset,
//     numeric, jsonb...) karena server sendiri yang merender teks
//     kanoniknya;
//   - berkas tetap SQL polos gzip: bisa dibaca manusia, dan tetap
//     bisa diterapkan lewat psql manual bila pemilik mau;
//   - PEMULIHAN: satu pesan simple-protocol membawa SELURUH isi
//     berkas — PostgreSQL mengeksekusi multi-pernyataan dalam SATU
//     transaksi implisit (semua-atau-tidak-sama-sekali; padanan
//     ON_ERROR_STOP plus rollback otomatis).
//
// Loop otomatis (BACKUP_INTERVAL_SECONDS) + retensi (BACKUP_KEEP)
// menjaga "setiap saat" tanpa pemilik menekan apa pun; endpoint
// POST /admin/backup/run + tombol di Pengaturan menjaga "kapan pun"
// secara sadar. Restore sengaja EKSPILISIT (tidak pernah otomatis ke
// node hidup kecuali oleh sinkron balik yang terkunci) supaya tidak
// ada dump lama yang menimpa transaksi warung diam-diam.

import (
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/neuralforgeio/internal/config"
	"github.com/neuralforgeio/internal/schema"
)

// NamaBerkas: umkm-backup-YYYYMMDD-HHMMSS.sql.gz di zona waktu server
// (compose memasang TZ Asia/Jakarta — nama berkas bicara waktu
// warung, bukan waktu UTC container).
func NamaBerkas(now time.Time) string {
	return fmt.Sprintf("umkm-backup-%s.sql.gz", now.Format("20060102-150405"))
}

// ---- introspeksi katalog -------------------------------------------------

type kolom struct {
	Nama string
	Tipe string // format_type(oid, typmod), mis. "bigint", "timestamp with time zone"
}

type tabel struct {
	Nama  string
	Kolom []kolom
	PK    []string
}

// sambung: koneksi pgx biasa (bukan pool) untuk satu pekerjaan dump.
func sambung(ctx context.Context, databaseURL string) (*pgx.Conn, error) {
	return pgx.Connect(ctx, databaseURL)
}

// daftarTabel: seluruh tabel BASE TABLE skema public beserta tipe
// kolom + kunci primernya (dipakai untuk ORDER BY deterministik).
func daftarTabel(ctx context.Context, conn *pgx.Conn) ([]tabel, error) {
	baris, err := conn.Query(ctx, `
		SELECT table_name FROM information_schema.tables
		WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
		ORDER BY table_name`)
	if err != nil {
		return nil, fmt.Errorf("gagal membaca daftar tabel: %w", err)
	}
	nama, err := pgx.CollectRows(baris, pgx.RowTo[string])
	if err != nil {
		return nil, err
	}
	hasil := make([]tabel, 0, len(nama))
	for _, n := range nama {
		t := tabel{Nama: n}
		kol, err := conn.Query(ctx, `
			SELECT a.attname, format_type(a.atttypid, a.atttypmod)
			FROM pg_attribute a
			WHERE a.attrelid = format('public.%I', $1::text)::regclass
			  AND a.attnum > 0 AND NOT a.attisdropped
			ORDER BY a.attnum`, n)
		if err != nil {
			return nil, fmt.Errorf("gagal membaca kolom %s: %w", n, err)
		}
		k, err := pgx.CollectRows(kol, pgx.RowToFunc[kolom](func(r pgx.CollectableRow) (kolom, error) {
			var c kolom
			return c, r.Scan(&c.Nama, &c.Tipe)
		}))
		if err != nil {
			return nil, err
		}
		t.Kolom = k

		pk, err := conn.Query(ctx, `
			SELECT a.attname
			FROM pg_index i
			JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
			WHERE i.indrelid = format('public.%I', $1::text)::regclass AND i.indisprimary
			ORDER BY a.attnum`, n)
		if err != nil {
			return nil, fmt.Errorf("gagal membaca PK %s: %w", n, err)
		}
		t.PK, err = pgx.CollectRows(pk, pgx.RowTo[string])
		if err != nil {
			return nil, err
		}
		hasil = append(hasil, t)
	}
	return hasil, nil
}

// urutanTopo: susun tabel mengikuti foreign key (induk lebih dulu).
// Siklus = galat keras (skema berubah jadi sesuatu yang butuh pikir
// ulang; lebih baik gagal jujur daripada cadangan setengah-benar).
func urutanTopo(tabelSemua []tabel, tepi [][2]string) ([]string, error) {
	namaSet := map[string]bool{}
	for _, t := range tabelSemua {
		namaSet[t.Nama] = true
	}
	dipakai := map[string]int{} // anak -> sisa induk yang belum diproses
	anakDari := map[string][]string{}
	for _, e := range tepi {
		if !namaSet[e[0]] || !namaSet[e[1]] {
			continue // rujukan ke tabel di luar skema public
		}
		if e[0] == e[1] {
			continue // self-FK tidak memengaruhi urutan antar tabel
		}
		dipakai[e[1]]++
		anakDari[e[0]] = append(anakDari[e[0]], e[1])
	}
	var siap []string
	for _, t := range tabelSemua {
		if dipakai[t.Nama] == 0 {
			siap = append(siap, t.Nama)
		}
	}
	sort.Strings(siap) // deterministik
	urut := make([]string, 0, len(tabelSemua))
	for len(siap) > 0 {
		n := siap[0]
		siap = siap[1:]
		urut = append(urut, n)
		for _, anak := range anakDari[n] {
			dipakai[anak]--
			if dipakai[anak] == 0 {
				siap = append(siap, anak)
				sort.Strings(siap)
			}
		}
	}
	if len(urut) != len(tabelSemua) {
		return nil, fmt.Errorf("foreign key membentuk siklus antar tabel - urutan dump tidak bisa disusun")
	}
	return urut, nil
}

// kutipIdent: pengaman nama tabel/kolom di SQL.
func kutipIdent(s string) string {
	return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
}

// literalSQL: nilai ::text dari server -> literal SQL dengan cast
// kembali ke tipe kolomnya. NULL ditangani pemanggil (bukan di sini).
// Tanda kutip tunggal digandakan; backslash dibiarkan literal karena
// standard_conforming_strings aktif (default PostgreSQL >= 9.1) baik
// di jalur pemulihan Go maupun psql manual.
func literalSQL(nilai, tipe string) string {
	return `'` + strings.ReplaceAll(nilai, `'`, `''`) + `'::` + tipe
}

// ---- dump ----------------------------------------------------------------

// Dump: cadangkan SATU node (databaseURL) menjadi umkm-backup-*.sql.gz
// di dir. Seluruh proses di atas koneksi pgx tunggal, murni Go.
func Dump(ctx context.Context, dir, databaseURL string, now time.Time) (string, int64, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", 0, fmt.Errorf("gagal membuat folder backup: %w", err)
	}
	conn, err := sambung(ctx, databaseURL)
	if err != nil {
		return "", 0, fmt.Errorf("gagal menghubungi node database: %w", err)
	}
	defer conn.Close(ctx)

	tabelSemua, err := daftarTabel(ctx, conn)
	if err != nil {
		return "", 0, err
	}

	// RUN-9: hanya tabel APLIKASI yang boleh masuk cadangan. Database
	// warung pemilik nyatanya memuat tabel sisa alat lain (contoh nyata
	// dari mesin produksi: public._prisma_migrations era demo Prisma)
	// yang tidak punya CREATE di schema.Pernyataan — menulis INSERT-nya
	// tanpa CREATE membuat pemulihan ke node kosong gagal 42P01. Set
	// tabel diturunkan dari teks migrasi (satu sumber kebenaran), jadi
	// daftar ini tidak pernah basi.
	tabelApp := schema.TabelSet()
	terdaftar := make([]tabel, 0, len(tabelSemua))
	for _, t := range tabelSemua {
		if tabelApp[t.Nama] {
			terdaftar = append(terdaftar, t)
		}
	}
	tabelSemua = terdaftar
	// Sequence aplikasi: <tabel>_id_seq milik BIGSERIAL tiap tabel
	// aplikasi + receipt_seq mandiri (lihat Pernyataan). Sequence milik
	// tabel non-aplikasi ikut disaring di bawah.
	seqApp := map[string]bool{"receipt_seq": true}
	for n := range tabelApp {
		seqApp[n+"_id_seq"] = true
	}

	// Foreign key: (induk, anak) dari pg_constraint (confrelid ->
	// conrelid). regclass::text menghasilkan "public.nama" untuk
	// skema kita — prefix dibuang agar cocok dengan nama polos.
	fk, err := conn.Query(ctx, `
		SELECT confrelid::regclass::text, conrelid::regclass::text
		FROM pg_constraint
		WHERE contype = 'f' AND connamespace = 'public'::regnamespace`)
	if err != nil {
		return "", 0, fmt.Errorf("gagal membaca foreign key: %w", err)
	}
	tepi, err := pgx.CollectRows(fk, pgx.RowToFunc[[2]string](func(r pgx.CollectableRow) ([2]string, error) {
		var e [2]string
		return e, r.Scan(&e[0], &e[1])
	}))
	if err != nil {
		return "", 0, err
	}
	for i := range tepi {
		tepi[i][0] = strings.TrimPrefix(tepi[i][0], "public.")
		tepi[i][1] = strings.TrimPrefix(tepi[i][1], "public.")
	}

	urut, err := urutanTopo(tabelSemua, tepi)
	if err != nil {
		return "", 0, err
	}

	// Sequences (milik BIGSERIAL + receipt_seq mandiri) + kondisinya.
	// Hanya sequence APLIKASI (seqApp di atas) — sequence milik tabel
	// legacy alat lain tidak punya DROP/CREATE jaminan di schema.
	type seq struct {
		Nama     string
		Mulai    int64
		Terakhir *int64 // NULL = belum pernah dipakai
	}
	seqs, err := conn.Query(ctx, `
		SELECT sequencename, start_value, last_value
		FROM pg_sequences WHERE schemaname = 'public' ORDER BY sequencename`)
	if err != nil {
		return "", 0, fmt.Errorf("gagal membaca sequences: %w", err)
	}
	semuaSeq, err := pgx.CollectRows(seqs, pgx.RowToFunc[seq](func(r pgx.CollectableRow) (seq, error) {
		var s seq
		return s, r.Scan(&s.Nama, &s.Mulai, &s.Terakhir)
	}))
	if err != nil {
		return "", 0, err
	}
	terdaftarSeq := make([]seq, 0, len(semuaSeq))
	for _, s := range semuaSeq {
		if seqApp[s.Nama] {
			terdaftarSeq = append(terdaftarSeq, s)
		}
	}
	semuaSeq = terdaftarSeq

	nama := NamaBerkas(now)
	sementara := filepath.Join(dir, nama+".tmp")
	f, err := os.Create(sementara)
	if err != nil {
		return "", 0, fmt.Errorf("gagal membuka berkas sementara: %w", err)
	}
	gz := gzip.NewWriter(f)

	tulis := func(s string) error {
		_, err := gz.Write([]byte(s))
		return err
	}
	var buf bytes.Buffer
	tulisBaris := func(format string, a ...interface{}) error {
		buf.Reset()
		fmt.Fprintf(&buf, format, a...)
		buf.WriteByte('\n')
		_, err := gz.Write(buf.Bytes())
		return err
	}

	if err := tulisBaris("-- UMKM OS cadangan database"); err != nil {
		return gagalTulis(f, gz, sementara, err)
	}
	if err := tulisBaris("-- dibuat: %s | node: %s | app %s",
		now.Format("2006-01-02 15:04:05 -0700"), config.DatabaseNodeName(), config.AppVersion); err != nil {
		return gagalTulis(f, gz, sementara, err)
	}

	// (1) DROP: tabel urutan topo-BALIK (anak dulu), lalu semua
	// sequence — supaya berkas bisa diterapkan ke node yang SUDAH
	// terisi tanpa bentrok.
	for i := len(urut) - 1; i >= 0; i-- {
		if err := tulisBaris("DROP TABLE IF EXISTS public.%s CASCADE;", kutipIdent(urut[i])); err != nil {
			return gagalTulis(f, gz, sementara, err)
		}
	}
	for _, s := range semuaSeq {
		if err := tulisBaris("DROP SEQUENCE IF EXISTS public.%s CASCADE;", kutipIdent(s.Nama)); err != nil {
			return gagalTulis(f, gz, sementara, err)
		}
	}

	// (2) DDL: replay SATU sumber kebenaran migrasi (idempotent).
	// Pernyataan migrasi diinternal/schema TIDAK memuat titik-koma
	// (db.Connect mengeksekusinya satu per satu) - di sini emit
	// beruntun, jadi ; ditambahkan per pernyataan.
	for _, stmt := range schema.Pernyataan {
		if err := tulis(strings.TrimRight(stmt, "; \t\n") + ";\n"); err != nil {
			return gagalTulis(f, gz, sementara, err)
		}
	}

	// (2b) RUN-10 - DDL REKON: kolom yang di-dump DIJAMIN ADA di
	// tujuan. Pelajaran run-9 (42703 ip_address): dump memindahkan
	// data dengan KOLOM SEKARANG-NYA (dari katalog sumber), tapi
	// node tujuan hanya menjalankan Pernyataan - bila sumber lebih
	// tua dari migrasi aplikasi (kolom demo era lama seperti
	// audit_logs.ip_address yang tak pernah di-CREATE oleh aplikasi
	// sekarang), INSERT-nya mati "column does not exist". DDL kini
	// BERSIFAT MENJELASKAN-DIRI: tiap kolom yang benar-benar di-dump
	// dijamin hadir lewat ALTER ... ADD COLUMN IF NOT EXISTS dengan
	// tipe yang DIBACA DARI KATALOG SUMBER (bukan daftar tangan -
	// daftar tangan berumur pendek). Kolom tanpa NOT NULL di sumber
	// dibiarkan nullable; kolom legacy TIDAK pernah dihapus di sumber
	// (dump tidak mengubah node aktif sama sekali).
	for _, namaTabel := range urut {
		var t *tabel
		for i := range tabelSemua {
			if tabelSemua[i].Nama == namaTabel {
				t = &tabelSemua[i]
				break
			}
		}
		if t == nil {
			continue
		}
		for _, c := range t.Kolom {
			if err := tulisBaris("ALTER TABLE public.%s ADD COLUMN IF NOT EXISTS %s %s;",
				kutipIdent(t.Nama), kutipIdent(c.Nama), c.Tipe); err != nil {
				return gagalTulis(f, gz, sementara, err)
			}
		}
	}

	// (3) DATA: INSERT urutan topo-MAJU (induk dulu) — foreign key
	// terpenuhi tanpa mematikan pemicu. Nilai dibaca sebagai ::text
	// (server merender kanonik: bytea hex, offset zona waktu, dst)
	// lalu dikutip dengan cast balik ke tipe kolom.
	jumlahBaris := 0
	for _, namaTabel := range urut {
		var t *tabel
		for i := range tabelSemua {
			if tabelSemua[i].Nama == namaTabel {
				t = &tabelSemua[i]
				break
			}
		}
		if t == nil || len(t.Kolom) == 0 {
			continue
		}
		pilih := make([]string, 0, len(t.Kolom))
		for _, c := range t.Kolom {
			pilih = append(pilih, kutipIdent(c.Nama)+"::text")
		}
		dari := "SELECT " + strings.Join(pilih, ", ") + " FROM public." + kutipIdent(t.Nama)
		if len(t.PK) > 0 {
			urutkan := make([]string, 0, len(t.PK))
			for _, c := range t.PK {
				urutkan = append(urutkan, kutipIdent(c))
			}
			dari += " ORDER BY " + strings.Join(urutkan, ", ")
		}
		barisan, err := conn.Query(ctx, dari)
		if err != nil {
			return "", 0, fmt.Errorf("gagal membaca baris %s: %w", t.Nama, err)
		}
		// Baris multi-kolom: Values() memberi seluruh kolom sebagai
		// []any (pengganti RowTo yang satu-tujuan).
		payung, err := pgx.CollectRows(barisan, pgx.RowToFunc[[]any](func(r pgx.CollectableRow) ([]any, error) {
			return r.Values()
		}))
		if err != nil {
			return "", 0, fmt.Errorf("gagal memindai baris %s: %w", t.Nama, err)
		}
		if len(payung) == 0 {
			continue
		}
		jumlahBaris += len(payung)
		kolomNama := make([]string, 0, len(t.Kolom))
		for _, c := range t.Kolom {
			kolomNama = append(kolomNama, kutipIdent(c.Nama))
		}
		kepala := "INSERT INTO public." + kutipIdent(t.Nama) + " (" + strings.Join(kolomNama, ", ") + ") VALUES"
		const perBatch = 100
		for awal := 0; awal < len(payung); awal += perBatch {
			akhir := awal + perBatch
			if akhir > len(payung) {
				akhir = len(payung)
			}
			var b bytes.Buffer
			b.WriteString(kepala)
			for i := awal; i < akhir; i++ {
				if i > awal {
					b.WriteString(",\n")
				} else {
					b.WriteString("\n")
				}
				b.WriteString("  (")
				for j, v := range payung[i] {
					if j > 0 {
						b.WriteString(", ")
					}
					switch nilai := v.(type) {
					case nil:
						b.WriteString("NULL")
					case string:
						b.WriteString(literalSQL(nilai, t.Kolom[j].Tipe))
					default:
						// ::text membuat server selalu mengirim string
						// (atau NULL); tipe lain berarti skema berubah
						// menjadi sesuatu yang belum dipikirkan — gagal
						// jujur lebih baik daripada cadangan diam-diam
						// salah.
						return "", 0, fmt.Errorf("tipe nilai tak didukung dump pada %s.%s: %T",
							t.Nama, t.Kolom[j].Nama, v)
					}
				}
				b.WriteString(")")
			}
			b.WriteString(";\n")
			if err := tulis(b.String()); err != nil {
				return gagalTulis(f, gz, sementara, err)
			}
		}
	}

	// (4) Sequences dipulihkan ke kondisi sumber: setval menyetel
	// ulang penomoran berikutnya sesuai last_value saat dump.
	for _, s := range semuaSeq {
		if s.Terakhir != nil {
			if err := tulisBaris("SELECT setval('public.%s', %d, true);", kutipIdent(s.Nama), *s.Terakhir); err != nil {
				return gagalTulis(f, gz, sementara, err)
			}
		} else if err := tulisBaris("SELECT setval('public.%s', %d, false);", kutipIdent(s.Nama), s.Mulai); err != nil {
			return gagalTulis(f, gz, sementara, err)
		}
	}

	if err := tulisBaris("-- akhir cadangan; %d baris data", jumlahBaris); err != nil {
		return gagalTulis(f, gz, sementara, err)
	}
	if err := gz.Close(); err != nil {
		f.Close()
		os.Remove(sementara)
		return "", 0, fmt.Errorf("gagal menutup gzip: %w", err)
	}
	if err := f.Close(); err != nil {
		os.Remove(sementara)
		return "", 0, fmt.Errorf("gagal menutup berkas: %w", err)
	}
	akhir := filepath.Join(dir, nama)
	if err := os.Rename(sementara, akhir); err != nil {
		os.Remove(sementara)
		return "", 0, fmt.Errorf("gagal memfinalkan berkas backup: %w", err)
	}
	info, err := os.Stat(akhir)
	if err != nil {
		return "", 0, fmt.Errorf("gagal membaca ukuran backup: %w", err)
	}
	return nama, info.Size(), nil
}

// gagalTulis: bersih-bersih saat penulisan dump gagal di tengah.
func gagalTulis(f *os.File, gz *gzip.Writer, sementara string, err error) (string, int64, error) {
	_ = gz.Close()
	_ = f.Close()
	os.Remove(sementara)
	return "", 0, fmt.Errorf("gagal menulis cadangan: %w", err)
}

// ---- daftar / retensi ----------------------------------------------------

// Info: satu berkas backup di daftar.
type Info struct {
	Nama   string `json:"nama"`
	Ukuran int64  `json:"ukuran"`
	Dibuat string `json:"dibuat"`
}

// Daftar: seluruh berkas umkm-backup-*.sql.gz di dir, terbaru dulu.
// Waktu dibaca dari nama berkas (stempel saat dump DIBUAT — bukan
// saat berkas disalin).
func Daftar(dir string) ([]Info, error) {
	entry, err := os.ReadDir(dir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []Info{}, nil
		}
		return nil, fmt.Errorf("gagal membaca folder backup: %w", err)
	}
	hasil := []Info{}
	for _, e := range entry {
		nama := e.Name()
		if e.IsDir() || !strings.HasPrefix(nama, "umkm-backup-") || !strings.HasSuffix(nama, ".sql.gz") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		hasil = append(hasil, Info{
			Nama:   nama,
			Ukuran: info.Size(),
			Dibuat: WaktuDariNama(nama),
		})
	}
	sort.Slice(hasil, func(i, j int) bool {
		// Urutkan menurut stempel waktu yang dienkode NAMA (bukan
		// alfabet mentah): berkas tanpa stempel sah jatuh ke bawah.
		kunciI, sahI := kunciUrut(hasil[i].Nama)
		kunciJ, sahJ := kunciUrut(hasil[j].Nama)
		if sahI != sahJ {
			return sahI // berkas ber-stempel sah selalu di atas
		}
		if kunciI != kunciJ {
			return kunciI > kunciJ
		}
		return hasil[i].Nama > hasil[j].Nama
	})
	return hasil, nil
}

// WaktuDariNama: "umkm-backup-20261117-101530.sql.gz" -> "2026-11-17 10:15:30".
// Nama yang tak dikenali tetap dikembalikan apa adanya (kolom teks).
func WaktuDariNama(nama string) string {
	if len(nama) >= len("umkm-backup-YYYYMMDD-HHMMSS.sql.gz") {
		s := nama[len("umkm-backup-"):]
		if len(s) >= 15 {
			return fmt.Sprintf("%s-%s-%s %s:%s:%s",
				s[0:4], s[4:6], s[6:8], s[9:11], s[11:13], s[13:15])
		}
	}
	return nama
}

// kunciUrut: "umkm-backup-20260103-141516.sql.gz" -> "20260103141516"
// (dibandingkan string, monotonik); nama tanpa pola itu = tidak sah.
func kunciUrut(nama string) (string, bool) {
	if !strings.HasPrefix(nama, "umkm-backup-") || !strings.HasSuffix(nama, ".sql.gz") {
		return "", false
	}
	s := strings.TrimSuffix(strings.TrimPrefix(nama, "umkm-backup-"), ".sql.gz")
	if len(s) != len("YYYYMMDD-HHMMSS") || s[8] != '-' {
		return "", false
	}
	return s[:8] + s[9:], true
}

// Retensi: hapus berkas tertua di luar keep terbaru. keep <= 0 = tanpa
// retensi.
func Retensi(dir string, keep int) (int, error) {
	if keep <= 0 {
		return 0, nil
	}
	daftar, err := Daftar(dir)
	if err != nil {
		return 0, err
	}
	terhapus := 0
	for _, b := range daftar[keep:] {
		if err := os.Remove(filepath.Join(dir, b.Nama)); err == nil {
			terhapus++
		}
	}
	return terhapus, nil
}

// ---- pemulihan -----------------------------------------------------------

// Terapkan (restore): terapkan berkas dump SQL gzip ke node
// databaseURL. MURNI GO: berkas dibuka, digunzip di memori, lalu
// SELURUH isi dikirim sebagai satu pesan simple-protocol —
// PostgreSQL mengeksekusi multi-pernyataan dalam SATU transaksi
// implisit (semua-atau-tidak-sama-sekali; padanan ON_ERROR_STOP plus
// rollback otomatis). Nama divalidasi tanpa separator supaya endpoint
// ini tidak bisa dipakai membaca berkas lain di disk.
func Terapkan(ctx context.Context, dir, nama, databaseURL string) error {
	if strings.Contains(nama, "/") || strings.Contains(nama, "\\") || !strings.HasSuffix(nama, ".sql.gz") {
		return fmt.Errorf("nama berkas backup tidak sah: %q", nama)
	}
	berkas := filepath.Join(dir, nama)
	f, err := os.Open(berkas)
	if err != nil {
		return fmt.Errorf("berkas backup tidak ada: %s", nama)
	}
	defer f.Close()
	gz, err := gzip.NewReader(f)
	if err != nil {
		return fmt.Errorf("berkas cadangan bukan gzip yang sah: %w", err)
	}
	defer gz.Close()
	sqlB, err := io.ReadAll(gz)
	if err != nil {
		return fmt.Errorf("gagal membaca isi cadangan: %w", err)
	}

	cfg, err := pgx.ParseConfig(databaseURL)
	if err != nil {
		return fmt.Errorf("DATABASE_URL tidak valid: %w", err)
	}
	// Simple protocol: satu pesan Query membawa seluruh dump sebagai
	// multi-pernyataan — server membungkusnya transaksi implisit.
	cfg.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	conn, err := pgx.ConnectConfig(ctx, cfg)
	if err != nil {
		return fmt.Errorf("gagal menghubungi node tujuan: %w", err)
	}
	defer conn.Close(ctx)
	if _, err := conn.Exec(ctx, string(sqlB)); err != nil {
		return fmt.Errorf("pemulihan berhenti di tengah (transaksi implisit di-rollback): %w", err)
	}
	return nil
}

// ---- orkestrasi ----------------------------------------------------------

// Jalankan: satu putaran penuh — dump + retensi. Dipakai handler
// manual (tombol) maupun loop otomatis supaya keduanya identik.
func Jalankan(ctx context.Context, dir, databaseURL string, keep int) (string, int64, int, error) {
	nama, ukuran, err := Dump(ctx, dir, databaseURL, time.Now())
	if err != nil {
		return "", 0, 0, err
	}
	terhapus, err := Retensi(dir, keep)
	if err != nil {
		return nama, ukuran, 0, err
	}
	return nama, ukuran, terhapus, nil
}

// Loop: backup otomatis latar belakang. interval <= 0 = mati (dipanggil
// sekali lalu langsung pulang — tetap jalan supaya pemanggil tak perlu
// bercabang). berhenti ditutup oleh pemanggil saat shutdown.
func Loop(berhenti <-chan struct{}, dir, databaseURL string, interval time.Duration, keep int) {
	if interval <= 0 {
		return
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-berhenti:
			return
		case <-ticker.C:
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
			if _, _, _, err := Jalankan(ctx, dir, databaseURL, keep); err != nil {
				fmt.Fprintf(os.Stderr, "[backup] otomatis gagal: %v\n", err)
			}
			cancel()
		}
	}
}

// SinkronBalik (run-7): pulangkan perubahan zaman-salinan ke pusat:
// dump node AKTIF (dari) -> terapkan ke node PULIH (ke). Terkunci di
// sisi pemanggil (db.sinkronBalikKePusat memegang mutex).
func SinkronBalik(ctx context.Context, dari, ke string) error {
	dir, err := os.MkdirTemp("", "sinkron-balik-*")
	if err != nil {
		return fmt.Errorf("gagal membuat folder sementara: %w", err)
	}
	defer os.RemoveAll(dir)
	nama, _, err := Dump(ctx, dir, dari, time.Now())
	if err != nil {
		return fmt.Errorf("dump node aktif gagal: %w", err)
	}
	if err := Terapkan(ctx, dir, nama, ke); err != nil {
		return fmt.Errorf("penerapan ke pusat gagal: %w", err)
	}
	return nil
}
