#!/bin/bash

set -e

cd server

echo "Starting PostgreSQL..."
docker compose up -d

if [ ! -f .env ]; then
    echo ".env not found, copying from .env.example..."
    cp .env.example .env
    echo "Warning: Please edit .env and set JWT_SECRET to a random 32+ character string"
fi

echo "Starting Go API server..."
go run ./cmd/server/main.go &
SERVER_PID=$!

echo "Waiting for server to start..."
sleep 3

echo "Opening browser..."
if command -v xdg-open > /dev/null; then
    xdg-open http://localhost:8080
elif command -v open > /dev/null; then
    open http://localhost:8080
else
    echo "Could not detect browser command. Please open http://localhost:8080 manually."
fi

wait $SERVER_PID