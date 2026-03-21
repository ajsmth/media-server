import express from "express";
import path from "node:path";
import type {
  AdbStatus,
  CreateTorrentRequestBody,
  ErrorResponse,
  LaunchVlcResponse,
  LibraryCatalogSnapshot,
  PlayRequestBody,
  PlayResponse,
  TorrentDownloadRecord,
} from "@media-server/shared";

import { config } from "./config";
import { AndroidDeviceClient } from "./services/android-device-client";
import { BrowserMediaTranscoder } from "./services/browser-media-transcoder";
import { LibraryCatalogService } from "./services/library-catalog-service";
import { MediaLibrary } from "./services/media-library";
import { TorrentDownloadService } from "./services/torrent-download-service";
import { VlcRemoteController } from "./services/vlc-remote-controller";

type TorrentParams = {
  id: string;
};

type LibraryFileParams = {
  fileId: string;
};

const app = express();
const mediaLibrary = new MediaLibrary(config.mediaDir);
const browserMediaTranscoder = new BrowserMediaTranscoder(config.browserMediaDir);
const libraryCatalog = new LibraryCatalogService(mediaLibrary, {
  mediaDir: config.mediaDir,
  indexFilePath: config.libraryIndexFile,
});
const torrentDownloadService = new TorrentDownloadService(
  mediaLibrary,
  config.incompleteDownloadsDir,
  browserMediaTranscoder,
  () => libraryCatalog.rescan().then(() => undefined),
);
const androidDeviceClient = new AndroidDeviceClient({
  host: config.nebulaIp,
  port: config.adbPort,
});
const vlcRemoteController = new VlcRemoteController(androidDeviceClient, {
  packageName: config.vlcPackage,
  appActivityName: config.vlcAppActivity,
  playbackActivityName: config.vlcPlaybackActivity,
});

app.use(express.json());
app.use("/media", express.static(config.mediaDir));
app.use(express.static(config.clientDistDir));

app.get("/api/library", (_req, res) => {
  res.json(libraryCatalog.getSnapshot());
});

app.get("/api/library/status", (_req, res) => {
  res.json(libraryCatalog.getStatus());
});

app.post(
  "/api/library/rescan",
  async (
    _req: express.Request<Record<string, never>, LibraryCatalogSnapshot | ErrorResponse>,
    res,
    next,
  ) => {
    try {
      const snapshot = await libraryCatalog.rescan();
      res.json(snapshot);
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/library/files/:fileId/source", async (req, res, next) => {
  try {
    const existingFile = await libraryCatalog.resolveSourceFilePath(req.params.fileId);

    if (!existingFile) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    res.sendFile(existingFile);
  } catch (error) {
    next(error);
  }
});

app.get(
  "/api/library/files/:fileId/browser",
  async (req: express.Request<LibraryFileParams>, res, next) => {
    try {
      const existingFile = await libraryCatalog.resolveBrowserFilePath(req.params.fileId);

      if (!existingFile) {
        res.status(404).json({ error: "Browser-ready copy not found" });
        return;
      }

      res.sendFile(existingFile);
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/adb/status", async (_req, res, next) => {
  try {
    const status = await androidDeviceClient.getStatus();
    res.json(status);
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/adb/connect",
  async (
    _req: express.Request<Record<string, never>, AdbStatus>,
    res,
    next,
  ) => {
    try {
      await androidDeviceClient.connect();
      const status = await androidDeviceClient.getStatus();
      res.json(status);
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/play",
  async (
    req: express.Request<Record<string, never>, PlayResponse | ErrorResponse, PlayRequestBody>,
    res,
    next,
  ) => {
    try {
      const fileId = req.body.fileId;

      if (!fileId) {
        res.status(400).json({ error: "A file ID is required" });
        return;
      }

      const file = libraryCatalog.findFileById(fileId);

      if (!file) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      const fileUrl = new URL(
        file.sourceUrl,
        `http://${config.playbackHost}:${config.serverPort}`,
      );

      console.log(`Sending VLC media intent for ${fileUrl.toString()}`);
      const launch = await vlcRemoteController.playMediaUrl(fileUrl.toString());
      console.log("[vlc] media launch output:", launch.launch.stdout || "<no output>");

      res.json({ status: "playing", fileId, launch });
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/vlc/launch",
  async (_req: express.Request<Record<string, never>, LaunchVlcResponse>, res, next) => {
    try {
      console.log("Launching VLC app");
      const launch = await vlcRemoteController.launchApp();
      console.log("[vlc] app launch output:", launch.launch.stdout || "<no output>");

      res.json({ status: "launched", launch: launch.launch });
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/torrents", (_req, res) => {
  const downloads = torrentDownloadService.listDownloads();
  res.json(downloads);
});

app.post(
  "/api/torrents",
  async (
    req: express.Request<Record<string, never>, TorrentDownloadRecord, CreateTorrentRequestBody>,
    res,
    next,
  ) => {
    try {
      const magnetLink = req.body.magnetLink;

      if (!magnetLink) {
        res.status(400).json({ error: "A magnet link is required" } as never);
        return;
      }

      const download = await torrentDownloadService.startDownload(magnetLink);
      res.status(201).json(download);
    } catch (error) {
      next(error);
    }
  },
);

app.delete(
  "/api/torrents/:id",
  async (req: express.Request<TorrentParams>, res, next) => {
    try {
      const download = await torrentDownloadService.cancelDownload(req.params.id);
      res.json(download);
    } catch (error) {
      next(error);
    }
  },
);

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
  await libraryCatalog.initialize();

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
