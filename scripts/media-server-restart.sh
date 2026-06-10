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

echo "Restarted $SERVICE_NAME"
curl -I http://127.0.0.1:3000
