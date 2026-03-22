import express from "express";
import path from "node:path";
import type { ErrorResponse } from "@media-server/shared";

import { createAppContext } from "./app-context";
import { config } from "./config";
import { createAdbRouter } from "./routers/adb-router";
import { createLibraryRouter } from "./routers/library-router";
import { createPlaybackRouter } from "./routers/playback-router";
import { createTorrentsRouter } from "./routers/torrents-router";

const app = express();
const apiRouter = express.Router();

app.use(express.json());
app.use("/api", apiRouter);
app.use("/media", express.static(config.mediaDir));
app.use(express.static(config.clientDistDir));

app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(config.clientDistDir, "index.html"));
});

app.use((
  error: unknown,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
) => {
  void _next;
  const message =
    error instanceof Error ? error.message : "Unexpected server error";
  console.error(message);
  res.status(500).json({ error: message });
});

async function startServer(): Promise<void> {
  const context = await createAppContext();

  apiRouter.use("/library", createLibraryRouter(context));
  apiRouter.use("/adb", createAdbRouter(context));
  apiRouter.use("/", createPlaybackRouter(context));
  apiRouter.use("/torrents", createTorrentsRouter(context));

  app.listen(config.serverPort, () => {
    console.log(
      `Server running at http://${config.serverHost}:${config.serverPort}`,
    );
  });
}

void startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exitCode = 1;
});
