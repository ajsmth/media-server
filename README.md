# Media Server

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
