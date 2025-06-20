# Makefile for Skinora Backend Docker management

.PHONY: help build up down restart logs clean dev prod

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build Docker images
	docker-compose build

up: ## Start all services
	docker-compose up -d

down: ## Stop all services
	docker-compose down

restart: ## Restart all services
	docker-compose restart

logs: ## View logs
	docker-compose logs -f

clean: ## Clean up containers and volumes
	docker-compose down -v
	docker system prune -f

dev: ## Start in development mode
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

prod: ## Start in production mode
	docker-compose up -d

app-logs: ## View app logs only
	docker-compose logs -f app

mongo-logs: ## View MongoDB logs only
	docker-compose logs -f mongo

redis-logs: ## View Redis logs only
	docker-compose logs -f redis

shell-app: ## Access app container shell
	docker-compose exec app sh

shell-mongo: ## Access MongoDB shell
	docker-compose exec mongo mongosh

backup-mongo: ## Backup MongoDB
	docker-compose exec mongo mongodump --db skinora --out /data/backup

restore-mongo: ## Restore MongoDB (requires backup file)
	docker-compose exec mongo mongorestore /data/backup
