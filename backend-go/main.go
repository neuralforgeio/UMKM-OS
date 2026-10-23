package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	// Data zona waktu tertanam di dalam binary: TZ=Asia/Jakarta
	// (dipasang docker-compose) tetap berfungsi di image runtime
	// minimal yang tidak membawa paket tzdata. Karena itu pula
// "hari ini" di laporan mengikuti WIB, bukan UTC container.
	_ "time/tzdata"

	"github.com/go-chi/chi/v5"

	"github.com/neuralforgeio/internal/config"
	"github.com/neuralforgeio/internal/db"
	"github.com/neuralforgeio/internal/handler"
	"github.com/neuralforgeio/internal/logger"
	"github.com/neuralforgeio/internal/middleware"
)

func main() {
	logger.Success("=== UMKM-OS Backend API v%s ===", config.AppVersion)
	logger.Info("Mode development lokal — log harian aktif")

	db.Connect()

	r := chi.NewRouter()

	// Middleware global.
	// URUTAN PENTING: Logger paling luar supaya SEMUA request tercatat,
	// termasuk yang panic, 404, atau ditolak auth.
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.CORS)
	r.Use(middleware.JSON)

	// Public (tanpa login)
	r.Get("/health", handler.Health)

	r.Route("/api/v1", func(api chi.Router) {
		api.Get("/version", handler.Version)
		api.Post("/auth/login", handler.Login)

		// Foto produk: publik — struk & POS memuatnya via tag <img>
		// yang tidak bisa membawa header Authorization.
		api.Get("/images/{id}", handler.ServeImage)

		// Butuh login (OWNER, CASHIER, DEVELOPER)
		api.Group(func(priv chi.Router) {
			priv.Use(middleware.RequireAuth)

			priv.Get("/auth/me", handler.Me)
			priv.Post("/auth/change-password", handler.ChangePassword)

			priv.Get("/products", handler.ListProducts)
			priv.Get("/products/{id}", handler.GetProduct)

			priv.Post("/transactions", handler.CreateTransaction)
			priv.Get("/transactions", handler.ListTransactions)
			priv.Get("/transactions/{id}", handler.GetTransaction)

			priv.Get("/reports/dashboard", handler.Dashboard)
		})

		// Khusus OWNER & DEVELOPER (era pra-multi-outlet — 1.1.0
		// akan memisahkan developer bersama konsep outlet).
		api.Group(func(mgr chi.Router) {
			mgr.Use(middleware.RequireAuth)
			mgr.Use(middleware.RequireRoleIn("OWNER", "DEVELOPER"))

			mgr.Get("/users", handler.ListUsers)
			mgr.Post("/users", handler.CreateUser)
			mgr.Put("/users/{id}", handler.UpdateUser)
			mgr.Delete("/users/{id}", handler.DeleteUser)

			mgr.Post("/products", handler.CreateProduct)
			mgr.Put("/products/{id}", handler.UpdateProduct)
			mgr.Delete("/products/{id}", handler.DeleteProduct)
			mgr.Put("/products/{id}/active", handler.SetProductActive)
			mgr.Post("/products/{id}/stock", handler.AdjustStock)
			mgr.Post("/products/{id}/images", handler.AddProductImage)

			mgr.Delete("/images/{id}", handler.DeleteImage)
			mgr.Put("/images/{id}/thumb", handler.SetImageThumb)
			mgr.Put("/images/{id}/move", handler.MoveImage)

			mgr.Get("/stock-movements", handler.ListStockMovements)

			mgr.Get("/reports/sales", handler.SalesReport)
			mgr.Get("/reports/top-products", handler.TopProducts)
			mgr.Get("/reports/low-stock", handler.LowStock)

			mgr.Get("/audit-logs", handler.ListAuditLogs)

			// Log sistem (untuk dibaca di frontend nanti)
			mgr.Get("/logs", handler.ListLogFiles)
			mgr.Get("/logs/{date}", handler.ReadLogFile)
		})
	})

	addr := ":" + config.Port()
	srv := &http.Server{
		Addr:              addr,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
	}

	// Server jalan di background supaya main() bisa mendengarkan sinyal berhenti.
	errCh := make(chan error, 1)
	go func() {
		logger.Success("Server jalan di http://localhost%s", addr)
		logger.Info("Log harian tersimpan otomatis di folder %s/ (file .log + .csv per hari)", logger.Dir())
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()

	// Tunggu: Ctrl+C / sinyal berhenti, ATAU error fatal saat start.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-errCh:
		logger.Error("Server gagal jalan: %v", err)
		logger.Close()
		os.Exit(1)
	case <-quit:
	}

	// ===== GRACEFUL SHUTDOWN =====
	// Ctrl+C ditangkap di sini — server tidak lagi mati paksa,
	// jadi tidak ada lagi "exit status 0xc000013a".
	logger.Warn("Sinyal berhenti diterima — menutup server dengan rapi...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("Proses shutdown tidak sempurna: %v", err)
	} else {
		logger.Success("Semua koneksi HTTP sudah ditutup")
	}

	if db.Pool != nil {
		db.Pool.Close()
		logger.Success("Koneksi database ditutup")
	}

	logger.Success("Server berhenti dengan rapi (clean shutdown). Terima kasih, sampai jumpa!")
	logger.Close()
}
