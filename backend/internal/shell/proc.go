// FITUR 2 UMKM2Shell: MANAJER PROSES (proc.go).
//
// Panel PHP2Shell klasik membiarkan kill -9 pid apa pun. Versi
// UMKM: daftar proses ringkas (CPU/memori via /proc di Linux),
// kirim sinyal, dan statistik sistem — dengan PENGECEKAN DIRI:
// proses backend sendiri TIDAK bisa dibunuh dari panelnya
// (bunuh diri = warung mati + panel ikut mati).
package shell

import (
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
	"syscall"
)

// InfoProc: satu baris proses untuk JSON.
type InfoProc struct {
	PID     int32   `json:"pid"`
	PPID    int32   `json:"ppid"`
	User    string  `json:"user"`
	Cmdline string  `json:"cmdline"`
	CPUPct  float64 `json:"cpu_pct"`
	MemKB   int64   `json:"mem_kb"`
	State   string  `json:"state"`
}

// PIDSendiri: pid proses backend (dipakai pengecekan bunuh-diri).
func PIDSendiri() int32 { return int32(os.Getpid()) }

// DaftarProses: baca /proc (Linux). Di luar Linux daftar kosong —
// kontainer produksi UMKM selalu Linux (alpine runtime image).
// CPU% dihitung dari /proc/<pid>/stat utime+stime dibagi uptime
// proses — estimasi murah tanpa sampling dua kali.
func DaftarProses() ([]InfoProc, error) {
	ent, err := os.ReadDir("/proc")
	if err != nil {
		return nil, fmt.Errorf("/proc tidak terbaca (bukan Linux?): %v", err)
	}
	daftar := []InfoProc{}
	uptime, _ := bacaUptime()
	for _, e := range ent {
		pid, err := strconv.Atoi(e.Name())
		if err != nil || pid <= 0 {
			continue // bukan folder angka
		}
		p, ok := bacaProcPid(pid, uptime)
		if ok {
			daftar = append(daftar, p)
		}
	}
	// teratas: memori terbesar dulu — yang dicari developer saat
	// mencari "siapa yang makan RAM".
	sort.SliceStable(daftar, func(i, j int) bool {
		return daftar[i].MemKB > daftar[j].MemKB
	})
	if len(daftar) > 200 {
		daftar = daftar[:200] // panel tetap ringan di mesin ramai
	}
	return daftar, nil
}

// bacaProcPid: satukan satu /proc/<pid>.
func bacaProcPid(pid int, uptime float64) (InfoProc, bool) {
	var p InfoProc
	p.PID = int32(pid)

	// status: ppid, uid, state
	b, err := os.ReadFile(fmt.Sprintf("/proc/%d/status", pid))
	if err != nil {
		return p, false
	}
	for _, baris := range strings.Split(string(b), "\n") {
		kolom := strings.Fields(baris)
		if len(kolom) < 2 {
			continue
		}
		switch kolom[0] {
		case "Name:", "State:":
			if kolom[0] == "State:" && len(kolom) >= 3 {
				p.State = kolom[1]
			}
		case "PPid:":
			if v, err := strconv.ParseInt(kolom[1], 10, 32); err == nil {
				p.PPID = int32(v)
			}
		case "Uid:":
			if len(kolom) >= 2 {
				p.User = "uid:" + kolom[1]
			}
		case "VmRSS:":
			if v, err := strconv.ParseInt(kolom[1], 10, 64); err == nil {
				p.MemKB = v
			}
		}
	}

	// cmdline
	if cb, err := os.ReadFile(fmt.Sprintf("/proc/%d/cmdline", pid)); err == nil {
		p.Cmdline = strings.Join(strings.Split(string(cb), "\x00"), " ")
	}
	if strings.TrimSpace(p.Cmdline) == "" {
		// proses kernel tanpa cmdline: pakai nama dari status
		for _, baris := range strings.Split(string(b), "\n") {
			if strings.HasPrefix(baris, "Name:") {
				p.Cmdline = "[" + strings.TrimSpace(strings.TrimPrefix(baris, "Name:")) + "]"
			}
		}
	}

	// stat: utime+stime untuk CPU% estimasi
	if sb, err := os.ReadFile(fmt.Sprintf("/proc/%d/stat", pid)); err == nil {
		// field ke-14/15 (index 13/14) setelah "(comm)" — parsing dari
		// KANAN lebih stabil karena comm bisa memuat spasi.
		balik := strings.Fields(strings.TrimSpace(string(sb)))
		if len(balik) >= 15 {
			utime, _ := strconv.ParseFloat(balik[len(balik)-36+13], 64)
			stime, _ := strconv.ParseFloat(balik[len(balik)-36+14], 64)
			tick := utime + stime
			if uptime > 0 {
				// (tick/100 detik) / uptime * 100
				p.CPUPct = (tick / 100.0) / uptime * 100.0
			}
		}
	}
	return p, true
}

