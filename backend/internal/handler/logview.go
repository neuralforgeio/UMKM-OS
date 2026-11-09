package handler

import (
	"encoding/csv"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/neuralforgeio/internal/logger"
)

var logDatePattern = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

type LogFileInfo struct {
	Date         string `json:"date"`
	LogFile      string `json:"log_file"`
	CsvFile      string `json:"csv_file"`
	LogSizeBytes int64  `json:"log_size_bytes"`
	CsvSizeBytes int64  `json:"csv_size_bytes"`
}

// GET /api/v1/logs (OWNER) — daftar tanggal yang punya file log.
// Ini yang nanti dipakai halaman frontend untuk memilih tanggal.
func ListLogFiles(w http.ResponseWriter, r *http.Request) {
	entries, err := os.ReadDir(logger.Dir())
	if err != nil {
		if os.IsNotExist(err) {
			OK(w, []LogFileInfo{})
			return
		}
		Err(w, http.StatusInternalServerError, "Gagal membaca folder logs")
		return
	}

	files := map[string]*LogFileInfo{}
	for _, e := range entries {
		name := e.Name()
		if !strings.HasPrefix(name, "backend-") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}

		var ext string
		if strings.HasSuffix(name, ".csv") {
			ext = ".csv"
		} else if strings.HasSuffix(name, ".log") {
			ext = ".log"
		} else {
			continue
		}
		date := strings.TrimSuffix(strings.TrimPrefix(name, "backend-"), ext)
		if !logDatePattern.MatchString(date) {
			continue
		}

		f, ok := files[date]
		if !ok {
			f = &LogFileInfo{Date: date}
			files[date] = f
		}
		if ext == ".csv" {
			f.CsvFile = name
			f.CsvSizeBytes = info.Size()
		} else {
			f.LogFile = name
			f.LogSizeBytes = info.Size()
		}
	}

	list := make([]LogFileInfo, 0, len(files))
	for _, f := range files {
		list = append(list, *f)
	}
	sort.Slice(list, func(i, j int) bool { return list[i].Date > list[j].Date })

	OK(w, list)
}

type LogRow struct {
	Timestamp  string  `json:"timestamp"`
	Level      string  `json:"level"`
	IP         string  `json:"ip"`
	UserID     int64   `json:"user_id"`
	UserName   string  `json:"user_name"`
	Method     string  `json:"method"`
	Path       string  `json:"path"`
	Status     int     `json:"status"`
	DurationMS float64 `json:"duration_ms"`
	Message    string  `json:"message"`
}

// GET /api/v1/logs/{date}?level=&limit= (OWNER) — baca log per tanggal.
// Baris paling baru selalu paling atas (seperti feed).
func ReadLogFile(w http.ResponseWriter, r *http.Request) {
	date := chi.URLParam(r, "date")
	if !logDatePattern.MatchString(date) {
		Err(w, http.StatusBadRequest, "Format tanggal harus YYYY-MM-DD")
		return
	}
	if _, err := time.Parse("2006-01-02", date); err != nil {
		Err(w, http.StatusBadRequest, "Tanggal tidak valid")
		return
	}

	f, err := os.Open(filepath.Join(logger.Dir(), "backend-"+date+".csv"))
	if err != nil {
		Err(w, http.StatusNotFound, "Log tanggal "+date+" tidak ditemukan")
		return
	}
	defer f.Close()

	q := r.URL.Query()
	level := strings.ToUpper(strings.TrimSpace(q.Get("level")))
	limit := 200
	if v, err := strconv.Atoi(q.Get("limit")); err == nil && v > 0 && v <= 1000 {
		limit = v
	}

	rd := csv.NewReader(f)
	rd.FieldsPerRecord = -1
	rows, err := rd.ReadAll()
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membaca file log")
		return
	}

	entries := []LogRow{}
	if len(rows) > 1 {
		header := rows[0]
		idx := map[string]int{}
		for i, h := range header {
			idx[strings.TrimSpace(strings.ToLower(h))] = i
		}
		get := func(row []string, col string) string {
			if i, ok := idx[col]; ok && i < len(row) {
				return row[i]
			}
			return ""
		}

		for _, row := range rows[1:] {
			lv := get(row, "level")
			if level != "" && lv != level {
				continue
			}
			entries = append(entries, LogRow{
				Timestamp:  get(row, "timestamp"),
				Level:      lv,
				IP:         get(row, "ip"),
				UserID:     parseInt64(get(row, "user_id")),
				UserName:   get(row, "user_name"),
				Method:     get(row, "method"),
				Path:       get(row, "path"),
				Status:     int(parseInt64(get(row, "status"))),
				DurationMS: parseFloat(get(row, "duration_ms")),
				Message:    get(row, "message"),
			})
		}
	}

	// Ambil N baris terakhir, lalu dibalik supaya yang terbaru di atas.
	if len(entries) > limit {
		entries = entries[len(entries)-limit:]
	}
	for i, j := 0, len(entries)-1; i < j; i, j = i+1, j-1 {
		entries[i], entries[j] = entries[j], entries[i]
	}

	OK(w, map[string]interface{}{
		"date":    date,
		"count":   len(entries),
		"entries": entries,
	})
}

func parseInt64(s string) int64 {
	v, _ := strconv.ParseInt(s, 10, 64)
	return v
}

func parseFloat(s string) float64 {
	v, _ := strconv.ParseFloat(s, 64)
	return v
}
