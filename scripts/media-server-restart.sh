#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST_SOURCE="$REPO_ROOT/ops/com.andy.media-server.plist"
PLIST_TARGET="$HOME/Library/LaunchAgents/com.andy.media-server.plist"
SERVICE_NAME="gui/$(id -u)/com.andy.media-server"

cd "$REPO_ROOT"
yarn build
mkdir -p "$REPO_ROOT/.logs"
mkdir -p "$HOME/Library/LaunchAgents"
cp "$PLIST_SOURCE" "$PLIST_TARGET"

if launchctl print "$SERVICE_NAME" >/dev/null 2>&1; then
  launchctl kickstart -k "$SERVICE_NAME"
else
  launchctl bootstrap "gui/$(id -u)" "$PLIST_TARGET"
  launchctl kickstart -k "$SERVICE_NAME"
fi

echo "Waiting for $SERVICE_NAME to serve requests..."
deadline=$((SECONDS + 60))
while ((SECONDS < deadline)); do
  if curl --fail --silent --show-error --head --max-time 2 http://127.0.0.1:3000 >/dev/null 2>&1; then
    echo "Ready: http://127.0.0.1:3000"
    exit 0
  fi
  sleep 1
done

echo "Server did not become ready within about 60 seconds. Check .logs/media-server.stderr.log" >&2
exit 1
