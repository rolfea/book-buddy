package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"

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
	authProvider := auth.NewJWTAuthProvider(cfg.JWTSecret, cfg.JWTExpiryHours)

	booksSvc := service.NewBooksService(store)
	authCtrl := controller.NewAuthController(store, authProvider, cfg.SecureCookies)
	booksCtrl := controller.NewBooksController(booksSvc)

	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
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
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("server: %v", err)
	}
}
