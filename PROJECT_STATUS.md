# ChatSphere — Project Status

Honest, per-feature breakdown of what is fully implemented, partially implemented, or
scaffolded for later. The whole stack runs end-to-end on Docker via `docker compose up`.

## Roadmap phases

| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 1 | Backend foundation | ✅ Done | Spring Boot modular monolith, Flyway schema (`V1`), config, error handling |
| 2 | React setup | ✅ Done | Vite + TS + Tailwind + Router + TanStack Query + Zustand |
| 3 | Authentication | ✅ Done | JWT access + rotating refresh tokens, BCrypt, register/login/refresh/logout |
| 4 | User / Profile | ✅ Done | Profile view/edit, user search |
| 5 | Private chat | ✅ Done | Get-or-create 1:1, WebSocket send/receive, history pagination, read receipts, typing |
| 6 | Group chat | ✅ Done | Create group, membership roles, add/remove members, group send/receive |
| 7 | Media | ✅ Done | MinIO upload endpoint; image/file messages |
| 8 | Notifications | ✅ Done | Persisted + pushed over WebSocket; REST list + mark-read |
| 9 | Redis | ✅ Done | Presence heartbeats with TTL, online/last-seen |
| 10 | Kafka | ✅ Done (baseline) | Message events published + consumed (audit log). This is the seam for future services |
| 11 | Spring Cloud migration | ⛔ Scaffolded | Kept as a modular monolith (package-per-module) with clean seams; not split into services |
| 12 | Docker | ✅ Done | Multi-stage Dockerfiles + full `docker-compose` (app + MySQL/Redis/Kafka/MinIO/Adminer) |
| 13 | Kubernetes | ⛔ Not started | Compose-first per request; k8s manifests are a follow-up |
| 14 | Monitoring | 🟡 Partial | Spring Boot Actuator health/info exposed; no Prometheus/Grafana yet |

## Feature checklist (frontend)

| Feature | Status |
|---------|--------|
| Authentication (login/register, protected routes, token refresh) | ✅ |
| Private chat | ✅ |
| Group chat | ✅ |
| Typing indicator | ✅ |
| Online presence | ✅ |
| Read receipts | ✅ |
| File upload | ✅ |
| Notifications | ✅ |
| Dark / Light theme | ✅ |
| Responsive layout | ✅ |
| PWA | 🟡 manifest + service worker registration included; not audited for full offline |

## Known limitations / deliberate simplifications

- **Presence** relies on a single backend instance's Redis heartbeats + STOMP simple
  broker. Horizontal scaling would need a Redis/external STOMP relay (e.g. RabbitMQ)
  instead of the in-memory simple broker.
- **Delivery receipts** track READ (per-user `message_status` + `last_read_message_id`).
  DELIVERED transitions are modelled in the schema but not separately driven yet.
- **Kafka** currently powers an audit consumer; it is intentionally the integration seam
  for the Spring Cloud split (phase 11) rather than the primary message transport.
- **Security**: change `JWT_SECRET` in `.env`; MinIO bucket is set to public-read for
  simple media serving — put it behind signed URLs or a CDN for production.
- **Tests**: the Docker image builds with `-DskipTests`. Add integration tests with
  Testcontainers as a follow-up.

## Verified (smoke-tested on Docker)

Ran against the live stack:
- Health `UP`; Flyway `V1`→`V3` applied; MySQL/Redis/Kafka healthy.
- Register + login; demo logins `alice`/`bob`/`admin` with `password`.
- JWT role enforcement (admin route allows ADMIN, denies USER).
- Create direct + group conversations; conversation list with resolved names/members.
- Media upload to MinIO + public download (HTTP 200).
- **Real-time**: two STOMP clients — Alice → Bob delivery on `/user/queue/messages`
  with `tempId` echo and populated `createdAt`.
- Kafka: message event published and consumed (`chatsphere.messages-0`).

### Minor known items (non-blocking)
- Denying a non-admin on `/api/admin/**` currently returns **401** rather than 403.
  The normal frontend never calls admin routes, so this is cosmetic; add an
  `accessDeniedHandler` to return 403 if an admin UI is added.
- Startup logs a few Spring Data Redis "could not identify store" INFO lines while
  scanning JPA repositories — harmless; silence with
  `spring.data.redis.repositories.enabled: false`.

## Verifying it works

1. `docker compose up -d --build`
2. Wait for `chatsphere-backend` to become healthy (`docker compose ps`).
3. Open http://localhost:5173, log in as `alice` / `password` in one browser and
   `bob` / `password` in another, and exchange messages live.
