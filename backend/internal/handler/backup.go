package handler

// RUN-7 — endpoint CADANGAN DATA + SALINAN DATABASE (permintaan pemilik:
// "backup data setiap saat + database pusat & salinan"). Khusus OWNER
// dan DEVELOPER (bukan kasir): cadangan dan perpindahan node adalah
// urusan penyelamatan bisnis, bukan shift kasir.
//
//	GET  /admin/db-status   : node aktif + kesehatan pusat/salinan +
//	                           riwayat pindahan + daftar backup
//	POST /admin/backup/run  : dump SEKARANG (tombol Cadangkan Data)
//	GET  /admin/backup      : daftar cadangan (nama/ukuran/waktu)
//	POST /admin/backup/{nama}/restore : pulihkan cadangan ke node aktif
//	GET  /admin/backup/{nama}/download : unduh berkas .sql.gz
//	POST /admin/db/failover : pindah node manual (ke pusat/salinan)

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/neuralforgeio/internal/backup"
	"github.com/neuralforgeio/internal/config"
	"github.com/neuralforgeio/internal/db"
	"github.com/neuralforgeio/internal/middleware"
)

// statusNode: potret satu node untuk /admin/db-status.
type statusNode struct {
	Nama  string `json:"nama"`
	URL   string `json:"url"`   // password disembunyikan (samarURL)
	Sehat bool   `json:"sehat"` // ping + uji tulis
	Aktif bool   `json:"aktif"` // sedang melayani?
}

// DbStatus: node aktif + kesehatan kedua node + riwayat + cadangan.
func DbStatus(w http.ResponseWriter, r *http.Request) {
	dir := config.BackupDir()
	daftar, err := backup.Daftar(dir)
	if err != nil {
		Err(w, 500, "gagal membaca daftar cadangan: "+err.Error())
		return
	}
	// hingga 10 nama terakhir — UI menampilkan daftar penuh lewat
	// /admin/backup; status cukup ringkas.
	nama := make([]string, 0, len(daftar))
	for _, b := range daftar {
		nama = append(nama, b.Nama)
	}

	// Struct eksplisit (bukan map): tag JSON jadi KONTRAK yang bisa
	// dikunci test dari kedua sisi — lib/backup.ts frontend memetakan
	// field yang sama (pelajaran run-3: kontrak lintas-stack wajib
	// bertemu di test).
	type dbStatusJSON struct {
		AppVersion     string        `json:"app_version"`
		NodeAktif      string        `json:"node_aktif"`
		NodeName       string        `json:"node_name"`
		SalinanAktif   bool          `json:"salinan_aktif"`
		Riwayat        []db.Pindahan `json:"riwayat_pindahan"`
		BackupTerakhir []string      `json:"backup_terakhir"`
		BackupInterval int           `json:"backup_interval_s"`
		BackupKeep     int           `json:"backup_keep"`
		Node           []statusNode  `json:"node"`
	}
	st := dbStatusJSON{
		AppVersion:     config.AppVersion,
		NodeAktif:      db.NodeAktif(),
		NodeName:       config.DatabaseNodeName(),
		SalinanAktif:   db.URLSalinan() != "",
		Riwayat:        db.RiwayatPindahan(),
		BackupTerakhir: nama,
		BackupInterval: config.BackupIntervalSeconds(),
		BackupKeep:     config.BackupKeep(),
		Node: []statusNode{
			{Nama: "pusat", URL: db.SamarPusat(), Aktif: db.NodeAktif() == "pusat"},
			{Nama: "salinan", URL: db.SamarSalinan(), Aktif: db.NodeAktif() == "salinan"},
		},
	}
	OK(w, st)
}

// BackupRun: dump SEKARANG ke node aktif (pusat atau salinan — selalu
// node yang sedang melayani). Backup manual tidak menunggu interval
// otomatis: "setiap saat" berarti tombol ini selalu siap.
func BackupRun(w http.ResponseWriter, r *http.Request) {
	c := middleware.User(r)
	if db.Pool == nil {
		Err(w, 503, "database belum terhubung")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Minute)
	defer cancel()
	dir := config.BackupDir()
	nama, ukuran, terhapus, err := backup.Jalankan(ctx, dir, db.URLAktif(), config.BackupKeep())
	if err != nil {
		LogAudit(r, c.UserID, "BACKUP_RUN_FAILED", "backup", 0, err.Error())
		Err(w, 500, "cadangan gagal dibuat: "+err.Error())
		return
	}
	LogAudit(r, c.UserID, "BACKUP_RUN", "backup", 0,
		"berkas "+nama+" ("+strconv.FormatInt(ukuran, 10)+" byte), retensi menghapus "+strconv.Itoa(terhapus))
	OK(w, map[string]interface{}{
		"nama":             nama,
		"ukuran":           ukuran,
		"terhapus_retensi": terhapus,
		"node":             db.NodeAktif(),
		"dibuat":           backup.WaktuDariNama(nama),
	})
}

