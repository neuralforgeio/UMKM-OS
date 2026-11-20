package handler

// UMKM2Shell (v2.3.0) — pintu HTTP untuk package internal/shell:
// kontrol penuh server untuk DEVELOPER, terinspirasi panel
// PHP2Shell/NodeJS2Shell tapi dengan pagar pengaman warung:
//
//   /shell/fs?path=…      GET    daftar isi direktori (penjara)
//   /shell/fs/cat?path=…  GET    baca berkas teks (512 KB max)
//   /shell/fs/unduh?path= GET    streaming unduh berkas
//   /shell/fs             PUT    tulis berkas (512 KB max)
//   /shell/fs              DELETE hapus berkas/direktori kosong
//   /shell/fs/ganti-nama   PUT    pindahkan dalam penjara
//
//   /shell/proc            GET    daftar proses + statistik sistem
//   /shell/proc/sinyal     POST   kirim TERM/INT/KILL (bukan diri)
//
//   /shell/cmd             POST   jalankan perintah whitelist
//   /shell/cmd             GET    sejarah + status antrian
//   /shell/cmd/interupsi   POST   batalkan perintah jalan
//   /shell/cmd/daftar      GET    daftar putih perintah
//
//   /shell/env             GET    variabel lingkungan (rahasia mask)
//   /shell/env/buka        POST   buka SATU kunci (ter-audit)
//
//   /shell/net/ping        POST   ping TCP host:port
//   /shell/net/http        POST   HEAD/GET ringan ke URL
//
// Semua ter-audit (SHELL_*); semua didokumentasikan docs/api/.

import (
	"net/http"
	"strconv"

	"github.com/neuralforgeio/internal/logger"
	"github.com/neuralforgeio/internal/middleware"
	"github.com/neuralforgeio/internal/shell"
)

// shelAudit: bungkus LogAudit dengan nama entitas shell.
func shelAudit(r *http.Request, aksi, detail string) {
	if c := middleware.User(r); c != nil {
		LogAudit(r, c.UserID, aksi, "shell", 0, detail)
	}
}

// ---- Filesystem ---------------------------------------------------------

// GET /api/v1/shell/fs?path= (DEVELOPER)
func ShellFsLs(w http.ResponseWriter, r *http.Request) {
	daftar, err := shell.Ls(r.URL.Query().Get("path"))
	if err != nil {
		Err(w, http.StatusBadRequest, err.Error())
		return
	}
	shelAudit(r, "SHELL_FS_LS", "path="+r.URL.Query().Get("path"))
	OK(w, map[string]interface{}{"entri": daftar, "jumlah": len(daftar)})
}

// GET /api/v1/shell/fs/cat?path= (DEVELOPER)
func ShellFsCat(w http.ResponseWriter, r *http.Request) {
	isi, terpotong, err := shell.Cat(r.URL.Query().Get("path"))
	if err != nil {
		Err(w, http.StatusBadRequest, err.Error())
		return
	}
	shelAudit(r, "SHELL_FS_CAT", "path="+r.URL.Query().Get("path"))
	OK(w, map[string]interface{}{"isi": isi, "terpotong": terpotong})
}

// GET /api/v1/shell/fs/unduh?path= (DEVELOPER) — streaming.
func ShellFsUnduh(w http.ResponseWriter, r *http.Request) {
	if err := shell.Unduh(w, r.URL.Query().Get("path")); err != nil {
		Err(w, http.StatusBadRequest, err.Error())
		return
	}
	shelAudit(r, "SHELL_FS_UNDUH", "path="+r.URL.Query().Get("path"))
}

// PUT /api/v1/shell/fs (DEVELOPER) body {"path","isi"}
func ShellFsTulis(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path string `json:"path"`
		Isi  string `json:"isi"`
	}
	if err := Decode(r, &req); err != nil || req.Path == "" {
		Err(w, http.StatusBadRequest, "Body request tidak valid")
		return
	}
	if err := shell.Tulis(req.Path, req.Isi); err != nil {
		Err(w, http.StatusBadRequest, err.Error())
		return
	}
	shelAudit(r, "SHELL_FS_TULIS", "path="+req.Path)
	logger.Info("Shell: berkas %s ditulis developer", req.Path)
	OK(w, map[string]interface{}{"ditulis": req.Path})
}

// DELETE /api/v1/shell/fs?path= (DEVELOPER)
func ShellFsHapus(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if err := shell.Hapus(path); err != nil {
		Err(w, http.StatusBadRequest, err.Error())
		return
	}
	shelAudit(r, "SHELL_FS_HAPUS", "path="+path)
	OK(w, map[string]interface{}{"terhapus": path})
}

