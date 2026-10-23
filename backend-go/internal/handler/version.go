package handler

import (
	"net/http"

	"github.com/neuralforgeio/internal/config"
)

// GET /health — cek server hidup (tanpa login, untuk Docker/monitoring)
func Health(w http.ResponseWriter, r *http.Request) {
	OK(w, map[string]interface{}{"status": "ok", "service": "umkm-os-backend"})
}

// GET /api/v1/version — versi komponen backend (Semantic Versioning).
// Frontend memakai endpoint ini untuk halaman Settings -> About.
// Bug fix = naikkan PATCH (1.0.1, 1.0.2, ... boleh lebih dari 10)
// Fitur baru = naikkan MINOR (1.1.0, 1.2.0, ... boleh lebih dari 10)
// Perombakan besar = naikkan MAJOR (2.0.0)
func Version(w http.ResponseWriter, r *http.Request) {
	OK(w, map[string]interface{}{
		"service":   "UMKM-OS Backend API",
		"component": "backend-go",
		"version":   config.AppVersion,
	})
}
