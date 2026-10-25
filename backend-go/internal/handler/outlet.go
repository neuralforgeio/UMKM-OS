package handler

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/neuralforgeio/internal/db"
	"github.com/neuralforgeio/internal/middleware"
)

// =====================================================================
// OUTLET (v1.4.0) — identitas warung kini milik backend-go.
//
// Tabel `outlets` dibuat oleh migrasi #7; identitas lama era Prisma
// (tabel PascalCase "Outlet") diimpor SEKALI saat boot pertama v1.4.0
// (lihat db.importLegacyOutlets) supaya nama/alamat/logo yang sudah
// diatur pemilik tidak hilang. Setelah itu seluruh halaman — konsol
// dev, kelola akun, pengaturan outlet, dan struk publik — membaca
// identitas outlet dari sini, bukan lagi dari Prisma.
// =====================================================================

type OutletResponse struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Address     string    `json:"address"`
	Phone       string    `json:"phone"`
	LogoVersion int       `json:"logo_version"`
	HasLogo     bool      `json:"has_logo"`
	IsActive    bool      `json:"is_active"`
	UserCount   int       `json:"user_count"`
	CreatedAt   time.Time `json:"created_at"`
}

const (
	minOutletNameLength    = 2
	maxOutletNameLength    = 60
	maxOutletAddressLength = 120
	maxOutletPhoneLength   = 32
)

func outletIDFromURL(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		Err(w, http.StatusBadRequest, "ID outlet tidak valid")
		return 0, false
	}
	return id, true
}

// loadOutlet memuat satu outlet + jumlah akun aktif yang terikat padanya.
// Dipakai GetOutlet, banner maintenance, dan validasi sesi maintenance.
func loadOutlet(ctx context.Context, id int64) (*OutletResponse, error) {
	var o OutletResponse
	err := db.Pool.QueryRow(ctx, `
    SELECT o.id, o.name, o.address, o.phone, o.logo_version,
           (o.logo_data IS NOT NULL), o.is_active, o.created_at,
           (SELECT COUNT(*) FROM users u
             WHERE u.outlet_id = o.id AND u.deleted_at IS NULL)
    FROM outlets o
    WHERE o.id = $1`, id,
	).Scan(&o.ID, &o.Name, &o.Address, &o.Phone, &o.LogoVersion,
		&o.HasLogo, &o.IsActive, &o.CreatedAt, &o.UserCount)
	if err != nil {
		return nil, err
	}
	return &o, nil
}

// GET /api/v1/outlets (OWNER / DEVELOPER) — daftar outlet untuk konsol
// dev, opsi ikatan outlet di form akun, dan pengaturan. Urut pembuatan
// (outlet pertama = outlet utama era pra-multi-outlet).
func ListOutlets(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Pool.Query(r.Context(), `
    SELECT o.id, o.name, o.address, o.phone, o.logo_version,
           (o.logo_data IS NOT NULL), o.is_active, o.created_at,
           (SELECT COUNT(*) FROM users u
             WHERE u.outlet_id = o.id AND u.deleted_at IS NULL)
    FROM outlets o
    ORDER BY o.created_at ASC, o.id ASC`)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal mengambil data outlet")
		return
	}
	defer rows.Close()

	outlets := []OutletResponse{}
	for rows.Next() {
		var o OutletResponse
		if err := rows.Scan(&o.ID, &o.Name, &o.Address, &o.Phone, &o.LogoVersion,
			&o.HasLogo, &o.IsActive, &o.CreatedAt, &o.UserCount); err != nil {
			Err(w, http.StatusInternalServerError, "Gagal membaca data outlet")
			return
		}
		outlets = append(outlets, o)
	}
	if err := rows.Err(); err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membaca data outlet")
		return
	}
	OK(w, outlets)
}

