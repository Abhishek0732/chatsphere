# ChatSphere — Frontend

A messenger-style real-time chat web app. React 19 + TypeScript + Vite 6, TanStack
Query, Zustand, Tailwind CSS v3, STOMP-over-SockJS realtime, PWA.

> The host is **not** used to build. Everything builds inside Docker.
> Do not run `npm install` locally.

## Environment

Configured at **build time** (baked into the static bundle by Vite):

| Variable             | Default                        | Purpose                    |
| -------------------- | ------------------------------ | -------------------------- |
| `VITE_API_BASE_URL`  | `http://localhost:8080/api`    | REST base URL              |
| `VITE_WS_URL`        | `http://localhost:8080/ws`     | SockJS/STOMP endpoint      |

Copy `.env.example` to `.env` for local dev (if you ever run it outside Docker).

## Build & run with Docker

```bash
# from the frontend/ directory
docker build \
  --build-arg VITE_API_BASE_URL=https://api.example.com/api \
  --build-arg VITE_WS_URL=https://api.example.com/ws \
  -t chatsphere-frontend .

docker run --rm -p 8080:80 chatsphere-frontend
# open http://localhost:8080
```

The image is multi-stage: `node:22-alpine` builds the Vite bundle, `nginx:1.27-alpine`
serves it. nginx is configured for SPA fallback (`try_files … /index.html`) and does
**not** proxy `/api` — the frontend talks to the backend directly via the absolute
`VITE_API_BASE_URL` / `VITE_WS_URL`.

## Architecture

- `src/api` — Axios client (with refresh-on-401 interceptor) + typed endpoint wrappers.
- `src/store` — Zustand stores: `authStore`, `themeStore`, `chatStore`, `toastStore`.
- `src/services` — `socket.ts` singleton (STOMP/SockJS) that dispatches into the
  TanStack Query cache + Zustand; `queryClient.ts`; `messageCache.ts` cache helpers.
- `src/hooks` — TanStack Query hooks (conversations, messages, contacts, groups,
  notifications, profile) and utility hooks.
- `src/features` — feature UIs: `auth`, `chat`, `groups`, `contacts`, `profile`, `settings`.
- `src/layouts` — `AppLayout` (nav + socket lifecycle) and `ChatShell` (two-pane).
- `src/routes` — route table + `ProtectedRoute` / `PublicOnlyRoute`.
- `src/pages` — route entry components.

Optimistic sends use a `tempId` that the server echoes back to reconcile the message.
Auth tokens are persisted in `localStorage` via Zustand; a 401 triggers a single-flight
refresh, retries the request, and reconnects the socket.
