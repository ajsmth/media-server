import express from "express";
import path from "node:path";

import { config } from "./config.js";
import { AndroidDeviceClient } from "./services/android-device-client.js";
import { BrowserMediaTranscoder } from "./services/browser-media-transcoder.js";
import { MediaLibrary } from "./services/media-library.js";
import {
  TorrentDownloadService,
  type TorrentDownloadRecord,
} from "./services/torrent-download-service.js";
import { VlcRemoteController } from "./services/vlc-remote-controller.js";

type PlayRequestBody = {
  file?: string;
};

type CreateTorrentRequestBody = {
  magnetLink?: string;
};

type TorrentParams = {
  id: string;
};

type AdbStatusResponse = {
  host: string;
  port: number;
  serial: string;
  connected: boolean;
  lastError: string | null;
};

const app = express();
const mediaLibrary = new MediaLibrary(config.mediaDir);
const browserMediaTranscoder = new BrowserMediaTranscoder(config.browserMediaDir);
const torrentDownloadService = new TorrentDownloadService(
  mediaLibrary,
  config.incompleteDownloadsDir,
  browserMediaTranscoder,
);
const androidDeviceClient = new AndroidDeviceClient({
  host: config.nebulaIp,
  port: config.adbPort,
});
const vlcRemoteController = new VlcRemoteController(androidDeviceClient, {
  packageName: config.vlcPackage,
  activityName: config.vlcActivity,
});

app.use(express.json());
app.use("/media", express.static(config.mediaDir));
app.use(express.static(config.clientDistDir));

app.get("/adb/status", async (_req, res, next) => {
  try {
    const status = await androidDeviceClient.getStatus();
    res.json(status);
  } catch (error) {
    next(error);
  }
});

app.post(
  "/adb/connect",
  async (
    _req: express.Request<Record<string, never>, AdbStatusResponse>,
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

app.get("/files", async (_req, res, next) => {
  try {
    const files = await mediaLibrary.listPlayableFiles();
    res.json(files);
  } catch (error) {
    next(error);
  }
});

app.post(
  "/play",
  async (
    req: express.Request<Record<string, never>, unknown, PlayRequestBody>,
    res,
    next,
  ) => {
    try {
      const file = req.body.file;

      if (!file) {
        res.status(400).json({ error: "A file name is required" });
        return;
      }

      const existingFile = await mediaLibrary.resolveExistingFile(file);

      if (!existingFile) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      const fileUrl = new URL(
        `/media/${mediaLibrary.toPublicMediaPath(file)}`,
        `http://${config.serverHost}:${config.serverPort}`,
      );

      console.log(`Launching VLC with ${fileUrl.toString()}`);
      await vlcRemoteController.playMediaUrl(fileUrl.toString());

      res.json({ status: "playing", file });
    } catch (error) {
      next(error);
    }
  },
);

app.get("/torrents", (_req, res) => {
  const downloads = torrentDownloadService.listDownloads();
  res.json(downloads);
});

app.post(
  "/torrents",
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
  "/torrents/:id",
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

app.listen(config.serverPort, () => {
  console.log(
    `Server running at http://${config.serverHost}:${config.serverPort}`,
  );
});
