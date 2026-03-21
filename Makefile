.PHONY: start test migrate docker stop clean help

start:
	@echo "Starting PostgreSQL..."
	cd server && docker compose up -d
	@sleep 2
	@test -f server/.env || (cd server && cp .env.example .env && echo "Warning: Please edit server/.env and set JWT_SECRET to a random 32+ character string")
	@echo "Starting Go API server in background..."
	cd server && go run ./cmd/server/main.go & \
		SERVER_PID=$$!; \
		sleep 3; \
		echo "Opening browser..."; \
		if command -v xdg-open > /dev/null; then \
			xdg-open http://localhost:8080; \
		elif command -v open > /dev/null; then \
			open http://localhost:8080; \
		else \
			echo "Could not detect browser command. Please open http://localhost:8080 manually."; \
		fi; \
		wait $$SERVER_PID

test:
	@echo "Running all tests..."
	cd server && go test ./...

migrate:
	@echo "Running database migrations..."
	cd server && migrate -path migrations -database "postgres://bookbuddy:bookbuddy@localhost:5434/bookbuddy?sslmode=disable" up

docker:
	@echo "Starting PostgreSQL..."
	cd server && docker compose up -d

stop:
	@echo "Stopping PostgreSQL..."
	cd server && docker compose down

clean:
	@echo "Stopping and removing PostgreSQL containers..."
	cd server && docker compose down -v

help:
	@echo "Available targets:"
	@echo "  make start    - Start PostgreSQL, Go server, and open browser"
	@echo "  make test     - Run all Go tests"
	@echo "  make migrate  - Run database migrations"
	@echo "  make docker   - Start PostgreSQL containers"
	@echo "  make stop     - Stop PostgreSQL containers"
	@echo "  make clean    - Stop and remove PostgreSQL containers (including volumes)"
	@echo "  make help     - Show this help message"