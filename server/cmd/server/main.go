package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strings"
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

	var jwksURI, issuer string
	if cfg.Auth0Domain != "" {
		jwksURI = fmt.Sprintf("https://%s/.well-known/jwks.json", cfg.Auth0Domain)
		issuer = fmt.Sprintf("https://%s/", cfg.Auth0Domain)
	}

	authProvider, err := auth.NewIDPAuthProvider(jwksURI, issuer, cfg.Auth0Audience, cfg.JWTSecret)
	if err != nil {
		log.Fatalf("auth provider init: %v", err)
	}

	var callbackURL string
	if cfg.CORSAllowedOrigins != "" {
		origins := strings.Split(cfg.CORSAllowedOrigins, ",")
		callbackURL = fmt.Sprintf("%s/callback.html", origins[0])
	}

	libraryClient := data.NewHTTPBookMetadataClient(cfg.OpenLibraryBaseURL)
	booksSvc := service.NewBooksService(store, libraryClient)
	authCtrl := controller.NewAuthController(
		store,
		authProvider,
		cfg.SecureCookies,
		cfg.Auth0Domain,
		cfg.Auth0ClientID,
		cfg.Auth0ClientSecret,
		callbackURL,
	)
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
	mux.HandleFunc("POST /api/auth/callback", authCtrl.Callback)
	mux.HandleFunc("POST /api/auth/logout", authCtrl.Logout)
	mux.HandleFunc("POST /api/auth/register", authCtrl.Register)
	mux.HandleFunc("POST /api/auth/login", authCtrl.Login)

	// Protected routes
	requireAuth := middleware.RequireAuth(authProvider, store)
	
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
