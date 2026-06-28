.PHONY: build start test test-e2e migrate docker stop clean help

APP_ENV ?= local

build:
	@echo "Building Go server and migration tool..."
	cd server && CGO_ENABLED=0 go build -o app ./cmd/server/main.go
	cd server && CGO_ENABLED=0 go build -o migrate-tool ./cmd/migrate/main.go

start:
	@echo "Running migrations and starting Go server..."
	cd server && ./migrate-tool && ./app

start-local:
	@echo "Starting PostgreSQL..."
	cd server && docker compose up -d
	@sleep 2
	@test -f server/.env || (cd server && cp .env.example .env && echo "Warning: Please edit server/.env and set JWT_SECRET to a random 32+ character string")
	@echo "Starting Go API server on port 8080..."
	(cd server && go run ./cmd/server/main.go) & \
	SERVER_PID=$$!; \
	echo "Starting Frontend server on port 8081..." ; \
	(cd web-client && npx http-server -p 8081 -c-1) & \
	FRONTEND_PID=$$!; \
	sleep 3; \
	echo "Opening browser to http://localhost:8081..."; \
	if command -v xdg-open > /dev/null; then \
		xdg-open http://localhost:8081; \
	elif command -v open > /dev/null; then \
		open http://localhost:8081; \
	else \
		echo "Could not detect browser command. Please open http://localhost:8081 manually."; \
	fi; \
	trap "kill $$SERVER_PID $$FRONTEND_PID" EXIT; \
	wait $$SERVER_PID $$FRONTEND_PID

test:
	@echo "Running all tests..."
	cd server && go test ./...

test-e2e:
	@echo "Starting PostgreSQL..."
	cd server && docker compose up -d
	@echo "Waiting for database to be ready..."
	@until cd server && docker compose exec db pg_isready -U bookbuddy > /dev/null 2>&1; do \
		echo "PostgreSQL is starting..."; \
		sleep 1; \
	done
	@echo "Running database migrations..."
	@cd server && go run ./cmd/migrate/main.go -db-url "postgres://bookbuddy:bookbuddy@localhost:5434/bookbuddy?sslmode=disable" -path migrations up
	@echo "Running E2E tests..."
	cd e2e && npm test

migrate:
	@echo "Running database migrations for $(APP_ENV) environment..."
	@if [ "$(APP_ENV)" = "production" ]; then \
		cd server && ./migrate-tool -db-url "$$DATABASE_URL" -path migrations up; \
	else \
		cd server && ./migrate-tool -db-url "postgres://bookbuddy:bookbuddy@localhost:5434/bookbuddy?sslmode=disable" -path migrations up; \
	fi

docker:
	@echo "Starting PostgreSQL..."
	cd server && docker compose up -d

stop:
	@echo "Stopping PostgreSQL and other services..."
	cd server && docker compose down
	@-pkill -f "go run ./cmd/server/main.go"
	@-pkill -f "npx http-server"

clean:
	@echo "Stopping and removing PostgreSQL containers..."
	cd server && docker compose down -v

help:
	@echo "Available targets:"
	@echo "  make build       - Build the server"
	@echo "  make start       - Start the Go server (for Render)"
	@echo "  make start-local - Start PostgreSQL, Go server, and open browser"
	@echo "  make test        - Run all Go tests"
	@echo "  make test-e2e    - Run Playwright end-to-end tests (ensures database is running)"
	@echo "  make migrate     - Run database migrations"
	@echo "  make docker      - Start PostgreSQL containers"
	@echo "  make stop        - Stop PostgreSQL containers"
	@echo "  make clean       - Stop and remove PostgreSQL containers (including volumes)"
	@echo "  make help        - Show this help message"
