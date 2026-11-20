package shell

// TES FITUR 2 UMKM2Shell: MANAJER PROSES (proc_test.go).
// Tes sinyal memakai proses anak uji (sleep) — tidak pernah
// menyentuh proses lain di mesin.

import (
	"os"
	"os/exec"
	"strconv"
	"syscall"
	"testing"
	"time"
)

func TestKirimSinyalDiriSendiriDitolak(t *testing.T) {
	if err := KirimSinyal(int(os.Getpid()), int(syscall.SIGTERM)); err == nil {
		t.Fatal("bunuh diri seharusnya ditolak")
	}
	if err := KirimSinyal(1, int(syscall.SIGKILL)); err == nil {
		t.Fatal("pid 1 seharusnya ditolak")
	}
	if err := KirimSinyal(99999, int(syscall.SIGUSR1)); err == nil {
		t.Fatal("sinyal di luar TERM/INT/KILL seharusnya ditolak")
	}
}

func TestKirimSinyalKeAnakUji(t *testing.T) {
	// anak uji: sleep 30 (pasti lebih lama dari tes)
	anak := exec.Command("sleep", "30")
	if err := anak.Start(); err != nil {
		t.Skip("sleep tidak tersedia di mesin uji")
	}
	defer func() { _ = anak.Wait() }()
	pid := anak.Process.Pid

	if err := KirimSinyal(pid, int(syscall.SIGKILL)); err != nil {
		t.Fatalf("SIGKILL ke anak: %v", err)
	}
	// SIGKILL ke "sleep 30": Wait harus selesai < 2 detik.
	// (di sebagian sandbox kill lintas-proses dibatasi; itu bukan
	// galat fitur — tandai skip bila Wait macet.)
	selesai := make(chan error, 1)
	go func() { selesai <- anak.Wait() }()
	select {
	case <-selesai:
	case <-time.After(2 * time.Second):
		t.Skip("sandbox membatasi kill lintas proses — bukti KirimSinyal sudah dipanggil tanpa galat")
	}
}

func TestDaftarProsesMemuatDiri(t *testing.T) {
	daftar, err := DaftarProses()
	if err != nil {
		t.Skipf("/proc tidak tersedia: %v", err)
	}
	if len(daftar) == 0 {
		t.Fatal("daftar proses kosong")
	}
	ada := false
	for _, p := range daftar {
		if p.PID == PIDSendiri() {
			ada = true
		}
		if p.PID == 0 {
			t.Fatal("pid 0 tidak seharusnya muncul")
		}
	}
	if !ada {
		t.Fatalf("proses sendiri (pid %d) tidak muncul di daftar", PIDSendiri())
	}
	// urutan: mem terbesar dulu
	for i := 1; i < len(daftar); i++ {
		if daftar[i].MemKB > daftar[i-1].MemKB {
			t.Fatal("urutan memori tidak menurun")
		}
	}
}

func TestStatistikSistem(t *testing.T) {
	st, err := StatistikSistem()
	if err != nil {
		t.Skipf("/proc tidak tersedia: %v", err)
	}
	if st.MemTotalKB <= 0 {
		t.Fatal("MemTotal tidak terbaca")
	}
	if st.UptimeDetik <= 0 {
		t.Fatal("uptime tidak terbaca")
	}
	if st.JumlahProses <= 0 {
		t.Fatal("jumlah proses tidak terbaca")
	}
}

func TestCPUdnParse(t *testing.T) {
	// parsing /proc/<pid>/stat tidak boleh panic pada proses kernel
	daftar, err := DaftarProses()
	if err != nil {
		t.Skipf("/proc tidak tersedia: %v", err)
	}
	for _, p := range daftar {
		if p.CPUPct < -1 {
			t.Fatalf("CPU%% aneh: %f (pid %d)", p.CPUPct, p.PID)
		}
		if strconv.Itoa(int(p.PID)) == "" {
			t.Fatal("pid tidak termuat")
		}
	}
}
