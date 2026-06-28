package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Port               string
	DatabaseURL        string
	JWTSecret          string
	JWTExpiryHours     int
	OpenLibraryBaseURL string
	CORSAllowedOrigins string
	SecureCookies      bool
	Environment        string
	Auth0Domain        string
	Auth0ClientID      string
	Auth0ClientSecret  string
	Auth0Audience      string
}

func Load() (*Config, error) {
	jwtExpiry, err := strconv.Atoi(getEnv("JWT_EXPIRY_HOURS", "72"))
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_EXPIRY_HOURS: %w", err)
	}

	cfg := &Config{
		Port:               getEnv("PORT", "8080"),
		DatabaseURL:        getEnv("DATABASE_URL", ""),
		JWTSecret:          getEnv("JWT_SECRET", ""),
		JWTExpiryHours:     jwtExpiry,
		OpenLibraryBaseURL: getEnv("OPEN_LIBRARY_BASE_URL", "https://openlibrary.org"),
		CORSAllowedOrigins: getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:8081"),
		SecureCookies:      getEnv("SECURE_COOKIES", "true") == "true",
		Environment:        getEnv("APP_ENV", "local"),
		Auth0Domain:        getEnv("AUTH0_DOMAIN", ""),
		Auth0ClientID:      getEnv("AUTH0_CLIENT_ID", ""),
		Auth0ClientSecret:  getEnv("AUTH0_CLIENT_SECRET", ""),
		Auth0Audience:      getEnv("AUTH0_AUDIENCE", ""),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	// We only require Auth0 in staging/production environments
	if cfg.Environment == "production" || cfg.Environment == "staging" {
		if cfg.Auth0Domain == "" || cfg.Auth0ClientID == "" {
			return nil, fmt.Errorf("AUTH0_DOMAIN and AUTH0_CLIENT_ID are required in %s environment", cfg.Environment)
		}
	}

	return cfg, nil
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