// PUT /api/v1/shell/fs/ganti-nama (DEVELOPER) body {"dari","ke"}
func ShellFsGantiNama(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Dari string `json:"dari"`
		Ke   string `json:"ke"`
	}
	if err := Decode(r, &req); err != nil || req.Dari == "" || req.Ke == "" {
		Err(w, http.StatusBadRequest, "Body request tidak valid")
		return
	}
	if err := shell.GantiNama(req.Dari, req.Ke); err != nil {
		Err(w, http.StatusBadRequest, err.Error())
		return
	}
	shelAudit(r, "SHELL_FS_GANTI_NAMA", req.Dari+" -> "+req.Ke)
	OK(w, map[string]interface{}{"dari": req.Dari, "ke": req.Ke})
}

// ---- Proses --------------------------------------------------------------

// GET /api/v1/shell/proc (DEVELOPER)
func ShellProcList(w http.ResponseWriter, r *http.Request) {
	daftar, err := shell.DaftarProses()
	if err != nil {
		Err(w, http.StatusInternalServerError, err.Error())
		return
	}
	stat, _ := shell.StatistikSistem()
	shelAudit(r, "SHELL_PROC_LS", strconv.Itoa(len(daftar))+" proses")
	OK(w, map[string]interface{}{
		"proses":      daftar,
		"stat_sistem": stat,
		"pid_sendiri": shell.PIDSendiri(),
	})
}

// POST /api/v1/shell/proc/sinyal (DEVELOPER) body {"pid","sinyal"}
func ShellProcSinyal(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PID    int `json:"pid"`
		Sinyal int `json:"sinyal"`
	}
	if err := Decode(r, &req); err != nil || req.PID == 0 {
		Err(w, http.StatusBadRequest, "Body request tidak valid")
		return
	}
	if err := shell.KirimSinyal(req.PID, req.Sinyal); err != nil {
		Err(w, http.StatusBadRequest, err.Error())
		return
	}
	shelAudit(r, "SHELL_PROC_SIGNAL", "pid="+strconv.Itoa(req.PID)+" sinyal="+strconv.Itoa(req.Sinyal))
	logger.Warn("Shell: sinyal %d ke pid %d oleh developer", req.Sinyal, req.PID)
	OK(w, map[string]interface{}{"pid": req.PID, "sinyal": req.Sinyal})
}

// ---- Perintah --------------------------------------------------------------

// POST /api/v1/shell/cmd (DEVELOPER) body {"perintah"}
func ShellCmdJalankan(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Perintah string `json:"perintah"`
	}
	if err := Decode(r, &req); err != nil || req.Perintah == "" {
		Err(w, http.StatusBadRequest, "Body request tidak valid")
		return
	}
	hasil, err := shell.Jalankan(req.Perintah)
	if err != nil {
		Err(w, http.StatusBadRequest, err.Error())
		return
	}
	shelAudit(r, "SHELL_CMD_RUN", req.Perintah)
	OK(w, hasil)
}

// GET /api/v1/shell/cmd (DEVELOPER): sejarah + status antrian.
func ShellCmdSejarah(w http.ResponseWriter, r *http.Request) {
	jalan, id := shell.SedangJalan()
	OK(w, map[string]interface{}{
		"sedang_jalan": jalan,
		"sedang_id":    id,
		"sejarah":      shell.Sejarah(),
	})
}

// POST /api/v1/shell/cmd/interupsi (DEVELOPER)
func ShellCmdInterupsi(w http.ResponseWriter, r *http.Request) {
	ok := shell.Interupsi()
	shelAudit(r, "SHELL_CMD_INT", "")
	OK(w, map[string]interface{}{"diinterupsi": ok})
}

// GET /api/v1/shell/cmd/daftar (DEVELOPER): whitelist + keterangan.
func ShellCmdDaftar(w http.ResponseWriter, r *http.Request) {
	OK(w, map[string]interface{}{"perintah": shell.PERINTAH_PUTIH})
}

// ---- Lingkungan --------------------------------------------------------------

// GET /api/v1/shell/env?buka=KUNCI (DEVELOPER)
func ShellEnv(w http.ResponseWriter, r *http.Request) {
	buka := r.URL.Query().Get("buka")
	if buka != "" {
		shelAudit(r, "SHELL_ENV_BUKA", "kunci="+buka)
		logger.Warn("Shell: developer membuka nilai env %s", buka)
	}
	OK(w, map[string]interface{}{"env": shell.DaftarEnv(buka)})
}

// ---- Jaringan --------------------------------------------------------------

