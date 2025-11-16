# SyncKit Server - Makefile
# Convenience commands for development and deployment

.PHONY: help dev build start test clean docker-build docker-up docker-down deploy

# Default target
help:
	@echo "SyncKit Server - Available Commands:"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development server with hot reload"
	@echo "  make test         - Run all tests"
	@echo "  make test-watch   - Run tests in watch mode"
	@echo "  make typecheck    - Run TypeScript type checking"
	@echo ""
	@echo "Build:"
	@echo "  make build        - Build production bundle"
	@echo "  make start        - Start production server"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build - Build Docker image"
	@echo "  make docker-up    - Start Docker stack"
	@echo "  make docker-down  - Stop Docker stack"
	@echo "  make docker-logs  - View Docker logs"
	@echo ""
	@echo "Database:"
	@echo "  make db-migrate   - Run database migrations"
	@echo "  make db-backup    - Backup PostgreSQL database"
	@echo "  make db-restore   - Restore PostgreSQL database"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean        - Remove build artifacts"
	@echo "  make clean-all    - Remove all generated files"

# Development
dev:
	bun run dev

test:
	bun test

test-watch:
	bun test --watch

test-unit:
	bun test tests/unit

test-integration:
	bun test tests/integration

test-bench:
	bun test tests/benchmarks

typecheck:
	bun run typecheck

# Build
build:
	bun run build

start:
	bun run start

# Docker
docker-build:
	docker-compose build

docker-up:
	docker-compose up -d

docker-up-dev:
	docker-compose --profile dev up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f synckit-server

docker-ps:
	docker-compose ps

docker-restart:
	docker-compose restart synckit-server

# Database
db-migrate:
	bun run db:migrate

db-backup:
	docker-compose exec postgres pg_dump -U synckit synckit > backup-$(shell date +%Y%m%d-%H%M%S).sql

db-restore:
	@echo "Usage: make db-restore FILE=backup.sql"
	docker-compose exec -T postgres psql -U synckit synckit < $(FILE)

# Cleanup
clean:
	rm -rf dist node_modules

clean-all: clean
	docker-compose down -v
	rm -f *.sql *.log

# Production deployment
deploy: docker-build docker-down docker-up
	@echo "Deployment complete! Check logs with: make docker-logs"

# Health check
health:
	@curl -f http://localhost:8080/health || echo "Server not responding"

# Install dependencies
install:
	bun install

# Format code
format:
	bun run format

# Lint code
lint:
	bun run lint
