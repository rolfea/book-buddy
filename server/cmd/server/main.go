package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"

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
	authCtrl := controller.NewAuthController(store, authProvider)
	booksCtrl := controller.NewBooksController(booksSvc)

	mux := http.NewServeMux()

	// Auth routes (no auth middleware)
	mux.HandleFunc("POST /auth/register", authCtrl.Register)
	mux.HandleFunc("POST /auth/login", authCtrl.Login)

	// Book routes (require auth)
	requireAuth := middleware.RequireAuth(authProvider)
	mux.Handle("GET /user/books", requireAuth(http.HandlerFunc(booksCtrl.List)))
	mux.Handle("POST /user/books", requireAuth(http.HandlerFunc(booksCtrl.Add)))
	mux.Handle("PATCH /user/books", requireAuth(http.HandlerFunc(booksCtrl.UpdateStatus)))
	mux.Handle("DELETE /user/books", requireAuth(http.HandlerFunc(booksCtrl.Remove)))

	// Static files for web-client (registered last — catch-all)
	staticDir := os.Getenv("WEB_CLIENT_DIR")
	if staticDir == "" {
		staticDir = "../web-client"
	}
	mux.Handle("/", http.FileServer(http.Dir(staticDir)))

	handler := middleware.Chain(middleware.Logging, middleware.CORS)(mux)

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("listening on %s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("server: %v", err)
	}
}
