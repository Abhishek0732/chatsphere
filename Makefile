# ChatSphere — everything runs in Docker. No host installs required.

.PHONY: up down build rebuild logs ps clean backend-logs frontend-logs

## Build all images and start the whole stack (detached)
up:
	docker compose up -d --build

## Build images without starting
build:
	docker compose build

## Force a clean rebuild (no cache) and start
rebuild:
	docker compose build --no-cache
	docker compose up -d

## Stop and remove containers (keeps volumes/data)
down:
	docker compose down

## Stop and remove containers AND volumes (wipes DB/media)
clean:
	docker compose down -v

## Tail all logs
logs:
	docker compose logs -f

backend-logs:
	docker compose logs -f backend

frontend-logs:
	docker compose logs -f frontend

## Show running services
ps:
	docker compose ps
