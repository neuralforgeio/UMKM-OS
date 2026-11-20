// FITUR 3 UMKM2Shell: PENJALAN PERINTAH (cmd.go) — v2.3.1 AUDIT.
//
// Inilah "shell"-nya yang sesungguhnya — panel PHP2Shell/
// NodeJS2Shell membiarkan exec apa pun; UMKM versi membatasi
// pada daftar perintah PUTIH (whitelist) yang berarti bagi
// pengoperasian warung, dengan:
//   - PENJARA BERLAPIS: semua argumen jalur dijabarkan absolut
//     dan WAJIB berada di bawah JailRoot — /proc, /sys, /dev,
//     /etc, /root diblok keras (audit run-13: cmd dulu SAMA
//     SEKALI tidak terikat jail).
//   - node/go DIHAPUS dari whitelist (audit P1/P2: node -e =
//     eval kode arbitrer; go run/build = kompilasi+eksekusi).
//   - find: -delete/-exec/-ok diblok (audit P3); du/df tetap
//     tapi argumen jalur tetap dijail.
//   - env DIREM: output-nya memuat SEMUA rahasia (audit P6)
//     — developer punya fitur env.go yang sudah termask.
//   - output rahasia termask oleh MaskNilai (pola GROQ/TOKEN/
//     SECRET tampil gsk_…(52)) — rahasia tidak pernah nempel
//     di sejarah perintah.
//   - antrian: maks 1 perintah jalan pada satu waktu (serial)
//   - batas waktu: perintah macet dimatikan paksa (20 detik)
//   - sejarah: 50 hasil terakhir tersimpan di memori
//   - interupsi: perintah jalan bisa dibatalkan dari panel
//   - output dipotong (256 KB)
//   - ketersediaan dinamis: binari dicek LookPath saat daftar
//     diminta — `tersedia:false` = tidak ada di PATH kontainer
//     (umum: netstat) dan UI menyembunyikan/disable.
package shell

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

// PERINTAH_PUTIH: binari yang boleh dijalankan. Tidak ada shell
// (sh -c): perintah dipecah sendiri via strings.Fields sehingga
// tidak ada injeksi pipe/&&/;. node & go DIHAPUS di 2.3.1 (eval
// arbitrer); env DIREM (bocor rahasia; pakai fitur Lingkungan).
var PERINTAH_PUTIH = map[string]string{
	"ls":        "daftar isi direktori",
	"cat":       "tampilkan isi berkas",
	"head":      "awal berkas",
	"tail":      "akhir berkas",
	"wc":        "hitung baris/kata",
	"df":        "ruang disk",
	"du":        "ukuran direktori",
	"free":      "memori",
	"ps":        "daftar proses",
	"uptime":    "lama sistem hidup",
	"whoami":    "pengguna saat ini",
	"id":        "identitas uid/gid",
	"hostname":  "nama mesin",
	"date":      "waktu server",
	"echo":      "cetak argumen",
	"grep":      "cari pola di berkas",
	"find":      "cari berkas",
	"stat":      "metadata berkas",
	"sha256sum": "hash berkas",
	"md5sum":    "hash berkas",
	"uname":     "info kernel",
	"nproc":     "jumlah CPU",
	"top":       "cuplikan proses (batch)",
	"pgrep":     "cari pid",
	"netstat":   "soket jaringan",
	"ip":        "alamat jaringan",
	"curl":      "tarik URL",
	"wget":      "unduh URL",
	"git":       "status log saja via filter",
}

// KATA_HITAM: token yang TIDAK boleh muncul di argumen apa pun —
// jalur keluar penjara, backtick, substitusi, akses kredensial.
// 2.3.1: + /proc /sys /dev /root (baca environ proses, audit P11)
// + eval/exec flags node & go (meski biner sudah dihapus — lapisan
// pertahanan kalau whitelist dibuka lagi).
var KATA_HITAM = []string{
	"../", "..\\", "`", "$(", "|", ";", "&&", ">",
	"/etc/shadow", "/etc/passwd", "id_rsa", ".ssh",
	"DOCKER_", "AWS_", "GROQ", "JWT_SECRET", "DATABASE_URL",
	"/proc", "/sys/", "/dev/", "/root",
	"-e ", "-eval", "-exec", "-delete",
}

