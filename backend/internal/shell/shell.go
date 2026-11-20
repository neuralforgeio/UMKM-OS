// Package shell = UMKM2Shell (v2.3.0): kontrol penuh server untuk
// developer, terinspirasi panel PHP2Shell/NodeJS2Shell tapi dibuat
// jauh lebih kompleks DAN aman untuk warung:
//
//   - fs.go    : penjelajah file (ls / cat / unduh / unggah /
//     buat / hapus / ganti nama) di dalam PENJARA direktori
//     (jail) — tidak ada jalan keluar ke /etc/passwd.
//   - proc.go  : manajer proses (daftar + sinyal SIGTERM/SIGKILL +
//     CPU/memori sistem).
//   - cmd.go   : PENJALAN PERINTAH dengan antrian + batas waktu +
//     sejarah + interupsi — tanpa executor keybertumpuk,
//     whitelist perintah + blacklist kata.
//   - env.go   : inspektur variabel lingkungan (rahasia termask).
//   - net.go   : perkakas jaringan (ping TCP + HTTP HEAD) dari
//     dalam server.
//
// Semua pintu HTTP-nya di handler/shell.go (khusus DEVELOPER),
// ter-audit, dan DIDOKUMENTASIKAN di docs/api/ (satu file markdown
// per keluarga fitur — permintaan pemilik: semua API wajib ada
// berkas docs-nya).
package shell

// Konfigurasi kecil yang dipakai seluruh paket (dipasang main.go).
var (
	// JailRoot: direktori akar penjara — default direktori kerja
	// proses backend. Bisa dipasang SHELL_JAIL_ROOT.
	JailRoot = "."

	// CmdTimeoutDetik: batas waktu jalanan perintah.
	CmdTimeoutDetik = 20
)
