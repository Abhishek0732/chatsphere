#!/usr/bin/env bash
#
# Publish the running app on a temporary public https URL (Cloudflare quick tunnel).
#
#   ./scripts/tunnel.sh          # tunnel http://localhost:5173 (the frontend)
#   ./scripts/tunnel.sh 5173     # explicit port
#
# Why this exists rather than a bare `cloudflared tunnel --url`:
#
# cloudflared defaults to QUIC, which carries the tunnel over UDP. Linux ships a
# 208 KB UDP receive buffer (net.core.rmem_max), far below what QUIC wants, so
# cloudflared warns and throughput collapses on big request bodies. Every small
# JSON request still works — but sending a photo, a video, or status media stalls
# mid-upload and fails. That is the "everything works except media on the tunnel
# URL" bug. http2 is plain TCP and has no such ceiling.
#
# To use QUIC instead, raise the buffers first and set CF_PROTOCOL=quic:
#   sudo sysctl -w net.core.rmem_max=7500000 net.core.wmem_max=7500000
set -euo pipefail

PORT="${1:-5173}"

command -v cloudflared >/dev/null 2>&1 || {
  echo "✗ cloudflared is not on PATH. Install it from"
  echo "  https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
  exit 1
}

curl -sf -o /dev/null "http://localhost:$PORT" || {
  echo "✗ Nothing is answering on http://localhost:$PORT — start the stack first:"
  echo "    docker compose up -d"
  exit 1
}

echo "▶ Tunnelling http://localhost:$PORT over ${CF_PROTOCOL:-http2} …"
exec cloudflared tunnel --url "http://localhost:$PORT" \
  --protocol "${CF_PROTOCOL:-http2}" --no-autoupdate