// DIR_SENTUH: jalur yang dilarang muncul sebagai AWALAN argumen
// jalur (baca /proc/self/environ = seluruh env proses termasuk
// kunci rahasia — audit P11/P8).
var DIR_SENTUH = []string{"/proc", "/sys", "/dev", "/root", "/etc"}

// SUBPERINTAH_PUTIH: perintah yang punya sub-kata pertama sendiri.
var SUBPERINTAH_PUTIH = map[string][]string{
	"git": {"status", "log", "diff"},
	"ip":  {"addr", "route", "link"},
}

// IP_LINK_VERBA: kata kerja link yang boleh (hanya BACA).
var IP_LINK_VERBA = map[string]bool{"show": true, "list": true}

// HasilPerintah: satu entri sejarah.
type HasilPerintah struct {
	ID         int64     `json:"id"`
	Perintah   string    `json:"perintah"`
	Mulai      time.Time `json:"mulai"`
	Selesai    time.Time `json:"selesai"`
	Keluar     int       `json:"exit_code"`
	Output     string    `json:"output"`
	SebabGagal string    `json:"sebab_gagal,omitempty"`
}

// cmdState: satu slot "sedang jalan" + penguncinya.
type cmdState struct {
	mu       sync.Mutex
	jalan    *exec.Cmd
	batal    context.CancelFunc
	sedangID int64
}

var (
	cmdMu      sync.Mutex // menggembalakan ID
	cmdNextID  int64
	cmdSejarah []HasilPerintah
	cmdSlot    cmdState
)

// BatasOutput: maksimum byte output yang disimpan.
const BatasOutput = 256 * 1024

// ValidasiPerintah: parser murni (diuji unit tanpa OS). Mengembalikan
// (nama, argumen, galat). Aturan:
//   - baris dipecah spasi sederhana (strings.Fields)
//   - token pertama HARUS di PERINTAH_PUTIH
//   - token apa pun memuat KATA_HITAM -> tolak
//   - SEMUA argumen yang terlihat seperti jalur dijail: absolut
//     di-resolve lalu dicek di bawah JailRoot; jalur sentuh
//     (/proc /sys /dev /root /etc) ditolak keras
//   - git: hanya status/log/diff (bukan push yang mengubah remote)
//   - ip: hanya addr/route/link; link hanya show/list (BACA saja —
//     "ip link set dev eth0 down" TIDAK bisa mematikan jaringan)
//   - find: -delete/-exec/-ok diblok keras
//   - curl/wget: hanya flag -s -I --head (tanpa -O tulis file)
func ValidasiPerintah(baris string) (string, []string, error) {
	token := strings.Fields(baris)
	if len(token) == 0 {
		return "", nil, fmt.Errorf("perintah kosong")
	}
	nama := token[0]
	if _, putih := PERINTAH_PUTIH[nama]; !putih {
		return "", nil, fmt.Errorf("perintah %q tidak ada di daftar putih (%d perintah)", nama, len(PERINTAH_PUTIH))
	}
	for _, t := range token[1:] {
		for _, h := range KATA_HITAM {
			if strings.Contains(t, h) {
				return "", nil, fmt.Errorf("argumen memuat pola terlarang: %s", h)
			}
		}
	}
	if nama == "git" {
		if len(token) < 2 {
			return "", nil, fmt.Errorf("git butuh subperintah (status/log/diff)")
		}
		switch token[1] {
		case "status", "log", "diff":
		default:
			return "", nil, fmt.Errorf("git hanya status/log/diff di shell")
		}
	}
	if nama == "ip" {
		if len(token) < 2 {
			return "", nil, fmt.Errorf("ip butuh subperintah (addr/route/link)")
		}
		switch token[1] {
		case "addr", "route":
		case "link":
			// hanya BACA: "ip link show" boleh, "ip link set" TIDAK
			if len(token) >= 3 && !IP_LINK_VERBA[token[2]] {
				return "", nil, fmt.Errorf("ip link hanya show/list (baca) — set/ del di tolak")
			}
		default:
			return "", nil, fmt.Errorf("ip hanya addr/route/link di shell")
		}
	}
	if nama == "curl" || nama == "wget" {
		for _, t := range token[1:] {
			if strings.HasPrefix(t, "-") && t != "-s" && t != "-I" && t != "--head" {
				return "", nil, fmt.Errorf("flag %s tidak diizinkan di %s", t, nama)
			}
		}
	}
	// JAIL BAGI SEMUA ARGUMEN JALUR (audit run-13: sebelumnya cmd
	// TIDAK terikat jail sama sekali — ls /etc, grep /proc/self/
	// environ, find / semuanya lolos).
	args := token[1:]
	for i, t := range args {
		if terlihatJalur(t) {
			bersih, err := jailkanJalur(t)
			if err != nil {
				return "", nil, err
			}
			args[i] = bersih
		}
	}
	return nama, args, nil
}

