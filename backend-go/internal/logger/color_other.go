//go:build !windows

package logger

// enableColors: di Linux/macOS terminal sudah mendukung ANSI secara default.
func enableColors() {
    colorEnabled = true
}
