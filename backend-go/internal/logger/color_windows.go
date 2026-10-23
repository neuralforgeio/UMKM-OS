//go:build windows

package logger

import (
    "syscall"
    "unsafe"
)

const enableVirtualTerminal = 0x0004

// Di Windows, GetConsoleMode & SetConsoleMode TIDAK tersedia di package
// syscall bawaan Go — mereka API milik kernel32.dll. Jadi kita panggil
// langsung ke kernel32.dll lewat LazyDLL (tetap murni library standar,
// tidak butuh dependency baru).
var (
    kernel32           = syscall.NewLazyDLL("kernel32.dll")
    procGetConsoleMode = kernel32.NewProc("GetConsoleMode")
    procSetConsoleMode = kernel32.NewProc("SetConsoleMode")
)

// enableColors menyalakan dukungan warna ANSI di console Windows (PowerShell).
// Kalau output diarahkan ke file (bukan console), pemanggilan ini gagal
// dengan sendirinya dan warna otomatis mati — file redirect tetap bersih.
func enableColors() {
    h := syscall.Stdout // di Windows ini VARIABEL Handle, bukan fungsi

    var mode uint32
    r1, _, _ := procGetConsoleMode.Call(uintptr(h), uintptr(unsafe.Pointer(&mode)))
    if r1 == 0 {
        return // bukan console (mis. output diarahkan ke file) -> warna off
    }
    r2, _, _ := procSetConsoleMode.Call(uintptr(h), uintptr(mode|enableVirtualTerminal))
    if r2 != 0 {
        colorEnabled = true
    }
}
