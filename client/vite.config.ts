import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/adb": "http://127.0.0.1:3000",
      "/library": "http://127.0.0.1:3000",
      "/play": "http://127.0.0.1:3000",
      "/torrents": "http://127.0.0.1:3000",
      "/vlc": "http://127.0.0.1:3000",
      "/media": "http://127.0.0.1:3000",
    },
  },
});
