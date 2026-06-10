#!/bin/bash

set -euo pipefail

SERVICE_NAME="gui/$(id -u)/com.andy.media-server"

echo "== launchd service =="
if launchctl print "$SERVICE_NAME" >/dev/null 2>&1; then
  launchctl print "$SERVICE_NAME"
else
  echo "$SERVICE_NAME is not loaded"
fi

echo
echo "== listeners =="
lsof -nP -iTCP -sTCP:LISTEN | rg ':80|:3000' || true

echo
echo "== backend probe =="
curl -I --max-time 5 http://127.0.0.1:3000 || true

echo
echo "== caddy-facing probe =="
curl -I --max-time 5 http://projector.local || true

echo
echo "== recent backend logs =="
tail -n 40 "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.logs/media-server.stderr.log" 2>/dev/null || true
