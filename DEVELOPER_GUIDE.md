# ChatSphere — Developer Guide

This is the document to read before you touch the code. It explains what ChatSphere is,
how it is put together, how a message actually travels from one person's keyboard to
another person's screen, and — just as importantly — **why** several things are built
the way they are, because a few of them look wrong until you know the story.

`README.md` is the 5-minute quick start (clone, `make up`, log in).
`PROJECT_STATUS.md` is the per-feature "done vs. scaffolded" checklist.
**This file is the map of the system.**

---

## 1. What the app is

A WhatsApp-style real-time chat app. One-to-one and group chat with typing indicators,
read receipts, presence, replies, reactions, editing, pinning, forwarding and search;
24-hour statuses (stories) with music and @mentions; voice and video calling; contacts
by request, QR code or invite link; blocking; notifications; account deletion.

It is a **modular monolith**: one Spring Boot deployable, one React SPA, with the backend
split into packages by domain (`chat`, `status`, `call`, …) that keep clean seams. It is
not microservices, and that is deliberate — see §11.

Rough size: ~8,600 lines of Java across 118 files, ~16,000 lines of TypeScript.

---

## 2. The stack, and where each piece is used

| Piece | Version | What it is actually for here |
|---|---|---|
| Java + Spring Boot | 21 / 3.3.5 | The whole backend: REST, WebSocket, JPA, security |
| MySQL | 8.4 | Everything durable. Schema is Flyway-managed (`V1`…`V28`) |
| Redis | 7.4 | Presence heartbeats, rate limiting, OTP codes, call locks, music cache, **and the pub/sub bus that makes multi-instance realtime work** |
| Kafka | 3.8 | A message-event stream. Today its only consumer writes an audit log line — it is the seam for a future service, not load-bearing |
| MinIO | S3-compatible | Uploaded images, files, avatars, and generated thumbnails |
| Coturn | 4.6 | TURN/STUN relay so calls connect across networks |
| React + TypeScript | 19 / 5.7 | The SPA |
| Vite | 6 | Build tool; also the PWA service worker |
| TanStack Query | 5 | All server state (the cache *is* the state) |
| Zustand | 5 | The small amount of genuinely client-side state |
| Tailwind | 3.4 | Styling, on top of a CSS-variable design-token system |
| STOMP over SockJS | — | The realtime protocol, both directions |
| Mailpit | dev | Catches OTP / password-reset mail in development |

Everything runs in Docker. You do **not** need Java, Node, Maven or MySQL on your machine.

---

## 3. Getting it running

```bash
cp .env.example .env      # never commit .env — it is gitignored on purpose
make up                   # = docker compose up -d --build
docker compose ps         # wait for backend to become healthy (~1 min on first run)
```

| What | Where |
|---|---|
| App | http://localhost:5173 |
| API | http://localhost:8080/api |
| Health | http://localhost:8080/actuator/health |
| Mailpit (read OTP/reset mails) | http://localhost:8025 |
| Adminer (browse the DB) | http://localhost:8081 |
| MinIO console | http://localhost:9001 |

Seeded accounts: `admin`, `alice`, `bob` — all with password `password`.

Other useful targets: `make logs`, `make backend-logs`, `make down` (keep data),
`make clean` (**wipes** the DB and MinIO volumes), `make rebuild` (no cache).

**The one gotcha that will bite you:** the frontend's API and WebSocket URLs are
`VITE_*` variables, which Vite bakes in **at build time**. Changing `PUBLIC_HOST` in
`.env` therefore does nothing until you rebuild:
`docker compose up -d --build frontend backend`.

---

## 4. How the pieces talk

```
                    ┌───────────── React SPA (nginx) ─────────────┐
                    │  REST /api      WebSocket /ws     /media    │
                    └───────┬──────────────┬───────────────┬──────┘
                            │              │               │
                     ┌──────▼──────────────▼──────┐   ┌────▼────┐
                     │      Spring Boot backend   │   │  MinIO  │
                     │  controllers · services    │   └─────────┘
                     └──┬────────┬────────┬───────┘
                        │        │        │
                  ┌─────▼──┐ ┌───▼───┐ ┌──▼────┐
                  │ MySQL  │ │ Redis │ │ Kafka │
                  └────────┘ └───────┘ └───────┘
```

