# ChatSphere

A real-time, WhatsApp-style chat application. Full stack, **everything runs in Docker** — no host tooling (Java, Node, Maven) required.

- **Backend** — Java 21, Spring Boot 3.3 (modular monolith), Spring Security (JWT), WebSocket + STOMP, Spring Data JPA, MySQL, Flyway, Redis, Kafka, MinIO.
- **Frontend** — React 19, TypeScript, Vite, React Router, TanStack Query, Zustand, Tailwind CSS, SockJS + STOMP, React Hook Form + Zod, PWA.

## Quick start

```bash
# From this directory:
docker compose up -d --build
# or: make up
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

All configuration is via `.env` (ports, credentials, JWT secret, TTLs). Change the
`JWT_SECRET` before any real deployment.

## Notes on scope

This repository implements the full ChatSphere roadmap as a **modular monolith** that
runs end-to-end on Docker. See `PROJECT_STATUS.md` for a per-feature breakdown of what
is fully implemented versus scaffolded for later (e.g. Spring Cloud microservice split
and Kubernetes manifests).
