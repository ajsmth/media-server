import express from "express";
import type {
  CreateTorrentRequestBody,
  TorrentDownloadRecord,
} from "@media-server/shared";

import type { AppContext } from "../app-context";

type TorrentParams = {
  id: string;
};

export function createTorrentsRouter(context: AppContext) {
  const router = express.Router();

  router.get("/", (_req, res) => {
    const downloads = context.torrentDownloadService.listDownloads();
    res.json(downloads);
  });

  router.post(
    "/",
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

        const download = await context.torrentDownloadService.startDownload(magnetLink);
        res.status(201).json(download);
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    "/:id",
    async (req: express.Request<TorrentParams>, res, next) => {
      try {
        const download = await context.torrentDownloadService.cancelDownload(req.params.id);
        res.json(download);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
