package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func main() {
	var (
		dbURL      = flag.String("db-url", os.Getenv("DATABASE_URL"), "Database connection string")
		migrations = flag.String("path", "migrations", "Path to migrations directory")
		command    = flag.String("cmd", "up", "Migration command: up, down")
	)
	flag.Parse()

	if *dbURL == "" {
		log.Fatal("DATABASE_URL must be set via flag -db-url or environment variable")
	}

	m, err := migrate.New(
		fmt.Sprintf("file://%s", *migrations),
		*dbURL,
	)
	if err != nil {
		log.Fatalf("failed to initialize migration: %v", err)
	}
	defer m.Close()

	switch *command {
	case "up":
		if err := m.Up(); err != nil && err != migrate.ErrNoChange {
			log.Fatalf("failed to run migrations up: %v", err)
		}
		log.Println("migrations applied successfully")
	case "down":
		if err := m.Down(); err != nil && err != migrate.ErrNoChange {
			log.Fatalf("failed to run migrations down: %v", err)
		}
		log.Println("migrations reverted successfully")
	default:
		log.Fatalf("unknown command: %s", *command)
	}
}
