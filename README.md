# Media Server

## Local network setup

The local network URL is `http://projector.local`.

That works through two machine-level settings on the Mac that hosts this repo:

1. macOS `LocalHostName` is `projector`, which publishes `projector.local` on the LAN.
2. Homebrew `caddy` listens on port `80` and reverse proxies `projector.local` to `127.0.0.1:3000`.

The active Caddy config lives at [`/opt/homebrew/etc/Caddyfile`](/opt/homebrew/etc/Caddyfile):

```caddyfile
http://projector.local {
	reverse_proxy 127.0.0.1:3000
}
```

## Restarting the server

If `http://projector.local` stops loading, the standard recovery path is:

```sh
cd /Users/andy/development/media-server
./scripts/media-server-status.sh
./scripts/media-server-restart.sh
```

If that does not fix it, check the stack in this order:

1. Confirm Caddy is listening on port `80`.
2. Confirm the backend is listening on port `3000`.
3. Check Caddy logs for `connect: connection refused`, which means the proxy is up but the backend is down.

Useful commands:

```sh
lsof -nP -iTCP -sTCP:LISTEN | rg ':80|:3000'
tail -n 80 /opt/homebrew/var/log/caddy.log
```

Start the backend from this repo:

```sh
yarn start
```

## Running it persistently with launchd

For this laptop, the correct long-running setup is:

1. Homebrew `caddy` stays responsible for `http://projector.local`
2. `launchd` keeps the backend from this repo running on `127.0.0.1:3000`

The backend process should be launched from this repo root and should serve the built server bundle:

```sh
node server/dist/server.js
```

The backend now binds to `0.0.0.0` by default so Caddy can consistently reach it at `127.0.0.1:3000`.

Recommended `launchd` behavior:

1. Run at login
2. Restart automatically if the backend exits
3. Use this repo as the working directory
4. Write stdout and stderr to local log files

Useful `launchd` commands:

```sh
launchctl print gui/$(id -u)/com.andy.media-server
launchctl kickstart -k gui/$(id -u)/com.andy.media-server
launchctl bootout gui/$(id -u)/com.andy.media-server
```

Repo helpers:

```sh
./scripts/media-server-install-launchd.sh
./scripts/media-server-restart.sh
./scripts/media-server-status.sh
```

These are intended to be the primary operational interface over SSH.

`launchd` note:

1. The agent runs in the logged-in macOS user session as `gui/$(id -u)/com.andy.media-server`
2. Restarting over SSH works as long as that user session exists
3. If the agent has never been installed on a machine, run `./scripts/media-server-install-launchd.sh` once first
4. The launch agent sets its own `PATH`, including the Android SDK `platform-tools` directory, so projector ADB commands work outside an interactive shell

After the agent is loaded, verify the backend directly:

```sh
lsof -nP -iTCP:3000 -sTCP:LISTEN
curl -I http://127.0.0.1:3000
```

Then verify the Caddy-facing URL:

```sh
curl -I http://projector.local
```

If the backend code changes, rebuild before restarting the agent:

```sh
./scripts/media-server-restart.sh
```

For development, run the backend and Vite separately:

```sh
yarn dev:server
yarn dev:client
```

## Library rescans

Automatic recursive filesystem watching is disabled by default.

Use the manual rescan button in the UI, or call the API directly:

```sh
curl -X POST http://127.0.0.1:3000/api/library/rescan
```

If you need automatic watching again for a small library, set:

```sh
LIBRARY_WATCH_ENABLED=true
```

## Failure note

The previous startup failure was caused by the recursive media watcher exhausting the macOS background-session file watch limit and crashing with `EMFILE: too many open files, watch`.

If projector controls fail with `spawn adb ENOENT`, the backend is up but the running launch agent does not have `adb` on its `PATH`. Reinstall or restart it with:

```sh
./scripts/media-server-install-launchd.sh
./scripts/media-server-restart.sh
```

## Development

Use the backend and client as separate processes during development:

1. Start the backend:

```sh
yarn dev:server
```

2. Start the client Vite dev server in a second terminal:

```sh
yarn dev:client
```

Open `http://localhost:5173`.

The client runs with Vite hot module replacement, and API/media requests are proxied to the backend on `http://127.0.0.1:3000`.