// terlihatJalur: token dianggap jalur bila diawali / , "./", "../"
// (sudah diblok), ATAU "/" sendirian, ATAU memuat "/" di tengah
// (logs/berkas). Kata biasa (grep, -la, pola, URL) tidak.
// URL http://... mengandung "/" tapi punya skema:// di depan —
// token itu bukan jalur filesystem dan tidak dijail (biar tetap
// bisa curl http://host/path).
func terlihatJalur(t string) bool {
	// URL dengan skema: bukan jalur
	if strings.Contains(t, "://") {
		return false
	}
	if t == "/" {
		return true // find / = sapu akar — HARUS ditangkap
	}
	if strings.HasPrefix(t, "/") || strings.HasPrefix(t, "./") {
		return true
	}
	i := strings.Index(t, "/")
	return i > 0 && !strings.HasPrefix(t, "-")
}

// jailkanJalur: dijabarkan absolut lalu dipaksa di bawah JailRoot.
// Jalur yang menunjuk direktori sentuh (/proc, /sys, /dev, /root,
// /etc) ditolak keras — meski di bawah jail (bind mount aneh).
// Jalur relatif dianggap relatif JailRoot (cwd exec = cwd backend,
// bukan jail — sebelumnya `cat logs/...` membaca cwd asli!).
func jailkanJalur(jalur string) (string, error) {
	abs := jalur
	if !strings.HasPrefix(abs, "/") {
		abs = filepath.Join(JailRoot, abs)
	} else {
		// absolut di-rebase ke jail: "/etc/x" -> jail/etc/x
		// (perilaku fs.go Bersihkan) — tapi kirim LEWAT jail supaya
		// sentuh tetap ketangkap di bawah.
		abs = filepath.Join(JailRoot, strings.TrimPrefix(abs, "/"))
	}
	// tolak direktori sentuh sebelum resolve (jalur mentah)
	rapaat := filepath.Clean(abs)
	for _, d := range DIR_SENTUH {
		if strings.HasPrefix(rapaat, JailRoot+d) {
			return "", fmt.Errorf("jalur %q menyentuh area sistem yang dilarang", jalur)
		}
	}
	return abs, nil
}

// Jalankan: eksekusi perintah yang sudah tervalidasi, dengan antrian
// serial + timeout + pencatatan sejarah. cwd perintah = JailRoot
// supaya jalur relatif konsisten dengan tab Berkas. Output rahasia
// (pola kredensial) termask sebelum masuk sejarah.
func Jalankan(baris string) (*HasilPerintah, error) {
	nama, args, err := ValidasiPerintah(baris)
	if err != nil {
		return nil, err
	}
	cmdMu.Lock()
	cmdNextID++
	id := cmdNextID
	cmdMu.Unlock()

	cmdSlot.mu.Lock()
	if cmdSlot.jalan != nil {
		cmdSlot.mu.Unlock()
		return nil, fmt.Errorf("satu perintah sedang jalan (id %d) — tunggu atau interupsi dulu", cmdSlot.sedangID)
	}
	ctx, batal := context.WithTimeout(context.Background(),
		time.Duration(CmdTimeoutDetik)*time.Second)
	cmd := exec.CommandContext(ctx, nama, args...)
	cmd.Dir = JailRoot // jalur relatif = dalam jail, bukan cwd backend
	cmdSlot.jalan = cmd
	cmdSlot.batal = batal
	cmdSlot.sedangID = id
	cmdSlot.mu.Unlock()

	hasil := &HasilPerintah{ID: id, Perintah: baris, Mulai: time.Now()}

	var buf bytes.Buffer
	cmd.Stdout = &buf
	cmd.Stderr = &buf
	err = cmd.Run()

	hasil.Selesai = time.Now()
	hasil.Output = maskRahasia(potongOutput(buf.String()))
	if ctx.Err() == context.DeadlineExceeded {
		hasil.SebabGagal = "batas waktu " + fmt.Sprint(CmdTimeoutDetik) + " detik"
		hasil.Keluar = -1
	} else if ctx.Err() == context.Canceled {
		hasil.SebabGagal = "diinterupsi dari panel"
		hasil.Keluar = -2
	} else if err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			hasil.Keluar = ee.ExitCode()
		} else {
			hasil.Keluar = -3
			hasil.SebabGagal = err.Error()
		}
	}

	cmdSlot.mu.Lock()
	cmdSlot.jalan = nil
	cmdSlot.batal = nil
	cmdSlot.sedangID = 0
	cmdSlot.mu.Unlock()

	catatSejarah(hasil)
	return hasil, nil
}

