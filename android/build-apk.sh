#!/usr/bin/env bash
#
# Build the ChatSphere APK pointed at a URL.
#
#   ./build-apk.sh                        # start a Cloudflare tunnel on :5173,
#                                         # auto-grab its URL, bake it into the
#                                         # APK, and keep the tunnel running
#   ./build-apk.sh 5173                   # same, with an explicit local port
#   ./build-apk.sh https://my.fixed.url   # build for a fixed URL (no tunnel)
#
# Everything compiles inside Docker — only cloudflared runs on the host.
set -euo pipefail

ANDROID_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE="chatsphere-apk-builder"
APK="app/build/outputs/apk/debug/app-debug.apk"

ensure_image() {
  if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
    echo "▶ Building the Android builder image (one-time, downloads the SDK)…"
    docker build -t "$IMAGE" "$ANDROID_DIR"
  fi
}

build_apk() {
  local url="$1"
  ensure_image
  echo "▶ Building APK for: $url"
  docker run --rm \
    -v "$ANDROID_DIR":/project \
    -v chatsphere-gradle-cache:/root/.gradle \
    -w /project \
    "$IMAGE" gradle --no-daemon assembleDebug -Papp_url="$url"
  echo "✅ APK: $ANDROID_DIR/$APK"
}

ARG="${1:-5173}"

# A URL argument -> build once for that fixed URL, no tunnel.
if [[ "$ARG" =~ ^https?:// ]]; then
  build_apk "$ARG"
  exit 0
fi

# Otherwise treat the argument as a local port and auto-detect a tunnel URL.
PORT="$ARG"
command -v cloudflared >/dev/null 2>&1 || {
  echo "✗ cloudflared is not on PATH. Install it or pass a URL directly:"
  echo "    ./build-apk.sh https://your-url"
  exit 1
}

LOG="$(mktemp)"
echo "▶ Starting Cloudflare tunnel on http://localhost:$PORT …"
cloudflared tunnel --url "http://localhost:$PORT" >"$LOG" 2>&1 &
TUNNEL_PID=$!
trap 'kill "$TUNNEL_PID" 2>/dev/null || true' EXIT

URL=""
for _ in $(seq 1 30); do
  URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)"
  [ -n "$URL" ] && break
  sleep 1
done
[ -n "$URL" ] || { echo "✗ Couldn't detect a tunnel URL:"; cat "$LOG"; exit 1; }
echo "▶ Detected tunnel URL: $URL"

build_apk "$URL"

echo
echo "🌐 Live URL : $URL"
echo "📦 APK      : $ANDROID_DIR/$APK"
echo "The tunnel is running — keep this terminal open so the APK's URL stays live."
echo "Press Ctrl-C to stop the tunnel."
wait "$TUNNEL_PID"
