# ChatSphere end-to-end regression suite

This suite talks to a **real running ChatSphere** — the actual HTTP API and the actual STOMP
WebSocket — and re-checks the things this project has actually broken before: messages silently
lost under a deadlock, the chat list crashing after someone deleted their account, status
"add to my status" permissions, login rate limiting, and the latency budgets on the screens
people look at first. Bring the stack up (`docker compose up -d`, frontend on :5173, backend on
:8080, Mailpit on :8025, demo users `alice`/`bob` with password `password`), then run
`cd tests && npm install && npm test`. Every check prints ✓/✗ with its timing, the run exits
non-zero if anything failed, and it is safe to run over and over — it cleans up the messages and
statuses it creates, and isolates itself from previous runs (fresh rate-limit buckets, unique
nonces, per-run throwaway accounts). Point it somewhere else with `API_URL`, `WS_URL` and
`MAILPIT_URL` if your ports differ.
