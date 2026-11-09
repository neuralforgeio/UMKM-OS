package handler

import (
        "net/http"
        "strconv"

        "github.com/neuralforgeio/internal/db"
        "github.com/neuralforgeio/internal/middleware"
)

// =====================================================================
// SCOPE OUTLET (v1.5.0) — satu penentu "outlet mana yang dimaksud" untuk
// seluruh endpoint ter-scope (produk, transaksi, antrean, refund, stok,
// laporan).
//
// Aturan:
//   DEVELOPER  -> WAJIB ?outlet_id= (konsol dev selalu per-outlet; mode
//                 maintenance frontend mengirimkannya otomatis lewat
//                 cookie dev_outlet). Parameter dari akun lain diabaikan.
//   OWNER/     -> ikatan akun dibaca SEGAR dari users.outlet_id di setiap
//   CASHIER       request (re-bind langsung berlaku tanpa login ulang).
//                 Akun era pra-multi-outlet tanpa ikatan jatuh ke outlet
//                 pertama (outlet utama) — perilaku yang sama dengan era
//                 single-outlet, tidak ada yang tiba-tiba kehilangan akses.
//
// Penegakan scoping tetap di SQL (WHERE outlet_id = ...) — helper ini
// hanya menentukan ANGKA-nya; parameter ?outlet_id dari OWNER/KASIR
// tidak pernah dipercaya.
// =====================================================================

// =====================================================================
// VARIAN SENYAP (v1.6.0) — dipakai LogAudit: menentukan outlet tempat
// aksi terjadi TANPA menulis respons error. Kegagalan resolusi tidak
// boleh membatalkan aksi utama ataupun pencatatan auditnya — audit
// tanpa outlet tetap sah (tampil "—" di konsol), bukan alasan gagal.
//
// Sumber penentu: developer (claims ada) dari ?outlet_id=; selain itu
// dari ikatan SEGAR users.outlet_id milik AKTOR — mencakup juga event
// login/pra-token (mis. auth.go Login) yang belum punya claims di
// context. Login owner/kasir tercatat di outletnya; login developer
// dan aksi konsol dev lintas outlet tercatat tanpa outlet.
// =====================================================================

func resolveAuditOutlet(r *http.Request, userID int64) (int64, bool) {
        if c := middleware.User(r); c != nil && c.Role == "DEVELOPER" {
                id, err := strconv.ParseInt(r.URL.Query().Get("outlet_id"), 10, 64)
                if err != nil || id <= 0 {
                        return 0, false
                }
                return id, true
        }

        var bound *int64
        if err := db.Pool.QueryRow(r.Context(),
                `SELECT outlet_id FROM users WHERE id = $1 AND deleted_at IS NULL`, userID,
        ).Scan(&bound); err == nil && bound != nil && *bound > 0 {
                return *bound, true
        }
        return 0, false
}

func resolveScopeOutlet(w http.ResponseWriter, r *http.Request) (int64, bool) {
        c := middleware.User(r)
        if c == nil {
                Err(w, http.StatusUnauthorized, "Tidak terautentikasi")
                return 0, false
        }

        if c.Role == "DEVELOPER" {
                v := r.URL.Query().Get("outlet_id")
                if v == "" {
                        Err(w, http.StatusBadRequest,
                                "Parameter outlet_id wajib untuk developer — pilih outlet di konsol dev atau masuk mode maintenance")
                        return 0, false
                }
                id, err := strconv.ParseInt(v, 10, 64)
                if err != nil || id <= 0 {
                        Err(w, http.StatusBadRequest, "Parameter outlet_id tidak valid")
                        return 0, false
                }
                var exists bool
                if err := db.Pool.QueryRow(r.Context(),
                        `SELECT EXISTS(SELECT 1 FROM outlets WHERE id = $1)`, id).Scan(&exists); err != nil || !exists {
                        Err(w, http.StatusNotFound, "Outlet tidak ditemukan")
                        return 0, false
                }
                return id, true
        }

        // OWNER / CASHIER: ikatan akun dibaca segar dari database.
        var bound *int64
        if err := db.Pool.QueryRow(r.Context(),
                `SELECT outlet_id FROM users WHERE id = $1 AND deleted_at IS NULL`, c.UserID,
        ).Scan(&bound); err == nil && bound != nil && *bound > 0 {
                return *bound, true
        }

        // Akun tanpa ikatan (era pra-multi-outlet) = outlet utama.
        var first int64
        if err := db.Pool.QueryRow(r.Context(),
                `SELECT id FROM outlets ORDER BY created_at ASC, id ASC LIMIT 1`).Scan(&first); err != nil {
                Err(w, http.StatusConflict,
                        "Belum ada outlet — minta developer membuat outlet lewat konsol dev terlebih dahulu")
                return 0, false
        }
        return first, true
}

// GET /api/v1/my/outlet — identitas outlet konteks pemanggil, SEMUA peran
// yang login. Frontend memakai ini sebagai satu-satunya pintu identitas
// outlet (nama/alamat/telepon/logo) — pengganti fallback prisma.findFirst
// era single-outlet yang selalu menjatuhkan semua orang ke outlet pertama.
func MyOutlet(w http.ResponseWriter, r *http.Request) {
        id, ok := resolveScopeOutlet(w, r)
        if !ok {
                return
        }
        o, err := loadOutlet(r.Context(), id)
        if err != nil {
                Err(w, http.StatusNotFound, "Outlet tidak ditemukan")
                return
        }
        OK(w, o)
}
