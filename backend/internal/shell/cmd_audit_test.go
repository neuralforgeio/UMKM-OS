package shell

// TES AUDIT RUN-13 (cmd_audit_test.go) — setiap temuan audit
// "check semua command nya karena masih ada problem" dikunci
// dengan tes regresi. Tanpa perbaikan 2.3.1, SEMUA tes ini gagal.

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func auditJail(t *testing.T) string {
	t.Helper()
	lama := JailRoot
	dir := t.TempDir()
	JailRoot = dir
	t.Cleanup(func() { JailRoot = lama })
	return dir
}

func TestAuditNodeDanGoDihapus(t *testing.T) {
	// P1/P2: node -e = eval kode arbitrer; go run = kompilasi+eksekusi
	for _, nama := range []string{"node", "go"} {
		if _, putih := PERINTAH_PUTIH[nama]; putih {
			t.Errorf("%s masih di whitelist — eksekusi kode arbitrer", nama)
		}
		if _, _, err := ValidasiPerintah(nama + " -e 1"); err == nil {
			t.Errorf("%s -e seharusnya ditolak", nama)
		}
	}
}

func TestAuditEnvDihapusDariWhitelist(t *testing.T) {
	// P6: env mencetak SEMUA rahasia ke output sejarah
	if _, putih := PERINTAH_PUTIH["env"]; putih {
		t.Fatal("env masih di whitelist — pakai fitur Lingkungan yang termask")
	}
	if _, _, err := ValidasiPerintah("env"); err == nil {
		t.Fatal("env seharusnya ditolak (bocor rahasia via output)")
	}
}

func TestAuditFindDeleteExecDiblok(t *testing.T) {
	auditJail(t)
	for _, baris := range []string{
		"find . -delete",
		"find . -exec rm {} ;",
		"find . -exec cat {} +",
		"find . -ok rm {} ;",
	} {
		if _, _, err := ValidasiPerintah(baris); err == nil {
			t.Errorf("find berbahaya lolos: %q", baris)
		}
	}
	// find baca tetap boleh
	if _, _, err := ValidasiPerintah("find . -name *.log"); err != nil {
		t.Errorf("find baca ditolak salah: %v", err)
	}
}

func TestAuditIPLinkHanyaBaca(t *testing.T) {
	// P5: "ip link set dev eth0 down" mematikan jaringan warung
	for _, baris := range []string{
		"ip link set dev eth0 down",
		"ip link set lo down",
		"ip link del eth0",
	} {
		if _, _, err := ValidasiPerintah(baris); err == nil {
			t.Errorf("ip berbahaya lolos: %q", baris)
		}
	}
	// ip baca tetap boleh
	for _, baris := range []string{
		"ip addr",
		"ip route",
		"ip link show",
		"ip link list",
	} {
		if _, _, err := ValidasiPerintah(baris); err != nil {
			t.Errorf("ip baca ditolak salah: %v (%q)", err, baris)
		}
	}
}

func TestAuditJalurSistemDiblokDiArgumen(t *testing.T) {
	auditJail(t)
	// P8/P11: jalur sentuh tanpa ../ harus DITOLAK keras
	for _, baris := range []string{
		"grep kunci /proc/self/environ",
		"cat /proc/self/environ",
		"ls /etc",
		"cat /etc/hostname",
		"ls /root",
		"grep x /sys/version",
		"cat /dev/zero",
	} {
		_, _, err := ValidasiPerintah(baris)
		if err == nil {
			t.Errorf("jalur sistem lolos validator: %q", baris)
		}
	}
	// "find /" dan "du /": di-rebase ke jail (sapu jail saja = aman)
	for _, baris := range []string{"find / -name x", "du /"} {
		_, args, err := ValidasiPerintah(baris)
		if err != nil {
			t.Errorf("%q ditolak salah: %v", baris, err)
			continue
		}
		if args[0] != JailRoot {
			t.Errorf("%q tidak di-rebase ke jail: %v", baris, args)
		}
	}
}

