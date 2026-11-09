package logger

import (
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"
)

// Level = tingkat kepentingan sebuah log.
type Level string

const (
	LevelInfo    Level = "INFO"  // cyan    : informasi biasa
	LevelSuccess Level = "OK"    // hijau   : keberhasilan
	LevelWarn    Level = "WARN"  // kuning  : peringatan
	LevelError   Level = "ERROR" // merah   : kegagalan
	LevelHTTP    Level = "HTTP"  // magenta : request masuk
)

// Entry = satu baris log lengkap beserta konteksnya.
type Entry struct {
	Time       time.Time
	Level      Level
	Message    string
	IP         string
	UserID     int64
	UserName   string
	Method     string
	Path       string
	Status     int
	DurationMS float64
}

// Kode warna ANSI untuk console.
const (
	ansiReset   = "\033[0m"
	ansiBold    = "\033[1m"
	ansiDim     = "\033[2m"
	ansiRed     = "\033[31m"
	ansiGreen   = "\033[32m"
	ansiYellow  = "\033[33m"
	ansiMagenta = "\033[35m"
	ansiCyan    = "\033[36m"
)

var (
	mu      sync.Mutex
	curDate string
	logFile *os.File
	csvFile *os.File
	csvW    *csv.Writer

	colorEnabled  bool
	fileErrWarned bool
)

var csvHeader = []string{
	"timestamp", "level", "ip", "user_id", "user_name",
	"method", "path", "status", "duration_ms", "message",
}

func init() {
	enableColors()
}

// Dir = folder penyimpanan log (bisa di-override lewat env LOG_DIR).
func Dir() string {
	if d := os.Getenv("LOG_DIR"); d != "" {
		return d
	}
	return "logs"
}

// ---- Fungsi publik yang dipakai seluruh aplikasi ----

func Info(format string, a ...interface{}) {
	write(Entry{Time: time.Now(), Level: LevelInfo, Message: fmt.Sprintf(format, a...)})
}

func Success(format string, a ...interface{}) {
	write(Entry{Time: time.Now(), Level: LevelSuccess, Message: fmt.Sprintf(format, a...)})
}

func Warn(format string, a ...interface{}) {
	write(Entry{Time: time.Now(), Level: LevelWarn, Message: fmt.Sprintf(format, a...)})
}

func Error(format string, a ...interface{}) {
	write(Entry{Time: time.Now(), Level: LevelError, Message: fmt.Sprintf(format, a...)})
}

// HTTPReq mencatat satu request HTTP (dipanggil oleh middleware.Logger).
func HTTPReq(e Entry) {
	e.Time = time.Now()
	e.Level = LevelHTTP
	write(e)
}

// Close menutup file log dengan rapi (dipanggil saat server dimatikan).
func Close() {
	mu.Lock()
	defer mu.Unlock()
	flushFiles()
}

// ---- Mesin internal ----

func write(e Entry) {
	mu.Lock()
	defer mu.Unlock()

	printConsole(e)

	if err := ensureFiles(e.Time); err != nil {
		if !fileErrWarned {
			fileErrWarned = true
			fmt.Fprintln(os.Stderr, "[logger] tidak bisa menulis ke folder "+Dir()+":", err)
		}
		return
	}
	appendLogFile(e)
	appendCSV(e)
}

func paint(code, s string) string {
	if !colorEnabled {
		return s
	}
	return code + s + ansiReset
}

func levelColor(l Level) string {
	switch l {
	case LevelInfo:
		return ansiCyan
	case LevelSuccess:
		return ansiGreen
	case LevelWarn:
		return ansiYellow
	case LevelError:
		return ansiRed
	case LevelHTTP:
		return ansiMagenta
	}
	return ""
}

func printConsole(e Entry) {
	ts := paint(ansiDim, e.Time.Format("2006/01/02 15:04:05"))
	tag := paint(ansiBold+levelColor(e.Level), fmt.Sprintf("[%-5s]", e.Level))

	if e.Level == LevelHTTP {
		fmt.Printf("%s %s %s\n", ts, tag, httpLine(e))
		return
	}
	fmt.Printf("%s %s %s\n", ts, tag, e.Message)
}

func httpLine(e Entry) string {
	status := strconv.Itoa(e.Status)
	switch {
	case e.Status >= 500:
		status = paint(ansiBold+ansiRed, status)
	case e.Status >= 400:
		status = paint(ansiBold+ansiYellow, status)
	case e.Status >= 300:
		status = paint(ansiCyan, status)
	default:
		status = paint(ansiBold+ansiGreen, status)
	}

	dur := fmt.Sprintf("%.1fms", e.DurationMS)
	if e.DurationMS >= 500 {
		dur = paint(ansiYellow, dur)
	}

	user := "guest"
	if e.UserID > 0 {
		user = paint(ansiCyan, fmt.Sprintf("#%d %s", e.UserID, e.UserName))
	}

	sep := " " + paint(ansiDim, "·") + " "
	return status + " " + paint(ansiBold, e.Method) + " " + e.Path +
		sep + dur + sep + "ip=" + e.IP + sep + "user=" + user
}

func appendLogFile(e Entry) {
	ts := e.Time.Format("2006-01-02 15:04:05")
	if e.Level == LevelHTTP {
		fmt.Fprintf(logFile, "[%s] [HTTP] status=%d method=%s path=%s duration_ms=%.1f ip=%s user_id=%d user=%s\n",
			ts, e.Status, e.Method, e.Path, e.DurationMS, e.IP, e.UserID, e.UserName)
		return
	}
	fmt.Fprintf(logFile, "[%s] [%s] %s\n", ts, e.Level, e.Message)
}

func appendCSV(e Entry) {
	if csvW == nil {
		return
	}
	ts := e.Time.Format("2006-01-02 15:04:05")

	status := ""
	dur := ""
	if e.Level == LevelHTTP {
		status = strconv.Itoa(e.Status)
		dur = fmt.Sprintf("%.1f", e.DurationMS)
	}
	userID := ""
	if e.UserID > 0 {
		userID = strconv.FormatInt(e.UserID, 10)
	}

	_ = csvW.Write([]string{
		ts, string(e.Level), e.IP, userID, e.UserName,
		e.Method, e.Path, status, dur, e.Message,
	})
	csvW.Flush()
}

// ensureFiles membuka file log hari ini; ganti file otomatis saat tanggal berganti.
func ensureFiles(t time.Time) error {
	date := t.Format("2006-01-02")
	if logFile != nil && csvFile != nil && curDate == date {
		return nil
	}
	flushFiles()

	if err := os.MkdirAll(Dir(), 0o755); err != nil {
		return err
	}
	lf, err := os.OpenFile(filepath.Join(Dir(), "backend-"+date+".log"),
		os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	cf, err := os.OpenFile(filepath.Join(Dir(), "backend-"+date+".csv"),
		os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		lf.Close()
		return err
	}

	logFile, csvFile = lf, cf
	csvW = csv.NewWriter(csvFile)

	// Header CSV ditulis hanya kalau file masih kosong (file baru).
	if st, err := cf.Stat(); err == nil && st.Size() == 0 {
		_ = csvW.Write(csvHeader)
		csvW.Flush()
	}
	curDate = date
	return nil
}

func flushFiles() {
	if csvW != nil {
		csvW.Flush()
		csvW = nil
	}
	if logFile != nil {
		logFile.Close()
		logFile = nil
	}
	if csvFile != nil {
		csvFile.Close()
		csvFile = nil
	}
	curDate = ""
}
