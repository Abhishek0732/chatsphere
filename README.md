# ChatSphere

A real-time, WhatsApp-style chat application. Full stack, **everything runs in Docker** — no host tooling (Java, Node, Maven) required.

- **Backend** — Java 21, Spring Boot 3.3 (modular monolith), Spring Security (JWT), WebSocket + STOMP, Spring Data JPA, MySQL, Flyway, Redis, Kafka, MinIO.
- **Frontend** — React 19, TypeScript, Vite, React Router, TanStack Query, Zustand, Tailwind CSS, SockJS + STOMP, React Hook Form + Zod, PWA.

## Quick start

The only requirement on your machine is **Docker** (with Docker Compose) — no Java,
Node or MySQL install needed.

```bash
# 1. Clone
git clone https://github.com/Abhishek0732/chatsphere.git
cd chatsphere

# 2. Create your env file from the template
cp .env.example .env
#    Edit .env if you like. To share the app with others on your network, set
#    PUBLIC_HOST to your LAN IP (e.g. 192.168.1.50) instead of "localhost".

# 3. Build + start the whole stack (detached)
docker compose up -d --build
#    or: make up

# 4. Wait for the backend to become healthy (~1 min on first run)
docker compose ps
docker compose logs -f backend    # look for "Started ... in N seconds", then Ctrl-C
```

First build takes a few minutes (Maven + npm run inside the containers). Then:

| Service            | URL                              |
|--------------------|----------------------------------|
| Frontend (app)     | http://localhost:5173            |
| Backend API        | http://localhost:8080/api        |
| Backend health     | http://localhost:8080/actuator/health |
| MinIO console      | http://localhost:9001            |
| Adminer (DB UI)    | http://localhost:8081            |

### Demo accounts (seeded)

| Username | Password   | Role  |
|----------|------------|-------|
| `admin`  | `password` | ADMIN |
| `alice`  | `password` | USER  |
| `bob`    | `password` | USER  |

You can also register a new account from the UI.

> Try it: open the app in two browsers, log in as `alice` and `bob`, search for the
> other user, start a chat, and watch messages, typing indicators, presence dots and
> read receipts update live.

## Architecture

```
React SPA ──REST──▶ Spring Boot ──▶ MySQL (Flyway-managed schema)
    │                   │──▶ Redis   (presence heartbeats)
    └──WebSocket/STOMP──┤──▶ Kafka   (message event stream)
                        └──▶ MinIO   (file / image storage)
```

Backend modules (single deployable, package-per-module): `auth`, `user`, `contact`,
`chat`, `group`, `notification`, `media`, `presence`, `search`, `admin`, plus
`common` (security, config, error handling) and `messaging` (Kafka).

## Common commands

```bash
make up            # build + start everything
make logs          # tail all logs
make backend-logs  # tail backend only
make down          # stop (keep data)
make clean         # stop + wipe volumes (DB, MinIO)
make rebuild       # no-cache rebuild
```

## Configuration

All configuration is via `.env` (ports, credentials, JWT secret, TTLs). Copy the
committed `.env.example` template to `.env` and adjust as needed — your real `.env`
is gitignored so secrets never get committed. Change the `JWT_SECRET` before any real
deployment. After changing `PUBLIC_HOST`, rebuild the frontend (URLs are baked in at
build time): `docker compose up -d --build frontend backend`.

## Notes on scope

This repository implements the full ChatSphere roadmap as a **modular monolith** that
runs end-to-end on Docker. See `PROJECT_STATUS.md` for a per-feature breakdown of what
is fully implemented versus scaffolded for later (e.g. Spring Cloud microservice split
and Kubernetes manifests).