// maskRahasia: bila output memuat pola kredensial (gsk_, Bearer,
// password=), ganti nilai dengan bentuk mask. Murni — diuji unit.
func maskRahasia(s string) string {
	ganti := func(utuh string) string {
		return MaskNilai(utuh)
	}
	// gsk_<64>: pola kunci Groq
	s = gantiPola(s, `gsk_[A-Za-z0-9]{20,}`, ganti)
	// Bearer <token jwt-ish>
	s = gantiPola(s, `Bearer [A-Za-z0-9._-]{20,}`, ganti)
	// kata kunci= nilai panjang (DATABASE_URL=postgres://...)
	s = gantiPola(s, `(password|secret|token|key)=[^\s"']{12,}`, ganti)
	return s
}

// gantiPola: regexp pengganti murni.
func gantiPola(s, pola string, ganti func(string) string) string {
	re, err := regexp.Compile(pola)
	if err != nil {
		return s
	}
	return re.ReplaceAllStringFunc(s, ganti)
}

// Interupsi: batalkan perintah yang sedang jalan (bila ada).
func Interupsi() bool {
	cmdSlot.mu.Lock()
	defer cmdSlot.mu.Unlock()
	if cmdSlot.batal == nil {
		return false
	}
	cmdSlot.batal()
	return true
}

// SedangJalan: apakah ada perintah berjalan (+ id-nya).
func SedangJalan() (bool, int64) {
	cmdSlot.mu.Lock()
	defer cmdSlot.mu.Unlock()
	return cmdSlot.jalan != nil, cmdSlot.sedangID
}

// Sejarah: salinan 50 entri terakhir (terbaru dulu).
func Sejarah() []HasilPerintah {
	cmdMu.Lock()
	defer cmdMu.Unlock()
	n := len(cmdSejarah)
	hasil := make([]HasilPerintah, n)
	copy(hasil, cmdSejarah)
	// balik: terbaru dulu tanpa membalik slice asli
	for i, j := 0, n-1; i < j; i, j = i+1, j-1 {
		hasil[i], hasil[j] = hasil[j], hasil[i]
	}
	return hasil
}

// DaftarPutihTersedia: whitelist + status binari ada di PATH.
// UI memakai ini untuk disable perintah yang tidak terpasang
// (netstat umumnya tidak ada di image minimal runtime).
func DaftarPutihTersedia() map[string]string {
	daftar := make(map[string]string, len(PERINTAH_PUTIH))
	for nama, ket := range PERINTAH_PUTIH {
		if _, err := exec.LookPath(nama); err == nil {
			daftar[nama] = ket
		}
	}
	return daftar
}

func catatSejarah(h *HasilPerintah) {
	cmdMu.Lock()
	defer cmdMu.Unlock()
	cmdSejarah = append(cmdSejarah, *h)
	if len(cmdSejarah) > 50 {
		cmdSejarah = cmdSejarah[len(cmdSejarah)-50:]
	}
}

func potongOutput(s string) string {
	if len(s) <= BatasOutput {
		return s
	}
	return s[:BatasOutput] + "\n…(terpotong, maks " + fmt.Sprint(BatasOutput) + " byte)"
}
