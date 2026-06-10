#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST_SOURCE="$REPO_ROOT/ops/com.andy.media-server.plist"
PLIST_TARGET="$HOME/Library/LaunchAgents/com.andy.media-server.plist"
SERVICE_NAME="gui/$(id -u)/com.andy.media-server"

mkdir -p "$REPO_ROOT/.logs"
mkdir -p "$HOME/Library/LaunchAgents"

cp "$PLIST_SOURCE" "$PLIST_TARGET"

launchctl bootout "gui/$(id -u)" "$PLIST_TARGET" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_TARGET"
launchctl kickstart -k "$SERVICE_NAME"

echo "Installed and started $SERVICE_NAME"
launchctl print "$SERVICE_NAME"
