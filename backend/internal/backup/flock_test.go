package backup

// flock_test.go: kunci lintas proses untuk tes DB sungguhan.
// syscall.Flock hanya di platform unix; di Windows skrip hanya
// memakai satu proses tes sekalian (runner pemilik menjalankan
// selftest tunggal), jadi fallback no-op cukup.

import (
	"os"
	"syscall"
)

func kunciFlock(f *os.File) {
	if f != nil {
		_ = syscall.Flock(int(f.Fd()), syscall.LOCK_EX)
	}
}

func bukaKunciFlock(f *os.File) {
	if f != nil {
		_ = syscall.Flock(int(f.Fd()), syscall.LOCK_UN)
	}
}