// GET /api/v1/outlets/{id} (OWNER / DEVELOPER).
func GetOutlet(w http.ResponseWriter, r *http.Request) {
	id, ok := outletIDFromURL(w, r)
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

type OutletPayload struct {
	Name    string `json:"name"`
	Address string `json:"address"`
	Phone   string `json:"phone"`
}

// POST /api/v1/outlets (DEVELOPER) — outlet baru dari konsol dev.
// Nama unik case-insensitive: dua "Warung Bu Ira" di daftar adalah
// resep kebingungan saat memilih ikatan akun kasir.
func CreateOutlet(w http.ResponseWriter, r *http.Request) {
	c := middleware.User(r)
	var req OutletPayload
	if err := Decode(r, &req); err != nil {
		Err(w, http.StatusBadRequest, "Body request tidak valid")
		return
	}

	name := strings.TrimSpace(req.Name)
	address := strings.TrimSpace(req.Address)
	phone := strings.TrimSpace(req.Phone)

	fail := func(reason string) {
		LogAudit(r, c.UserID, "OUTLET_CREATE_FAILED", "outlet", 0, reason)
	}
	if len(name) < minOutletNameLength {
		fail("nama kurang dari 2 karakter")
		Err(w, http.StatusBadRequest, "Nama outlet minimal 2 karakter.")
		return
	}
	if len(name) > maxOutletNameLength {
		fail("nama lebih dari 60 karakter")
		Err(w, http.StatusBadRequest, "Nama outlet maksimal 60 karakter.")
		return
	}
	if len(address) > maxOutletAddressLength {
		fail("alamat lebih dari 120 karakter")
		Err(w, http.StatusBadRequest, "Alamat maksimal 120 karakter.")
		return
	}
	if len(phone) > maxOutletPhoneLength {
		fail("telepon lebih dari 32 karakter")
		Err(w, http.StatusBadRequest, "Nomor telepon maksimal 32 karakter.")
		return
	}

	var clash string
	err := db.Pool.QueryRow(r.Context(),
		`SELECT name FROM outlets WHERE LOWER(name) = LOWER($1) LIMIT 1`, name).Scan(&clash)
	if err == nil {
		reason := "nama kembar dengan outlet \"" + clash + "\""
		fail(reason)
		Err(w, http.StatusConflict, fmt.Sprintf("Outlet \"%s\" sudah ada — nama tidak boleh kembar.", clash))
		return
	}
	if err != pgx.ErrNoRows {
		Err(w, http.StatusInternalServerError, "Gagal memeriksa nama outlet")
		return
	}

	var o OutletResponse
	err = db.Pool.QueryRow(r.Context(), `
    INSERT INTO outlets (name, address, phone)
    VALUES ($1, $2, $3)
    RETURNING id, name, address, phone, logo_version,
              (logo_data IS NOT NULL), is_active, created_at`,
		name, address, phone,
	).Scan(&o.ID, &o.Name, &o.Address, &o.Phone, &o.LogoVersion,
		&o.HasLogo, &o.IsActive, &o.CreatedAt)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membuat outlet")
		return
	}
	o.UserCount = 0

	LogAudit(r, c.UserID, "CREATE_OUTLET", "outlet", o.ID,
		o.Name+strings.TrimSpace(" "+address))
	Created(w, o)
}

type OutletUpdatePayload struct {
	Name    *string `json:"name"`
	Address *string `json:"address"`
	Phone   *string `json:"phone"`
}

