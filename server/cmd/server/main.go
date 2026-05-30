package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"github.com/rolfea/book-buddy/server/internal/auth"
	"github.com/rolfea/book-buddy/server/internal/config"
	"github.com/rolfea/book-buddy/server/internal/controller"
	"github.com/rolfea/book-buddy/server/internal/data"
	"github.com/rolfea/book-buddy/server/internal/middleware"
	"github.com/rolfea/book-buddy/server/internal/service"
)

func main() {
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("ping db: %v", err)
	}
	log.Println("database connected")

	store := data.NewStore(db)

	if cfg.Environment == "local" || cfg.Environment == "development" {
		if err := store.SeedDefaultData(context.Background()); err != nil {
			log.Printf("Warning: failed to seed database: %v", err)
		}
	}

	authProvider := auth.NewJWTAuthProvider(cfg.JWTSecret, cfg.JWTExpiryHours)

	libraryClient := data.NewHTTPBookMetadataClient(cfg.OpenLibraryBaseURL)
	booksSvc := service.NewBooksService(store, libraryClient)
	authCtrl := controller.NewAuthController(store, authProvider, cfg.SecureCookies)
	booksCtrl := controller.NewBooksController(booksSvc)

	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("GET /status", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		if _, err := w.Write([]byte(`{"status":"ok"}`)); err != nil {
			log.Printf("failed to write status response: %v", err)
		}
	})

	// Auth routes (no auth middleware)
	mux.HandleFunc("POST /api/auth/register", authCtrl.Register)
	mux.HandleFunc("POST /api/auth/login", authCtrl.Login)
	mux.HandleFunc("POST /api/auth/logout", authCtrl.Logout)

	// Protected routes
	requireAuth := middleware.RequireAuth(authProvider)
	
	mux.Handle("GET /api/auth/me", requireAuth(http.HandlerFunc(authCtrl.Me)))
	
	mux.Handle("GET /api/user/books", requireAuth(http.HandlerFunc(booksCtrl.List)))
	mux.Handle("POST /api/user/books", requireAuth(http.HandlerFunc(booksCtrl.Add)))
	mux.Handle("GET /api/books/lookup", requireAuth(http.HandlerFunc(booksCtrl.Lookup)))
	mux.Handle("PATCH /api/user/books", requireAuth(http.HandlerFunc(booksCtrl.UpdateStatus)))
	mux.Handle("DELETE /api/user/books", requireAuth(http.HandlerFunc(booksCtrl.Remove)))

	// Middleware chain
	// Order: Logging -> CORS -> CSRF -> Mux
	handler := middleware.Chain(
		middleware.Logging,
		middleware.CORS(cfg.CORSAllowedOrigins),
		middleware.CSRF,
	)(mux)

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("listening on %s", addr)
	
	server := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       120 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
	}
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server: %v", err)
	}
}