nginx (in the frontend container) serves the SPA and proxies **everything to the same
origin**: `/api` → backend, `/ws` → backend (with WebSocket upgrade), `/media` → MinIO.
That is why media URLs stored in the database are relative (`/media/<bucket>/<key>`) —
it means the app works identically on localhost, over a LAN IP, and through an HTTPS
tunnel, with no absolute host baked into any row. nginx also serves HTTPS with a
self-signed cert, because **browsers only grant microphone access on a secure origin**,
so calls cannot be tested over plain http from another device.

---

## 5. Backend tour (`backend/src/main/java/com/chatsphere/`)

One package per domain. Each typically has a `Controller` (REST), a `Service` (the
logic), entities, and Spring Data repositories.

| Package | What it owns |
|---|---|
| `auth` | Register (with email OTP), login, refresh, logout, forgot/reset/change password |
| `user` | Profile, user directory, QR token, invite code, **account deletion** |
| `contact` | Contact **requests** (you are never added to someone's contacts without consent), QR add, invite links |
| `chat` | The core: conversations, membership, messages, receipts, reactions, pins, edits, search-support |
| `group` | Groups (a `Conversation` of type GROUP), roles, member add/remove, **group invites** |
| `status` | 24-hour statuses: media/text, music, @mentions, privacy audiences, views, replies, "add to my status" |
| `call` | Voice/video call state machine + WebRTC signaling + ICE/TURN config |
| `block` | Blocking, with history (see §9.3) |
| `notification` | Notification rows + live push |
| `presence` | Online/last-seen, Redis-backed |
| `media` | Uploads to MinIO + server-side thumbnails |
| `search` | Full-text message and user search |
| `music` | The status-music catalogue (proxied from the iTunes Search API) |
| `messaging` | Kafka publisher + consumer |
| `admin` | Two stats endpoints, `ROLE_ADMIN` only |
| `common` | Security, config, caching, the realtime relay, rate limiting, error handling, retention |

### REST surface (all under `/api`)

| Base | Endpoints |
|---|---|
| `/auth` | `POST register/send-otp`, `register/verify-otp`, `register`, `login`, `refresh`, `logout`, `forgot-password`, `reset-password` |
| `/account` | `POST password` (change, requires current) |
| `/users` | `GET/PUT me`, `GET me/qr`, `POST me/qr/rotate`, `GET me/invite`, `POST me/invite/rotate`, `DELETE me`, `GET ?search=`, `GET {id}` |
| `/contacts` | `GET`, `POST` (invite), `POST qr`, `POST invite`, `GET requests`, `GET requests/outgoing`, `POST requests/{id}/accept|decline`, `DELETE {id}` |
| `/conversations` | `GET` (chat list), `POST direct`, `GET {id}/messages`, `GET {id}/media`, `GET {id}/common-groups`, `GET {id}/export`, `GET {id}/messages/{msgId}/info`, `POST {id}/read`, `DELETE {id}/messages` (clear for me) |
| `/groups` | `POST`, `GET {id}`, `PUT {id}`, `POST {id}/members`, `GET invites`, `POST invites/{id}/accept|decline`, `PUT {id}/members/{userId}/role`, `DELETE {id}/members/{userId}` |
| `/status` | `GET`, `POST`, `POST {id}/add`, `POST {id}/view`, `POST {id}/reply`, `GET {id}/views`, `GET/PUT privacy`, `DELETE {id}` |
| `/calls` | `GET ice-servers`, `GET active`, `GET` (history), `GET missed/count`, `POST devices` |
| `/blocks` | `GET`, `POST {userId}`, `DELETE {userId}` |
| `/notifications` | `GET`, `POST {id}/read`, `POST read-all` |
| `/search` | `GET messages?q`, `GET users?q` |
| `/music` | `GET categories`, `GET search?q` |
| `/media` | `POST` (multipart upload) |
| `/admin` | `GET stats`, `GET users` |

**Note there is no `POST /messages`.** Sending a message is a WebSocket frame, not a REST
call — see §6.

---

## 6. The message path (the most important thing in the codebase)

The client publishes to the STOMP destination `/app/chat.send`. `ChatWebSocketController.send`
then does, in order:

1. **Persist** — `ChatService.persistMessage` inside a transaction that is now a
   **single INSERT**. Membership is read from an in-memory cache, not the database.
   The call is wrapped in `persistWithRetry` (3 attempts with backoff) because a write
   under contention may still fail and *a message must never be silently lost*.
2. **Build the DTO** — `freshDto()` costs **zero** extra queries: a brand-new message
   cannot have reactions, and the sender's display name is cached. The client's `tempId`
   is echoed back so the optimistic bubble can be reconciled instead of duplicated.
3. **Filter blocked recipients** — `blockService.filterDeliverable()`.
4. **Filter to people who are actually connected** — `presenceService.onlineAmong()`.
   Offline members lose nothing: the message is in the database, they get an unread badge,
   and (if relevant) a notification row.
5. **Broadcast** — `ChatBroadcaster` → `StompRelay` → Redis → **every instance** delivers
   to its own connected sockets (§9.1).
6. **Kafka publish** — `@Async`, off the hot path, failures swallowed (Kafka must never be
   able to break chat).
7. **Notification fan-out** — `@Async` (§9.2).
8. **After commit** — `PostSendWork.finish` (`@Async`, `REQUIRES_NEW`) advances
   `conversations.last_message_id` (with `GREATEST()`, so concurrent sends can't move the
   pointer backwards) and bumps `conversation_members.unread_count`.

### STOMP destinations

**Client → server** (`/app/…`): `chat.send`, `chat.typing`, `chat.read`, `chat.delete`,
`chat.react`, `chat.pin`, `chat.edit`, `presence.ping`, and for calls `call.invite`,
`call.accept`, `call.decline`, `call.cancel`, `call.end`, `call.signal`.

**Server → one user** (`/user/queue/…`): `messages`, `message-updated`, `message-deleted`,
`notifications`, `presence`, `call`.

**Server → a room** (`/topic/…`): `conversations/{id}/typing`, `conversations/{id}/read`.

The socket is authenticated **once, on the STOMP CONNECT frame** (`WebSocketAuthChannelInterceptor`
validates the Bearer token and binds the principal). Because the token is only read at
connect time, the frontend must **reconnect** the socket whenever the access token is
refreshed — it does, via a `onTokenRefreshed` listener.

---

## 7. Frontend tour (`frontend/src/`)

| Directory | Contents |
|---|---|
| `api/` | One thin module per backend domain, plus `client.ts` (the axios instance) and `queryKeys.ts` (every cache key in one place) |
| `hooks/` | The React-facing layer: `useConversations`, `useMessages`, `useSendMessage`, `useStatus`, `useCalls`, … Components call hooks, never `api/` directly |
| `features/` | Vertical slices: `chat/`, `status/`, `call/`, `contacts/`, `groups/`, `settings/`, `profile/`, `auth/` |
| `pages/` | The 15 route-level screens |
| `components/ui/` | Primitives: `Avatar`, `ThumbImage`, `Skeleton`, `Modal`, `Button`, `MentionField`, … |
| `layouts/` | `AppLayout` (the authenticated shell — owns the socket lifecycle) and `ChatShell` (list + thread panes) |
| `services/` | `socket.ts` (the STOMP singleton), `queryClient.ts`, `messageCache.ts` |
| `store/` | Zustand stores (below) |
| `utils/` | `media.ts` (URL handling), `cn.ts`, `format.ts`, `palette.ts`, … |

### State: two systems, one rule

**Server state lives in TanStack Query.** Anything that came from the backend is in the
query cache and nowhere else. `staleTime` is 30s by default and `Infinity` for message
threads — because messages are kept fresh by WebSocket frames, not by refetching.

**Client state lives in Zustand:**

| Store | Holds | Persisted? |
|---|---|---|
| `authStore` | user, access token, refresh token, `hydrated` flag | yes (`chatsphere-auth`) |
| `chatStore` | active conversation, typing users, presence, drafts, reply/edit target | no |
| `callStore` | the active call and its phase, mute/speaker | no |
| `themeStore` | theme, accent, wallpaper, font, corner radius | yes |
| `muteStore` | which conversations are muted | yes |
| `mediaRevealStore` | which received media the user has chosen to load | yes |
| `imageViewerStore` | the lightbox | no |
| `toastStore` | toasts | no |

`authStore` also exports **`authAccessors`** — plain getters/setters so that non-React
code (the axios interceptor, the socket) can read the token without a hook. Same pattern
for `callAccessors` and `muteAccessors`. The `hydrated` flag matters: without it, routes
would redirect to `/login` on refresh, in the instant before the persisted store rehydrates.

### The auth loop

`api/client.ts` attaches `Authorization: Bearer …` to every request. On a **401** it calls
`POST /auth/refresh` **once** (a single-flight promise, so ten concurrent 401s trigger one
refresh, not ten), stores the new tokens, notifies listeners, and replays the original
request. If the refresh itself fails, it logs out, clears the query cache, and redirects.
Refresh tokens are **rotated** on every use, and *any* password change revokes all of them.

### Optimistic sending

`useSendMessage` builds a message with a negative id and a `tempId`, writes it straight
into the cache (`upsertMessage`) so the bubble appears instantly, then publishes over
STOMP. The server echo carries the same `tempId`, which reconciles the optimistic row
instead of duplicating it. If the send fails, the bubble is marked failed rather than
disappearing.

### Styling

Tailwind, with `darkMode: 'class'`. All colours are **CSS variables holding raw RGB
triplets** (e.g. `--c-on-surface: 28 27 31`) so Tailwind's opacity modifiers work.

> **This trips everyone up once:** because the tokens are triplets, not colours, you must
> write `rgb(var(--c-on-surface) / 0.09)`. `color-mix(...)` with these variables silently
> produces nothing.

Themes, accent colours, wallpapers, fonts and corner radius are all user-tunable and are
applied by `themeStore` writing variables onto `<html>`.

### Never show a blank screen

`components/ui/Skeleton.tsx` exports `SkeletonRow / List / Thread / Grid / AppShell`, all
using a shimmer sweep. `SkeletonAppShell` is the `<Suspense>` fallback for the lazily
loaded routes, so even the first paint of a code-split page shows structure, not white.

### Media URLs — read this before touching images

- `mediaSrc(url)` passes relative/blob/data URLs through untouched, rewrites *legacy*
  absolute MinIO URLs to the same-origin `/media/...` form, and **leaves genuinely external
  URLs alone** (music cover art is on Apple's CDN).
- `mediaThumb(url)` returns the backend's thumbnail convention, `<object>.thumb.jpg`.
- `ThumbImage` tries the thumbnail and **falls back to the original internally**. It only
  reports failure upward once the *original* fails. This is not fussiness: a previous
  version forwarded the thumbnail's 404 straight up, so every avatar whose thumbnail was
  missing collapsed to initials. Keep the fallback inside the component.

---

## 8. The data model

Relationships are modelled as **plain foreign-key id columns — there are no JPA
`@ManyToOne` associations anywhere.** That is deliberate: it makes lazy-loading N+1s
impossible to write by accident. You load ids, then batch-load what you need.

| Table | Notes |
|---|---|
| `users` | `deleted_at` marks a closed account; `username`/`email` stay unique forever (§9.5) |
| `conversations` | `type` DIRECT/GROUP; `direct_key` is a deterministic `lo-hi` pair so a 1:1 chat can't be created twice; `public_id` is the non-enumerable id used in URLs; **`last_message_id` is denormalised** |
| `conversation_members` | role OWNER/ADMIN/MEMBER, `last_read_message_id`, **`unread_count` denormalised**, `cleared_up_to_message_id` (per-user "clear chat" floor) |
| `messages` | `reply_to_message_id`, `mentions` (CSV of user ids), `deleted`, `pinned`, `edited_at`, `status_ref_*` (a snapshot of the status a message replies to), FULLTEXT on `content` |
| `message_status` | per-recipient SENT/DELIVERED/READ — this is what "Message info" reads |
| `message_reactions` | (message, user, emoji) |
| `contacts` / `contact_requests` | contacts are **mutual rows**, created only when a request is accepted |
| `group_invites` | a non-contact added to a group gets an invite, not a membership |
| `blocks` | not deleted on unblock — see §9.3 |
| `statuses` / `status_views` | 24h expiry; music metadata; `mentions`; `original_status_id` + `original_user_id` for "add to my status" |
| `status_privacy` / `status_privacy_users` | audience mode ALL / EXCEPT / ONLY plus its user list |
| `notifications`, `user_presence`, `calls`, `devices`, `refresh_tokens`, `password_reset_tokens` | as named |

Schema changes are **Flyway migrations only** (`backend/src/main/resources/db/migration`).
Never edit an applied migration; add `V29__…`. `ddl-auto` is `none` — Hibernate will not
create or alter anything for you.

---

## 9. The decisions that look odd until you know why

### 9.1 All realtime delivery goes through Redis pub/sub

Spring's simple STOMP broker keeps its session registry **in one JVM's heap**. With two
backend instances behind a load balancer, a message from a user on instance A was
persisted and then **silently dropped** for every recipient connected to instance B. No
error, no log — just missing messages.

So nothing sends to a socket directly. Everything (messages, edits, deletes, typing, read
receipts, notifications, presence, call signaling) goes `StompRelay` → Redis channel →
`StompRelayListener` on *every* instance → that instance delivers to its own sockets.
**If you add a new realtime frame, publish it through the relay, not through
`SimpMessagingTemplate` directly.**

### 9.2 A group message does not notify the whole group

It used to write one notification row **per member** — 499 INSERTs for one message into a
500-member group, which buried the database and pushed delivery into the seconds.

It was also simply the wrong behaviour. No chat app lists every group message in a
notification centre; it shows an unread badge, and it notifies you when you are
**@mentioned**. So: a direct message notifies its recipient, and a group message creates
rows only for the people it mentions. Everyone else still gets the live frame, the badge,
and the OS notification — none of which need a row. That one change took a busy
500-member group from **2426ms to 61ms**.

### 9.3 Unblocking does not delete the block row

It sets `unblocked_at`, which turns each row into a **block window**. Messages that
arrived *while* you had someone blocked stay hidden forever, even after you unblock them —
which is what users expect, and what you cannot express if you delete the row.

### 9.4 `@Async` needs the executor bean — do not remove `AsyncConfig`

Without a `taskExecutor` bean, Spring falls back to `SimpleAsyncTaskExecutor`, which
creates **a brand new OS thread per call and never reuses one**. Two things on the send
path are `@Async`, so every message spawned two threads; a few hundred simultaneous
chatters meant thousands of threads, and the machine spent its time context-switching
instead of delivering. Delivery went from ~10ms to **over 2 seconds**. `AsyncConfig` is a
bounded pool with `CallerRunsPolicy` so a backlog can never grow invisibly.

### 9.5 Deleting an account does not delete the user row

`messages.sender_id` is `ON DELETE CASCADE`, so deleting the row would tear holes in
*other people's* chat history. Instead `AccountDeletionService` **anonymises**: sets
`deleted_at`, renames to "Deleted user", clears avatar/about, randomises the password
hash, retires the QR and invite codes, and deletes contacts, requests, group memberships,
blocks, statuses, notifications, devices and tokens.

Two consequences you must preserve:
- The `username` and `email` are **kept**, precisely so nobody can re-register that
  identity.
- DIRECT conversation memberships are **kept on purpose**. An earlier version deleted
  them, which left the counterpart's chat list with a conversation that had no other
  member, no name — and the app crashed on open for that user. Anything reading a DIRECT
  chat's name must tolerate a deleted counterpart ("Deleted user"), and nobody may send
  to one (`assertCounterpartAlive`).

### 9.6 Presence is not broadcast globally

It used to go to one `/topic/presence` that every client subscribed to: at 100k users a
single connect sent 100k frames, and a reconnect storm (a deploy, an LB blip) meant
100k × 100k. Presence now goes only to people who can see it — your contacts and
conversation partners — over per-user queues, capped at 2,000 recipients.

### 9.7 Statuses, notifications and tokens are swept nightly

`RetentionService` runs at 03:20, holds a **Redis lease** so only one instance sweeps,
and deletes expired statuses, notifications older than 30 days, and expired tokens in
bounded batches (2,000 rows per `DELETE`, max 250 batches per table) so it never holds a
long lock. Before it existed, nothing was ever deleted and the hot tables grew forever.

---

## 10. Performance: the rules this codebase lives by

The app is built to be fast at **lakh scale** (100k users, 2M messages) — that is the
standing requirement, not a nice-to-have. Everything is expected to answer in
milliseconds. Measured on a seeded 100k-user / 2M-message database with hundreds of people
chatting simultaneously over real WebSockets:

| | |
|---|---|
| 200 concurrent 1:1 chatters, end-to-end delivery | median **98ms**, p95 329ms, p99 440ms |
| Busy 500-member group | median **61ms** (was 2426ms) |
| Chat list | **51ms** (was >40s — it never loaded) |
| Open a chat | **18ms** |
| Search | **7–8ms** |
| Messages lost | **zero** |

The techniques, so you can follow them in new code:

- **Denormalise what is read on every load.** `conversations.last_message_id` replaced an
  `id IN (SELECT MAX(id) … GROUP BY conversation_id)` that MySQL could not execute well
  (>40s). `conversation_members.unread_count` replaced a `COUNT` per conversation.
  Both are maintained on write.
- **Batch, never N+1.** `listConversationsBatched` / `assembleBatch` load members, users,
  presence, reactions and reply previews **once each** for the whole page. `onlineAmong`
  is one Redis MGET; `lastSeenAmong` is one SQL query.
- **Cache the hot path.** `HotPathCache` (conversation members, user briefs) took the send
  path from ~13 queries per message to ~2. It is invalidated explicitly on join/leave,
  rename, block and deletion — **if you add something that changes membership or a
  display name, invalidate it.**
- **Get work off the send path.** The send transaction is one INSERT; pointers, badges,
  notifications and Kafka all happen after the commit.
- **Do not fan out to people who aren't there.** Live frames go only to connected members.
- **Index for the query you actually run**, and delete indexes nobody uses — they cost on
  every INSERT. `idx_msg_conv_del_id_sender` is the single hottest index in the schema.
- **Guard the slow paths.** Search carries `MAX_EXECUTION_TIME` hints and returns `[]`
  rather than holding a database connection; page sizes are capped; export is capped.
- **Never `LIKE '%q%'` a big table.** User and message search are MySQL FULLTEXT.

There is a memory of this in the repo's own history: read
`git log` around "Concurrency pass", "Pre-launch scale pass" and "Make the app survive
many users at once" — the commit messages are written as post-mortems.

---

## 10a. Notifications: three different things

People confuse these constantly, so they are named here:

1. **The live socket frame** — what makes a message appear in an open app. Reaches
   only somebody who is already looking.
2. **The in-app notification row** (`notifications` table) — the notification centre.
   A direct message writes one; a group message writes one **only for @mentions**
   (§9.2).
3. **Web Push** (`push` package, `push_subscriptions` table) — the only thing that can
   reach a **closed** app. A service worker (`frontend/src/sw.ts`) receives it and
   raises the OS notification.

Push is sent **only to recipients who are offline** (`presenceService.onlineAmong`),
because someone who is connected already got the message over the socket, and pushing
them too would announce it twice. It is `@Async` — a push is an HTTPS round trip to
Google/Mozilla/Apple and has no business sitting between the sender pressing Enter and
the message being delivered. A push that fails never fails the message; a subscription
that returns 404/410 (the browser threw it away) is deleted, or we would retry a dead
endpoint forever.

Push needs VAPID keys (`make vapid-keys` → paste into `.env`). **With no keys it
quietly disables itself** and everything else still works.

## 10b. The offline outbox

A message typed while the socket is down used to be marked FAILED on the spot and the
text was gone. Now it goes into the **outbox** (`store/outboxStore.ts`, persisted to
localStorage, so it survives a reload), shows as **"waiting"** rather than "failed",
and is flushed automatically on reconnect.

Two things here are less obvious than they look, and both were real bugs:

- **`canSend()`, not `isConnected()`.** STOMP only learns the connection is dead when a
  close or heartbeat timeout fires, which can be *seconds* after the network actually
  went. In that window the app happily published into a dead socket — so the messages
  were neither sent nor queued. The send path now also trusts `navigator.onLine`, and
  the socket flips itself to disconnected on the browser's `offline` event.
- **The outbox flushes ONE AT A TIME, waiting for each echo.** This was originally a
  workaround for the server reordering a burst; that is now fixed properly on the server
  (§9.8), so this is belt-and-braces — it also means a flush can't run ahead of itself
  after a dropped echo. Keep it.

### 9.8 One connection's messages are persisted in the order they were typed

The inbound WebSocket channel is a **thread pool**. Two messages sent back-to-back on the
same connection are therefore handed to two different threads and race each other to the
`INSERT` — and the loser can get the **lower id**. A conversation is ordered by id, so the
messages were then stored, and displayed *forever*, in the wrong order. It is easy to
reproduce: paste two lines quickly, or let an offline outbox drain.

The fix is in two small pieces:

- `common/config/InboundSequenceInterceptor` stamps every `chat.send` with its arrival
  position, per connection. A channel interceptor's `preSend` runs on the thread that
  **received** the frame, which is strictly ordered — the last point where the true order
  is still known.
- `chat/SessionOrdering` makes the handler wait until every earlier message from the
  **same connection** has been written.

This only ever makes a sender wait behind *themselves*. Different people and different
connections are never serialised against each other, so throughput is untouched (a 20-
message burst still lands in ~260ms). The wait is bounded at 500ms: if the frame ahead of
us died, we go anyway — a message slightly out of order is bad, a message that never
arrives is far worse.

Only `chat.send` is stamped. Typing and read receipts are not ordered against anything,
and stamping them would make a message wait behind a keystroke.

## 11. Security model

- **JWT access tokens** (HS256, 30 min) + **opaque refresh tokens** (14 days, stored in
  MySQL, rotated on every use, revoked on any password change).
- The WebSocket is authenticated on the CONNECT frame, not per message.
- **Rate limiting** (`RateLimitFilter`, a Redis token bucket so the limit holds across
  instances): login 10/min, OTP and password endpoints 5/10min, upload 60/min, search
  60/min, music 30/min. Returns 429 with `Retry-After`. It **fails open** if Redis is
  down — availability beats the limit. This exists because `/auth/login` runs BCrypt
  (~80ms of CPU) per attempt, so a few hundred requests a second would peg every core and
  take the whole API — including the WebSocket handshake — down with it.
- **OTP codes and password-reset tokens are only ever stored hashed** (SHA-256), in Redis
  and MySQL respectively. Reset tokens are single-use.
- `forgot-password` **always** returns 204, so it cannot be used to enumerate accounts.
- **Consent is required to reach someone:** you cannot add yourself to another user's
  contacts, and adding a non-contact to a group sends them an **invite** rather than
  joining them to it.
- Blocking hides you in both directions, including from status.
- `/api/admin/**` requires `ROLE_ADMIN`.

---

## 12. Calls

Signaling only — **the media never touches the backend**. The browser holds a native
`RTCPeerConnection` (P2P); the server passes offers, answers and ICE candidates over
STOMP, fanned out across instances by Redis pub/sub.

`CallService` is a state machine: `RINGING → ACTIVE | DECLINED | CANCELLED | MISSED |
ENDED | FAILED`, with guards for self-call, blocked, offline and busy. "Busy" is a Redis
lock per user. There is a 45-second ring timeout, backed both by an in-memory timer and a
scheduled sweeper (the sweeper is the cluster-safe backstop).

ICE servers come from `GET /api/calls/ice-servers` in three tiers: Google STUN, then the
self-hosted **Coturn** (with short-lived HMAC credentials), then a free public TURN
(OpenRelay) as the cross-network fallback.

> `livekit/livekit.yaml` and the `chatsphere.media.livekit.*` properties are **dead**. An
> SFU was tried and dropped in favour of P2P. There is no LiveKit service in
> `docker-compose.yml` and no Java code issues LiveKit tokens. Ignore them.

---

## 12a. Tests

```bash
make test-unit    # backend unit tests: no DB, no Spring context. ~5s.
make test-e2e     # end-to-end suite against the RUNNING stack (make up first)
make test         # both
```

- **`backend/src/test/`** — 92 JUnit/Mockito tests over the logic that is either
  security-critical or has actually regressed: the status repost rules, the block
  *window* semantics, account-deletion semantics, the rate limiter, and the
  notification policy (a plain group message must write no rows).
- **`tests/`** — 10 end-to-end checks against the real API and a real WebSocket. This is
  the net for the bugs this app has genuinely shipped: **messages silently lost** under
  concurrency (it sends 20 rapid messages and asserts all 20 persist), **a deleted user
  breaking everyone's chat list**, a status being re-shared by someone who was never
  tagged, and a rate limiter that does not limit.

If you touch the send path, membership, deletion or the limiter, run both before you
push. Neither needs anything installed on your machine — they run in Docker.

## 13. Working on the code

**Adding a backend feature**, in the order that works:
1. A Flyway migration (`V29__…`) if the schema changes.
2. Entity + repository (FK id columns, no JPA associations).
3. Service — think about the query count *per request*, batch anything per-row, and
   invalidate `HotPathCache` if you touched membership or names.
4. Controller — take the user from `SecurityUtils.currentUserId()`; throw `ApiException`
   (the global handler turns it into the standard error shape).
5. If it pushes anything live, send it through **`StompRelay`**.

**Adding a frontend feature:**
1. `api/<domain>.ts` — the raw call.
2. `hooks/use<Thing>.ts` — the query/mutation, with a key from `queryKeys.ts`.
3. The component in `features/<domain>/`, using the design tokens and a `Skeleton` while
   it loads.
4. Never let a component call `api/` directly.

**Rebuilding after a change:**
```bash
docker compose build backend && docker compose up -d backend    # backend
docker compose build frontend && docker compose up -d frontend  # frontend
```
The frontend image runs `tsc` during the build, so a type error fails the build — that is
your typecheck.

**Things to not do:**
- Do not commit `.env`.
- Do not edit a migration that has already been applied.
- Do not push a realtime frame straight through `SimpMessagingTemplate`.
- Do not remove `AsyncConfig` (§9.4).
- Do not add a query inside a loop — batch it.

---

## 14. Known gaps

- No CI. `make test` exists and passes; nothing runs it automatically on push.
- **No end-to-end encryption.** Messages are readable in the database. That is fine for
  this project — but never claim otherwise in the README without doing the work.
- No group calls (calling is 1:1 P2P WebRTC).
- No archive, disappearing messages, view-once media or polls.
- No privacy toggles for last-seen / read receipts (statuses have a full audience model;
  presence does not).
- `docker-compose.yml` pins a `container_name` and a fixed host port on the backend, so
  `--scale backend=N` needs a real load balancer with sticky sessions (the code itself is
  multi-instance-correct — that was verified with two backends and a user on each).
- Kafka's only consumer writes a log line. It is a seam, not a feature.
- No Prometheus/Grafana; Actuator exposes `health` and `info` only.
- No Kubernetes manifests (Compose-first, by choice).
- The microservice split described in the original roadmap is **not** done — see
  `PROJECT_STATUS.md`.
- `android/` is a thin Kotlin WebView wrapper around the hosted app, built on demand; it
  is not part of `docker compose`.
