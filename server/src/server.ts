import express from "express";
import path from "node:path";

import { config } from "./config.js";
import { AdbVlcController } from "./services/adb-vlc-controller.js";
import { MediaLibrary } from "./services/media-library.js";

type PlayRequestBody = {
  file?: string;
};

const app = express();
const mediaLibrary = new MediaLibrary(config.mediaDir);
const adbVlcController = new AdbVlcController({
  nebulaIp: config.nebulaIp,
  adbPort: config.adbPort,
  vlcPackage: config.vlcPackage,
  vlcActivity: config.vlcActivity,
});

app.use(express.json());
app.use("/media", express.static(config.mediaDir));
app.use(express.static(config.clientDistDir));

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
        `/media/${encodeURIComponent(path.basename(existingFile))}`,
        `http://${config.serverHost}:${config.serverPort}`,
      );

      console.log(`Launching VLC with ${fileUrl.toString()}`);
      await adbVlcController.playMediaUrl(fileUrl.toString());

      res.json({ status: "playing", file });
    } catch (error) {
      next(error);
    }
  },
);

app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(config.clientDistDir, "index.html"));
});

app.use((error: unknown, _req: express.Request, res: express.Response) => {
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