func TestAuditJalurDiubahKeJail(t *testing.T) {
	jail := auditJail(t)
	// jalur relatif BER-slash ("sub/x.txt") dijabarkan di dalam jail
	nama, args, err := ValidasiPerintah("cat sub/catatan.txt")
	if err != nil {
		t.Fatalf("jalur relatif slash ditolak salah: %v", err)
	}
	if nama != "cat" || args[0] != filepath.Join(jail, "sub", "catatan.txt") {
		t.Fatalf("jalur tidak dijail: %v", args)
	}
	// jalur relatif TANPA slash ("catatan.txt") TIDAK di-rewrite —
	// aman karena cwd exec = JailRoot (dibuktikan tes CWD audit).
	// jalur absolut "/x" di-rebase ke jail/x (perilaku Bersihkan)
	nama, args, err = ValidasiPerintah("cat /catatan.txt")
	if err != nil {
		t.Fatalf("jalur absolut di-rebase ditolak salah: %v", err)
	}
	if args[0] != filepath.Join(jail, "catatan.txt") {
		t.Fatalf("jalur absolut tidak di-rebase ke jail: %v", args)
	}
	// "./x" juga dijail
	_, args, err = ValidasiPerintah("cat ./catatan.txt")
	if err != nil || args[0] != filepath.Join(jail, "catatan.txt") {
		t.Fatalf("jalur ./x tidak dijail: %v err=%v", args, err)
	}
	// token non-jalur tidak tersentuh (pola grep, flag -la)
	nama, args, err = ValidasiPerintah("grep -i pola")
	if err != nil || nama != "grep" || args[0] != "-i" || args[1] != "pola" {
		t.Fatalf("token non-jalur berubah: %v %v err=%v", nama, args, err)
	}
}

func TestAuditCurlOFlagDiblok(t *testing.T) {
	// P4: curl -O / wget -O menulis file
	for _, baris := range []string{
		"curl -O http://x/l",
		"wget -O /tmp/x http://y",
		"curl -o hasil http://x",
		"curl -X POST http://x",
	} {
		if _, _, err := ValidasiPerintah(baris); err == nil {
			t.Errorf("curl/wget tulis-file lolos: %q", baris)
		}
	}
	// baca tetap boleh
	for _, baris := range []string{
		"curl http://localhost:8080/health",
		"curl -I http://localhost:8080/health",
		"curl -s http://x",
	} {
		if _, _, err := ValidasiPerintah(baris); err != nil {
			t.Errorf("curl baca ditolak salah: %v (%q)", err, baris)
		}
	}
}

func TestAuditMaskRahasiaOutput(t *testing.T) {
	// rahasia tidak boleh nempel di output sejarah
	kasus := map[string]bool{ // nilai->haruskah mengandung rahasia asli
		"gsk_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234":  true,
		"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6": true,
		"password=superrahasiapanjang":        true,
		"teks biasa tanpa rahasia":            false,
	}
	for masuk, adaRahasia := range kasus {
		dapat := maskRahasia(masuk)
		if adaRahasia {
			if dapat == masuk {
				t.Errorf("rahasia tidak termask: %q -> %q", masuk, dapat)
			}
			if strings.Contains(dapat, masuk) {
				t.Errorf("rahasia masih terbaca utuh: %q", dapat)
			}
		} else if dapat != masuk {
			t.Errorf("teks biasa ikut berubah: %q -> %q", masuk, dapat)
		}
	}
}

func TestAuditDaftarPutihTersedia(t *testing.T) {
	daftar := DaftarPutihTersedia()
	// echo pasti ada di mesin uji apa pun
	if _, ok := daftar["echo"]; !ok {
		t.Fatal("echo tidak terdeteksi tersedia padahal pasti ada")
	}
	// node dihapus dari whitelist -> tidak muncul apa pun
	if _, ok := daftar["node"]; ok {
		t.Fatal("node muncul di daftar tersedia padahal sudah dihapus dari whitelist")
	}
	// subset dari whitelist
	for nama := range daftar {
		if _, putih := PERINTAH_PUTIH[nama]; !putih {
			t.Errorf("tersedia %q bukan bagian whitelist", nama)
		}
	}
}

func TestAuditCWDPerintahAdalahJail(t *testing.T) {
	jail := auditJail(t)
	// tulis berkas di jail lalu ls tanpa argumen — cwd perintah = jail
	_ = os.WriteFile(filepath.Join(jail, "penanda-audit.txt"), []byte("x"), 0644)
	hasil, err := Jalankan("ls")
	if err != nil {
		t.Fatalf("Jalankan ls: %v", err)
	}
	if !strings.Contains(hasil.Output, "penanda-audit.txt") {
		t.Fatalf("cwd perintah bukan jail — output: %q", hasil.Output)
	}
}

func TestAuditKataHitamBaru(t *testing.T) {
	for _, h := range []string{"/proc", "/sys/", "/dev/", "/root", "-eval", "-exec", "-delete"} {
		ditemukan := false
		for _, k := range KATA_HITAM {
			if k == h {
				ditemukan = true
			}
		}
		if !ditemukan {
			t.Errorf("KATA_HITAM tidak memuat %q", h)
		}
	}
}
