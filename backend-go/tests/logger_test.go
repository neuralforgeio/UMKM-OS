package tests

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/neuralforgeio/internal/logger"
)

// TestLoggerGantiDirSesudahClose mengunci perilaku yang ditemukan saat
// menjalankan test di Windows: file log harian dipegang terus selama
// proses hidup, sehingga (1) folder LOG_DIR lama tak bisa dihapus
// selama file masih terbuka, dan (2) LOG_DIR baru diabaikan sampai
// Close() dipanggil. Regression test ini memastikan Close() benar-benar
// melepas pegangan dan penulisan berikutnya membuka file di lokasi baru.

func TestLoggerGantiDirSesudahClose(t *testing.T) {
	dirLama := t.TempDir()
	t.Setenv("LOG_DIR", dirLama)
	logger.Info("baris pertama untuk folder lama")
	logger.Close() // setelah ini semua file harus tertutup & state ter-reset

	dirBaru := t.TempDir()
	t.Setenv("LOG_DIR", dirBaru)
	t.Cleanup(logger.Close) // lepas pegangan sebelum TempDir dihapus (urutan LIFO)
	logger.Info("baris kedua untuk folder baru")

	hari := time.Now().Format("2006-01-02")
	csv := "backend-" + hari + ".csv"
	log := "backend-" + hari + ".log"

	// tulisan kedua harus jatuh ke folder BARU...
	for _, nama := range []string{csv, log} {
		if _, err := os.Stat(filepath.Join(dirBaru, nama)); err != nil {
			t.Fatalf("file %s harus tertulis di folder baru: %v", nama, err)
		}
	}
	// ...dan tulisan pertama tetap tertinggal di folder LAMA
	for _, nama := range []string{csv, log} {
		if _, err := os.Stat(filepath.Join(dirLama, nama)); err != nil {
			t.Fatalf("file %s seharusnya juga ada di folder lama: %v", nama, err)
		}
	}
}

func TestLoggerCloseBisaDipanggilBerkaliKali(t *testing.T) {
	t.Setenv("LOG_DIR", t.TempDir())
	t.Cleanup(logger.Close)

	logger.Info("baris contoh")
	logger.Close()
	logger.Close() // idempoten: pemanggilan ulang tidak boleh panic

	// masih bisa menulis setelah Close ganda — file dibuka ulang
	logger.Info("baris setelah close ganda")
}
