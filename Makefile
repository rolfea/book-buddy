.PHONY: start test migrate docker stop clean help

start:
	@echo "Starting PostgreSQL..."
	cd server && docker compose up -d
	@sleep 2
	@test -f server/.env || (cd server && cp .env.example .env && echo "Warning: Please edit server/.env and set JWT_SECRET to a random 32+ character string")
	@echo "Starting Go API server on port 8080..."
	(cd server && go run ./cmd/server/main.go) & \
	SERVER_PID=$$!; \
	echo "Starting Frontend server on port 8081..." ; \
	(cd web-client && npx http-server -p 8081) & \
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

migrate:
	@echo "Running database migrations..."
	cd server && migrate -path migrations -database "postgres://bookbuddy:bookbuddy@localhost:5434/bookbuddy?sslmode=disable" up

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
	@echo "  make start    - Start PostgreSQL, Go server, and open browser"
	@echo "  make test     - Run all Go tests"
	@echo "  make migrate  - Run database migrations"
	@echo "  make docker   - Start PostgreSQL containers"
	@echo "  make stop     - Stop PostgreSQL containers"
	@echo "  make clean    - Stop and remove PostgreSQL containers (including volumes)"
	@echo "  make help     - Show this help message"