// bacaUptime: detik sejak boot dari /proc/uptime (kolom pertama).
func bacaUptime() (float64, error) {
	b, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0, err
	}
	kolom := strings.Fields(string(b))
	if len(kolom) == 0 {
		return 0, fmt.Errorf("/proc/uptime kosong")
	}
	return strconv.ParseFloat(kolom[0], 64)
}

// StatSistem: potret memori + CPU + load rata-rata.
type StatSistem struct {
	MemTotalKB   int64   `json:"mem_total_kb"`
	MemFreeKB    int64   `json:"mem_free_kb"`
	MemTersedia  int64   `json:"mem_available_kb"`
	LoadAvg1     float64 `json:"load1"`
	LoadAvg5     float64 `json:"load5"`
	JumlahProses int     `json:"proses_total"`
	UptimeDetik  float64 `json:"uptime_s"`
}

// StatistikSistem: baca /proc/meminfo + /proc/loadavg + /proc/uptime.
func StatistikSistem() (*StatSistem, error) {
	st := &StatSistem{}
	b, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return nil, fmt.Errorf("/proc/meminfo: %v", err)
	}
	for _, baris := range strings.Split(string(b), "\n") {
		kolom := strings.SplitN(baris, ":", 2)
		if len(kolom) != 2 {
			continue
		}
		v := strings.TrimSpace(kolom[1])
		n, _ := strconv.ParseInt(strings.Fields(v)[0], 10, 64)
		switch kolom[0] {
		case "MemTotal":
			st.MemTotalKB = n
		case "MemFree":
			st.MemFreeKB = n
		case "MemAvailable":
			st.MemTersedia = n
		}
	}
	if lb, err := os.ReadFile("/proc/loadavg"); err == nil {
		kolom := strings.Fields(string(lb))
		if len(kolom) >= 2 {
			st.LoadAvg1, _ = strconv.ParseFloat(kolom[0], 64)
			st.LoadAvg5, _ = strconv.ParseFloat(kolom[1], 64)
			if len(kolom) >= 4 {
				if p, err := strconv.Atoi(strings.Split(kolom[3], "/")[0]); err == nil {
					st.JumlahProses = p
				}
			}
		}
	}
	if up, err := bacaUptime(); err == nil {
		st.UptimeDetik = up
	}
	return st, nil
}

// KirimSinyal: kirim sinyal ke pid dengan tiga pagar pengaman:
// (1) pid <= 1 ditolak (init/kernel); (2) PID SENDIRI ditolak
// (bunuh diri = warung + panel mati); (3) sinyal hanya
// SIGTERM(15)/SIGINT(2)/SIGKILL(9) — tidak ada SIODSTOP main-main.
func KirimSinyal(pid int, sinyal int) error {
	if pid <= 1 {
		return fmt.Errorf("pid %d tidak boleh disinyal (init/kernel)", pid)
	}
	if int32(pid) == PIDSendiri() {
		return fmt.Errorf("tidak bisa menyalahkan diri sendiri — restart lewat docker compose")
	}
	switch sinyal {
	case int(syscall.SIGTERM), int(syscall.SIGINT), int(syscall.SIGKILL):
	default:
		return fmt.Errorf("sinyal %d tidak diizinkan (hanya TERM=15, INT=2, KILL=9)", sinyal)
	}
	proses, _ := os.FindProcess(pid)
	if err := proses.Signal(syscall.Signal(sinyal)); err != nil {
		return fmt.Errorf("gagal mengirim sinyal: %v", err)
	}
	return nil
}