// PUT /api/v1/outlets/{id} (OWNER / DEVELOPER) — pembaruan parsial,
// pola COALESCE yang sama dengan UpdateUser: hanya field yang dikirim
// yang berubah, tidak ada race antara baca dan tulis.
func UpdateOutlet(w http.ResponseWriter, r *http.Request) {
	id, ok := outletIDFromURL(w, r)
	if !ok {
		return
	}
	var req OutletUpdatePayload
	if err := Decode(r, &req); err != nil {
		Err(w, http.StatusBadRequest, "Body request tidak valid")
		return
	}
	c := middleware.User(r)
	ctx := r.Context()

	current, err := loadOutlet(ctx, id)
	if err != nil {
		Err(w, http.StatusNotFound, "Outlet tidak ditemukan")
		return
	}

	var name, address, phone *string
	if req.Name != nil {
		v := strings.TrimSpace(*req.Name)
		if len(v) < minOutletNameLength {
			LogAudit(r, c.UserID, "OUTLET_UPDATE_FAILED", "outlet", id, "nama kurang dari 2 karakter")
			Err(w, http.StatusBadRequest, "Nama outlet minimal 2 karakter.")
			return
		}
		if len(v) > maxOutletNameLength {
			LogAudit(r, c.UserID, "OUTLET_UPDATE_FAILED", "outlet", id, "nama lebih dari 60 karakter")
			Err(w, http.StatusBadRequest, "Nama outlet maksimal 60 karakter.")
			return
		}
		name = &v
	}
	if req.Address != nil {
		v := strings.TrimSpace(*req.Address)
		if len(v) > maxOutletAddressLength {
			LogAudit(r, c.UserID, "OUTLET_UPDATE_FAILED", "outlet", id, "alamat lebih dari 120 karakter")
			Err(w, http.StatusBadRequest, "Alamat maksimal 120 karakter.")
			return
		}
		address = &v
	}
	if req.Phone != nil {
		v := strings.TrimSpace(*req.Phone)
		if len(v) > maxOutletPhoneLength {
			LogAudit(r, c.UserID, "OUTLET_UPDATE_FAILED", "outlet", id, "telepon lebih dari 32 karakter")
			Err(w, http.StatusBadRequest, "Nomor telepon maksimal 32 karakter.")
			return
		}
		phone = &v
	}
	if name == nil && address == nil && phone == nil {
		Err(w, http.StatusBadRequest, "Tidak ada perubahan yang dikirim")
		return
	}

	if name != nil && *name != current.Name {
		var clash string
		err := db.Pool.QueryRow(ctx,
			`SELECT name FROM outlets WHERE LOWER(name) = LOWER($1) AND id <> $2 LIMIT 1`,
			*name, id).Scan(&clash)
		if err == nil {
			LogAudit(r, c.UserID, "OUTLET_UPDATE_FAILED", "outlet", id, "nama kembar dengan outlet \""+clash+"\"")
			Err(w, http.StatusConflict, fmt.Sprintf("Outlet \"%s\" sudah ada — nama tidak boleh kembar.", clash))
			return
		}
		if err != pgx.ErrNoRows {
			Err(w, http.StatusInternalServerError, "Gagal memeriksa nama outlet")
			return
		}
	}

	var o OutletResponse
	err = db.Pool.QueryRow(ctx, `
    UPDATE outlets SET
        name    = COALESCE($1, name),
        address = COALESCE($2, address),
        phone   = COALESCE($3, phone)
    WHERE id = $4
    RETURNING id, name, address, phone, logo_version,
              (logo_data IS NOT NULL), is_active, created_at`,
		name, address, phone, id,
	).Scan(&o.ID, &o.Name, &o.Address, &o.Phone, &o.LogoVersion,
		&o.HasLogo, &o.IsActive, &o.CreatedAt)
	if err != nil {
		Err(w, http.StatusNotFound, "Outlet tidak ditemukan")
		return
	}
	o.UserCount = current.UserCount

	changes := []string{}
	if name != nil && *name != current.Name {
		changes = append(changes, fmt.Sprintf("nama \"%s\" → \"%s\"", current.Name, *name))
	}
	if address != nil && *address != current.Address {
		changes = append(changes, "alamat")
	}
	if phone != nil && *phone != current.Phone {
		changes = append(changes, "telepon")
	}
	LogAudit(r, c.UserID, "UPDATE_OUTLET", "outlet", o.ID,
		o.Name+" — "+strings.Join(changes, ", "))
	OK(w, o)
}