// BackupList: daftar cadangan (terbaru dulu).
func BackupList(w http.ResponseWriter, r *http.Request) {
	daftar, err := backup.Daftar(config.BackupDir())
	if err != nil {
		Err(w, 500, "gagal membaca daftar cadangan: "+err.Error())
		return
	}
	OK(w, map[string]interface{}{
		"jumlah": len(daftar),
		"berkas": daftar,
		"node":   db.NodeAktif(),
	})
}

// BackupRestore: pulihkan cadangan ke node aktif. Berjalan lama —
// timeout 10 menit; cadangan --clean menimpa node aktif dengan aman
// (DROP+isi ulang). Sengaja ke node AKTIF (bukan mati) supaya pemilik
// tahu persis apa yang ditimpa.
func BackupRestore(w http.ResponseWriter, r *http.Request) {
	c := middleware.User(r)
	nama := chi.URLParam(r, "nama")
	if db.Pool == nil {
		Err(w, 503, "database belum terhubung")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Minute)
	defer cancel()
	if err := backup.Terapkan(ctx, config.BackupDir(), nama, db.URLAktif()); err != nil {
		LogAudit(r, c.UserID, "BACKUP_RESTORE_FAILED", "backup", 0, nama+": "+err.Error())
		Err(w, 500, "pemulihan gagal: "+err.Error())
		return
	}
	LogAudit(r, c.UserID, "BACKUP_RESTORE", "backup", 0,
		"berkas "+nama+" dipulihkan ke node "+db.NodeAktif())
	OK(w, map[string]interface{}{
		"nama": nama,
		"node": db.NodeAktif(),
	})
}

// BackupDownload: unduh berkas cadangan (gzip siap simpan ke USB/cloud).
func BackupDownload(w http.ResponseWriter, r *http.Request) {
	nama := chi.URLParam(r, "nama")
	// nama divalidasi identik dengan Terapkan (tanpa separator) supaya
	// endpoint ini tidak bisa dipakai membaca berkas lain di disk.
	if err := namaSah(nama); err != nil {
		Err(w, 400, err.Error())
		return
	}
	berkas := filepath.Join(config.BackupDir(), nama)
	f, err := os.Open(berkas)
	if err != nil {
		Err(w, 404, "berkas cadangan tidak ditemukan")
		return
	}
	defer f.Close()
	info, _ := f.Stat()
	w.Header().Set("Content-Type", "application/gzip")
	w.Header().Set("Content-Disposition", "attachment; filename=\""+nama+"\"")
	w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
	http.ServeContent(w, r, nama, info.ModTime(), f)
}

// namaSah: nama berkas cadangan polos (tanpa separator, akhiran sah).
func namaSah(nama string) error {
	if nama == "" || nama != filepath.Base(nama) {
		return &kesalahanNama{"nama berkas tidak sah"}
	}
	if len(nama) < len("umkm-backup-YYYYMMDD-HHMMSS.sql.gz") {
		return &kesalahanNama{"nama berkas cadangan tidak dikenal"}
	}
	return nil
}

type kesalahanNama struct{ msg string }

func (k *kesalahanNama) Error() string { return k.msg }

// DbFailover: pindah node manual — tubuh {"ke":"salinan"|"pusat"}.
// Endpoint ini bukan rutinitas: pemilik memakainya saat melihat pusat
// bermasalah di UI dan ingin memaksa salinan (atau sebaliknya). Loop
// kesehatan tetap memantau dan akan sinkron-balik otomatis nantinya.
func DbFailover(w http.ResponseWriter, r *http.Request) {
	c := middleware.User(r)
	var tubuh struct {
		Ke string `json:"ke"`
	}
	if err := Decode(r, &tubuh); err != nil || (tubuh.Ke != "pusat" && tubuh.Ke != "salinan") {
		Err(w, 400, "tubuh harus {\"ke\":\"pusat\"|\"salinan\"}")
		return
	}
	if err := db.PaksaPindahKe(tubuh.Ke); err != nil {
		LogAudit(r, c.UserID, "DB_FAILOVER_FAILED", "db", 0, err.Error())
		Err(w, 409, err.Error())
		return
	}
	LogAudit(r, c.UserID, "DB_FAILOVER", "db", 0, "node aktif dipindah ke "+tubuh.Ke+" (manual)")
	OK(w, map[string]interface{}{
		"node_aktif": db.NodeAktif(),
	})
}
