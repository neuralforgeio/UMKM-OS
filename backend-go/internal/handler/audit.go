package handler

import (
        "fmt"
        "net/http"
        "regexp"
        "strconv"
        "strings"
        "time"

        "github.com/neuralforgeio/internal/db"
        "github.com/neuralforgeio/internal/logger"
        "github.com/neuralforgeio/internal/middleware"
)

type AuditLog struct {
        ID        int64     `json:"id"`
        UserID    *int64    `json:"user_id"`
        UserName  string    `json:"user_name"`
        UserRole  string    `json:"user_role"`
        OutletID  *int64    `json:"outlet_id"`
        OutletName string   `json:"outlet_name"`
        Action    string    `json:"action"`
        Entity    string    `json:"entity"`
        EntityID  string    `json:"entity_id"`
        Detail    string    `json:"detail"`
        CreatedAt time.Time `json:"created_at"`
}

// LogAudit mencatat aksi user ke tabel audit_logs — sejak v1.6.0 lengkap
// dengan outlet tempat aksi terjadi (resolveAuditOutlet, senyap).
// Kalau gagal, request utama TETAP sukses — audit tidak boleh mematikan fitur.
func LogAudit(r *http.Request, userID int64, action, entity string, entityID int64, detail string) {
        var outletID interface{}
        if id, ok := resolveAuditOutlet(r, userID); ok {
                outletID = id
        }
        _, err := db.Pool.Exec(r.Context(),
                `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, outlet_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
                userID, action, entity, strconv.FormatInt(entityID, 10), detail, outletID)
        if err != nil {
                logger.Error("[audit] gagal mencatat log: %v", err)
        }
}

// Tingkat keseriusan aksi (v1.4.0) — definisi yang sama dengan
// lib/audit-labels.ts di frontend supaya layar dan export tidak pernah
// berbeda pendapat: berakhiran _FAILED = GAGAL, aksi sensitif =
// PERINGATAN, sisanya SUKSES.
var warnAuditActions = map[string]bool{
        "ACCOUNT_DELETE":         true,
        "ACCOUNT_PASSWORD_RESET": true,
        "DELETE_USER":            true,
        "TRANSACTION_REFUND":     true,
        "STOCK_ADJUST":           true,
        "DEV_MAINTENANCE_ENTER":  true,
        "DEV_MAINTENANCE_EXIT":   true,
}

var dateOnlyRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// GET /api/v1/audit-logs (DEVELOPER penuh; OWNER sejak v1.6.0 ter-scope
// ke outletnya sendiri — untuk export spreadsheet dari Pengaturan).
//
// Filter: q (cari bebas di detail/entity/nama aktor), action, actor (id
// user), outlet (id outlet — hanya berlaku untuk developer; owner DIPAKSA
// ke outlet konteksnya dan param itu diabaikan total), level
// (SUKSES/PERINGATAN/GAGAL), from & to (tanggal WIB), plus limit/offset
// untuk paginasi. Respons: {rows, total, actions} — total dipakai
// paginasi, actions = daftar aksi unik untuk dropdown filter.
// limit maksimum 10.000 baris: cukup untuk satu export Excel utuh
// (LOG_EXPORT_ROW_CAP frontend) tanpa panggilan berulang.
func ListAuditLogs(w http.ResponseWriter, r *http.Request) {
        c := middleware.User(r)
        if c == nil {
                Err(w, http.StatusUnauthorized, "Tidak terautentikasi")
                return
        }

        q := r.URL.Query()

        where := []string{"TRUE"}
        args := []interface{}{}

        addArg := func(v interface{}) string {
                args = append(args, v)
                return fmt.Sprintf("$%d", len(args))
        }

        // Scope peran: owner terkunci ke outlet konteksnya (akun tanpa
        // ikatan jatuh ke outlet utama — konsisten dengan endpoint lain);
        // developer bebas dan boleh memfilter satu outlet.
        if c.Role != "DEVELOPER" {
                id, ok := resolveScopeOutlet(w, r)
                if !ok {
                        return
                }
                where = append(where, fmt.Sprintf("a.outlet_id = %s", addArg(id)))
        } else if v := strings.TrimSpace(q.Get("outlet")); v != "" {
                if oid, err := strconv.ParseInt(v, 10, 64); err == nil && oid > 0 {
                        where = append(where, fmt.Sprintf("a.outlet_id = %s", addArg(oid)))
                }
        }

        if v := strings.TrimSpace(q.Get("q")); v != "" {
                p := addArg("%" + strings.ToLower(v) + "%")
                where = append(where, fmt.Sprintf(
                        "(LOWER(a.detail) LIKE %s OR LOWER(a.entity) LIKE %s OR LOWER(a.entity_id) LIKE %s OR LOWER(COALESCE(u.name, '')) LIKE %s)",
                        p, p, p, p))
        }
        if v := strings.TrimSpace(q.Get("action")); v != "" {
                where = append(where, fmt.Sprintf("a.action = %s", addArg(strings.ToUpper(v))))
        }
        if v := strings.TrimSpace(q.Get("actor")); v != "" {
                if uid, err := strconv.ParseInt(v, 10, 64); err == nil {
                        where = append(where, fmt.Sprintf("a.user_id = %s", addArg(uid)))
                }
        }
        // Rentang tanggal ditafsirkan menurut WIB (UTC+7): pengguna memilih
        // "23/10/2026" dan maksudnya hari itu di warung, bukan di jam UTC.
        if v := strings.TrimSpace(q.Get("from")); dateOnlyRe.MatchString(v) {
                where = append(where, fmt.Sprintf(
                        "a.created_at >= ((%s::text || ' 00:00:00')::timestamp AT TIME ZONE 'Asia/Jakarta')", addArg(v)))
        }
        if v := strings.TrimSpace(q.Get("to")); dateOnlyRe.MatchString(v) {
                where = append(where, fmt.Sprintf(
                        "a.created_at < ((%s::text || ' 00:00:00')::timestamp AT TIME ZONE 'Asia/Jakarta' + INTERVAL '1 day')", addArg(v)))
        }
        switch strings.TrimSpace(q.Get("level")) {
        case "GAGAL":
                where = append(where, "a.action LIKE '%\\_FAILED'")
        case "PERINGATAN":
                actions := make([]string, 0, len(warnAuditActions))
                for a := range warnAuditActions {
                        actions = append(actions, "'"+a+"'")
                }
                where = append(where, "a.action IN ("+strings.Join(actions, ",")+")")
        case "SUKSES":
                actions := make([]string, 0, len(warnAuditActions))
                for a := range warnAuditActions {
                        actions = append(actions, "'"+a+"'")
                }
                where = append(where, "a.action NOT LIKE '%\\_FAILED' AND a.action NOT IN ("+strings.Join(actions, ",")+")")
        }

        whereSQL := strings.Join(where, " AND ")

        limit := 50
        if v, err := strconv.Atoi(strings.TrimSpace(q.Get("limit"))); err == nil && v > 0 && v <= 10000 {
                limit = v
        }
        offset := 0
        if v, err := strconv.Atoi(strings.TrimSpace(q.Get("offset"))); err == nil && v >= 0 {
                offset = v
        }

        // Total baris untuk paginasi.
        var total int
        if err := db.Pool.QueryRow(r.Context(),
                fmt.Sprintf(`
        SELECT COUNT(*)
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE %s`, whereSQL), args...,
        ).Scan(&total); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal menghitung audit log")
                return
        }

        lim := addArg(limit)
        off := addArg(offset)
        rows, err := db.Pool.Query(r.Context(), fmt.Sprintf(`
        SELECT a.id, a.user_id, COALESCE(u.name, 'sistem'), COALESCE(u.role, ''),
               a.outlet_id, COALESCE(o.name, ''),
               a.action, a.entity, a.entity_id, a.detail, a.created_at
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.user_id
        LEFT JOIN outlets o ON o.id = a.outlet_id
        WHERE %s
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT %s OFFSET %s`, whereSQL, lim, off), args...)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal mengambil audit log")
                return
        }
        defer rows.Close()

        logs := []AuditLog{}
        for rows.Next() {
                var a AuditLog
                if err := rows.Scan(&a.ID, &a.UserID, &a.UserName, &a.UserRole, &a.OutletID, &a.OutletName,
                        &a.Action, &a.Entity, &a.EntityID, &a.Detail, &a.CreatedAt); err != nil {
                        Err(w, http.StatusInternalServerError, "Gagal membaca audit log")
                        return
                }
                logs = append(logs, a)
        }
        if err := rows.Err(); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal membaca audit log")
                return
        }

        // Daftar aksi unik untuk dropdown filter — dihitung TANPA filter action
        // supaya pilihan tidak menyusut saat satu aksi sedang difilter.
        distinctRows, err := db.Pool.Query(r.Context(),
                `SELECT DISTINCT action FROM audit_logs ORDER BY action ASC`)
        if err != nil {
                Err(w, http.StatusInternalServerError, "Gagal mengambil daftar aksi")
                return
        }
        defer distinctRows.Close()

        actions := []string{}
        for distinctRows.Next() {
                var a string
                if err := distinctRows.Scan(&a); err != nil {
                        Err(w, http.StatusInternalServerError, "Gagal membaca daftar aksi")
                        return
                }
                actions = append(actions, a)
        }
        if err := distinctRows.Err(); err != nil {
                Err(w, http.StatusInternalServerError, "Gagal membaca daftar aksi")
                return
        }

        OK(w, map[string]interface{}{
                "rows":    logs,
                "total":   total,
                "actions": actions,
        })
}