// GET /api/v1/outlets/{id}/logo — PUBLIK (tag <img> tidak bisa membawa
// header Authorization, sama seperti foto produk). Cache panjang hanya
// ketika pemanggil menyertakan ?v=N (versi logo — naik setiap unggah
// ulang); tanpa versi cache pendek supaya logo baru cepat terlihat.
func ServeOutletLogo(w http.ResponseWriter, r *http.Request) {
	id, ok := outletIDFromURL(w, r)
	if !ok {
		return
	}

	var mimeType string
	var data []byte
	if err := db.Pool.QueryRow(r.Context(),
		`SELECT logo_mime_type, logo_data FROM outlets WHERE id = $1`, id,
	).Scan(&mimeType, &data); err != nil || len(data) == 0 {
		Err(w, http.StatusNotFound, "Logo outlet belum diunggah")
		return
	}

	w.Header().Set("Content-Type", mimeType)
	w.Header().Set("Content-Length", strconv.Itoa(len(data)))
	if r.URL.Query().Get("v") != "" {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	} else {
		w.Header().Set("Cache-Control", "public, max-age=300")
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

// POST /api/v1/outlets/{id}/logo (OWNER / DEVELOPER) — multipart "file",
// batas ukuran dan tipe sama dengan foto produk. Versi logo naik satu
// supaya semua <img ?v=N> lama langsung cache-bust.
func UploadOutletLogo(w http.ResponseWriter, r *http.Request) {
	id, ok := outletIDFromURL(w, r)
	if !ok {
		return
	}

	var exists bool
	if err := db.Pool.QueryRow(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM outlets WHERE id = $1)`, id).Scan(&exists); err != nil || !exists {
		Err(w, http.StatusNotFound, "Outlet tidak ditemukan")
		return
	}

	if err := r.ParseMultipartForm(maxImageBytes); err != nil {
		Err(w, http.StatusBadRequest, "Berkas logo tidak valid")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		Err(w, http.StatusBadRequest, "Berkas logo tidak valid")
		return
	}
	defer file.Close()

	if header.Size > maxImageBytes {
		Err(w, http.StatusBadRequest, "Logo terlalu besar (maks. 3 MB)")
		return
	}
	mimeType := header.Header.Get("Content-Type")
	if !allowedImageTypes[mimeType] {
		Err(w, http.StatusBadRequest, "Tipe berkas harus JPEG, PNG, atau WebP")
		return
	}

	bytes, err := io.ReadAll(io.LimitReader(file, maxImageBytes+1))
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal membaca berkas logo")
		return
	}
	if len(bytes) > maxImageBytes {
		Err(w, http.StatusBadRequest, "Logo terlalu besar (maks. 3 MB)")
		return
	}
	if len(bytes) == 0 {
		Err(w, http.StatusBadRequest, "Berkas logo kosong")
		return
	}

	var version int
	if err := db.Pool.QueryRow(r.Context(), `
    UPDATE outlets
    SET logo_mime_type = $2, logo_data = $3, logo_version = logo_version + 1
    WHERE id = $1
    RETURNING logo_version`, id, mimeType, bytes).Scan(&version); err != nil {
		Err(w, http.StatusInternalServerError, "Gagal menyimpan logo")
		return
	}

	c := middleware.User(r)
	LogAudit(r, c.UserID, "UPLOAD_OUTLET_LOGO", "outlet", id,
		fmt.Sprintf("logo baru v%d (%s)", version, mimeType))
	OK(w, map[string]interface{}{
		"logo_version": version,
		"has_logo":     true,
	})
}

// DELETE /api/v1/outlets/{id}/logo (OWNER / DEVELOPER).
func DeleteOutletLogo(w http.ResponseWriter, r *http.Request) {
	id, ok := outletIDFromURL(w, r)
	if !ok {
		return
	}

	tag, err := db.Pool.Exec(r.Context(), `
    UPDATE outlets
    SET logo_data = NULL, logo_mime_type = NULL, logo_version = logo_version + 1
    WHERE id = $1 AND logo_data IS NOT NULL`, id)
	if err != nil {
		Err(w, http.StatusInternalServerError, "Gagal menghapus logo")
		return
	}
	if tag.RowsAffected() == 0 {
		Err(w, http.StatusNotFound, "Logo outlet belum diunggah")
		return
	}

	c := middleware.User(r)
	LogAudit(r, c.UserID, "DELETE_OUTLET_LOGO", "outlet", id, "logo dihapus")
	OK(w, map[string]interface{}{"message": "Logo outlet dihapus"})
}

type MaintenanceSessionPayload struct {
	Target string `json:"target"` // "owner" | "cashier"
}

// POST /api/v1/outlets/{id}/maintenance-session (DEVELOPER) — jejak
// audit masuknya developer ke mode "bertindak sebagai staf outlet X".
// Cookie sesinya tetap dikelola Next.js (dev_outlet); tugas endpoint
// ini memastikan outlet sah dan kejadian tercatat di audit_logs.
func EnterMaintenanceSession(w http.ResponseWriter, r *http.Request) {
	id, ok := outletIDFromURL(w, r)
	if !ok {
		return
	}
	var req MaintenanceSessionPayload
	if err := Decode(r, &req); err != nil {
		Err(w, http.StatusBadRequest, "Body request tidak valid")
		return
	}
	req.Target = strings.ToLower(strings.TrimSpace(req.Target))
	if req.Target != "owner" && req.Target != "cashier" {
		Err(w, http.StatusBadRequest, "Target harus owner atau cashier")
		return
	}

	o, err := loadOutlet(r.Context(), id)
	if err != nil {
		Err(w, http.StatusNotFound, "Outlet tidak ditemukan")
		return
	}

	c := middleware.User(r)
	LogAudit(r, c.UserID, "DEV_MAINTENANCE_ENTER", "outlet", o.ID,
		fmt.Sprintf("%s masuk mode maintenance outlet %s — bertindak sebagai %s",
			c.Name, o.Name, strings.ToUpper(req.Target)))
	OK(w, map[string]interface{}{
		"outlet_id":   o.ID,
		"outlet_name": o.Name,
		"target":      req.Target,
	})
}

// DELETE /api/v1/outlets/{id}/maintenance-session (DEVELOPER) — jejak
// audit keluarnya. Idempotent: outlet yang sudah terhapus pun tetap
// tercatat (id-nya disebut di log), keluar mode tidak boleh gagal.
func ExitMaintenanceSession(w http.ResponseWriter, r *http.Request) {
	id, ok := outletIDFromURL(w, r)
	if !ok {
		return
	}

	name := "?"
	if o, err := loadOutlet(r.Context(), id); err == nil {
		name = o.Name
	}

	c := middleware.User(r)
	LogAudit(r, c.UserID, "DEV_MAINTENANCE_EXIT", "outlet", id,
		fmt.Sprintf("%s keluar dari mode maintenance outlet %s", c.Name, name))
	OK(w, map[string]interface{}{"message": "Mode maintenance ditutup"})
}
