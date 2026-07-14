# ChatSphere — everything runs in Docker. No host installs required.

.PHONY: up down build rebuild logs ps clean backend-logs frontend-logs \
        test test-unit test-e2e vapid-keys

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

# ── Tests ────────────────────────────────────────────────────────────────────

## Everything: fast unit tests, then the end-to-end suite (needs the stack up)
test: test-unit test-e2e

## Backend unit tests — no database, no Spring context. Seconds.
test-unit:
	docker run --rm \
		-v "$(PWD)/backend":/app -v "$(HOME)/.m2":/root/.m2 -w /app \
		maven:3.9-eclipse-temurin-21 mvn -q test

## End-to-end regression suite against the RUNNING stack (make up first).
## This is the net that catches the bugs this app has actually shipped:
## lost messages, a deleted user breaking everyone's chat list, a broken limiter.
test-e2e:
	docker run --rm --network host \
		-v "$(PWD)/tests":/tests -w /tests \
		node:22-alpine sh -c "npm install --silent && npm test"

# ── Utilities ────────────────────────────────────────────────────────────────

## Generate a VAPID key pair for Web Push (paste the output into .env)
vapid-keys:
	docker run --rm -v "$(PWD)/scripts":/scripts node:22-alpine \
		node /scripts/generate-vapid-keys.mjs
