import express from "express";
import type {
  ErrorResponse,
  LaunchVlcResponse,
  PlayRequestBody,
  PlayResponse,
} from "@media-server/shared";

import { config } from "../config";
import type { AppContext } from "../app-context";

export function createPlaybackRouter(context: AppContext) {
  const router = express.Router();

  router.post(
    "/play",
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

        const file = context.libraryCatalog.findFileById(fileId);

        if (!file) {
          res.status(404).json({ error: "File not found" });
          return;
        }

        const fileUrl = new URL(
          file.sourceUrl,
          `http://${config.playbackHost}:${config.serverPort}`,
        );

        console.log(`Sending VLC media intent for ${fileUrl.toString()}`);
        const launch = await context.vlcRemoteController.playMediaUrl(
          fileUrl.toString(),
        );
        console.log("[vlc] media launch output:", launch.launch.stdout || "<no output>");

        res.json({ status: "playing", fileId, launch });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/vlc/launch",
    async (_req: express.Request<Record<string, never>, LaunchVlcResponse>, res, next) => {
      try {
        console.log("Launching VLC app");
        const launch = await context.vlcRemoteController.launchApp();
        console.log("[vlc] app launch output:", launch.launch.stdout || "<no output>");

        res.json({ status: "launched", launch: launch.launch });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