// POST /api/v1/shell/net/ping (DEVELOPER) body {"host","port"}
func ShellNetPing(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Host string `json:"host"`
		Port string `json:"port"`
	}
	if err := Decode(r, &req); err != nil || req.Host == "" || req.Port == "" {
		Err(w, http.StatusBadRequest, "Body request tidak valid")
		return
	}
	hidup, ms, err := shell.PingTCP(req.Host, req.Port)
	if err != nil {
		Err(w, http.StatusBadRequest, err.Error())
		return
	}
	shelAudit(r, "SHELL_NET_PING", req.Host+":"+req.Port)
	OK(w, map[string]interface{}{"hidup": hidup, "latensi_ms": ms})
}

// POST /api/v1/shell/net/http (DEVELOPER) body {"url"}
func ShellNetHttp(w http.ResponseWriter, r *http.Request) {
	var req struct {
		URL string `json:"url"`
	}
	if err := Decode(r, &req); err != nil || req.URL == "" {
		Err(w, http.StatusBadRequest, "Body request tidak valid")
		return
	}
	status, ms, err := shell.HttpHead(req.URL)
	if err != nil {
		Err(w, http.StatusBadRequest, err.Error())
		return
	}
	shelAudit(r, "SHELL_NET_HTTP", req.URL)
	OK(w, map[string]interface{}{"status": status, "latensi_ms": ms})
}

// ---- Server (run-13) ------------------------------------------------------

// GET /api/v1/shell/server/kesehatan (DEVELOPER): potret menyeluruh
// server SEKARANG — DB ping, rasio error HTTP dari log CSV hari ini,
// p95 latensi, memori, load, verdict HIJAU/KUNING/MERAH + alasan.
func ShellServerKesehatan(w http.ResponseWriter, r *http.Request) {
	k := shell.AmbilKesehatan()
	shelAudit(r, "SHELL_SERVER_KES", k.Verdict)
	OK(w, k)
}

// GET /api/v1/shell/server/prediksi (DEVELOPER): prediksi down dari
// ring sampler + regresi linear — verdict SEHAT/WASPADA/KRITIS/NA,
// tren per metrik, estimasi menit sampai kritis.
func ShellServerPrediksi(w http.ResponseWriter, r *http.Request) {
	p := shell.PrediksiDown()
	shelAudit(r, "SHELL_SERVER_PREDIKSI", p.Verdict)
	OK(w, p)
}

// POST /api/v1/shell/server/matikan (DEVELOPER) body {"konfirmasi":"MATIKAN"}:
// graceful shutdown — sama seperti Ctrl+C: HTTP drained 5 detik,
// DB ditutup, log di-flush. Konfirmasi literal wajib (UI memakai
// dialog teks).
func ShellServerMatikan(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Konfirmasi string `json:"konfirmasi"`
	}
	if err := Decode(r, &req); err != nil || req.Konfirmasi != "MATIKAN" {
		Err(w, http.StatusBadRequest, "Body request tidak valid: butuh konfirmasi \"MATIKAN\"")
		return
	}
	shelAudit(r, "SHELL_SERVER_MATIKAN", "graceful shutdown diminta dari panel")
	logger.Warn("Shell: developer meminta server berhenti dengan rapi dari panel")
	terima := shell.MatikanServer()
	OK(w, map[string]interface{}{"diminta": terima, "status": "sedang-mati"})
}

// GET /api/v1/shell/server/status (DEVELOPER): status ringkas untuk
// polling UI (verdict + status mati) — murah, tanpa parse log penuh.
func ShellServerStatus(w http.ResponseWriter, r *http.Request) {
	OK(w, map[string]interface{}{
		"sedang_mati": shell.StatusMatikan(),
	})
}

// POST /api/v1/shell/cmd/validasi (DEVELOPER) body {"perintah"}:
// DRY-RUN — validasi parser tanpa eksekusi. UI terminal memakai ini
// untuk memberi umpan balik SEBELUM tombol jalankan ditekan.
func ShellCmdValidasi(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Perintah string `json:"perintah"`
	}
	if err := Decode(r, &req); err != nil || req.Perintah == "" {
		Err(w, http.StatusBadRequest, "Body request tidak valid")
		return
	}
	nama, args, err := shell.ValidasiPerintah(req.Perintah)
	hasil := map[string]interface{}{
		"valid":    err == nil,
		"perintah": nama,
	}
	if err != nil {
		hasil["galat"] = err.Error()
	} else {
		hasil["argumen"] = args
	}
	OK(w, hasil)
}

// GET /api/v1/shell/cmd/tersedia (DEVELOPER): whitelist yang binari
// benar-benar ada di PATH (v2.3.1) — UI menyembunyikan yang tidak ada.
func ShellCmdTersedia(w http.ResponseWriter, r *http.Request) {
	OK(w, map[string]interface{}{"perintah": shell.DaftarPutihTersedia()})
}
