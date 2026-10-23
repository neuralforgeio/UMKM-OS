package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/neuralforgeio/internal/db"
	"github.com/neuralforgeio/internal/logger"
)

type AuditLog struct {
	ID        int64     `json:"id"`
	UserID    *int64    `json:"user_id"`
	UserName  string    `json:"user_name"`
	Action    string    `json:"action"`
	Entity    string    `json:"entity"`
	EntityID  string    `json:"entity_id"`
	Detail    string    `json:"detail"`
	CreatedAt time.Time `json:"created_at"`
}

// LogAudit mencatat aksi user ke tabel audit_logs.
// Kalau gagal, request utama TETAP sukses — audit tidak boleh mematikan fitur.
func LogAudit(r *http.Request, userID int64, action, entity string, entityID int64, detail string) {
	_, err := db.Pool.Exec(r.Context(),
		`INSERT INTO audit_logs (user_id, action, entity, entity_id, detail)
         VALUES ($1, $2, $3, $4, $5)`,
		userID, action, entity, strconv.FormatInt(entityID, 10), detail)
	if err != nil {
		logger.Error("[audit] gagal mencatat log: %v", err)
	}
}

// GET /api/v1/audit-logs?user_id=&action=&limit=100 (OWNER)
func ListAuditLogs(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	where := []string{"TRUE"}
	args := []interface{}{}

	if v := strings.TrimSpace(q.Get("user_id")); v != "" {
		if uid, err := strconv.ParseInt(v, 10, 64); err == nil {
			args = append(args, uid)
			where = append(where, fmt.Sprintf("a.user_id = $%d", len(args)))
		}
	}
	if v := strings.TrimSpace(q.Get("action")); v != "" {
		args = append(args, strings.ToUpper(v))
		where = append(where, fmt.Sprintf("a.action = $%d", len(args)))
	}

	limit := 100
	if v, err := strconv.Atoi(strings.TrimSpace(q.Get("limit"))); err == nil && v > 0 && v <= 500 {
		limit = v
	}
	args = append(args, limit)

	sql := fmt.Sprintf(`
        SELECT a.id, a.user_id, COALESCE(u.name, 'sistem'), a.action, a.entity, a.entity_id, a.detail, a.created_at
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE %s
        ORDER BY a.created_at DESC
        LIMIT $%d`,
		strings.Join(where, " AND "), len(args))

	rows, err := db.Pool.Query(r.Context(), sql, args...)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal mengambil audit log")
		return
	}
	defer rows.Close()

	logs := []AuditLog{}
	for rows.Next() {
		var a AuditLog
		if err := rows.Scan(&a.ID, &a.UserID, &a.UserName, &a.Action, &a.Entity,
			&a.EntityID, &a.Detail, &a.CreatedAt); err != nil {
			Err(w, http.StatusInternalServerError, "Gagal membaca audit log")
			return
		}
		logs = append(logs, a)
	}
	if err := rows.Err(); err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membaca audit log")
		return
	}
	OK(w, logs)
}
