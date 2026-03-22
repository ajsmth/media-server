import express from "express";
import type {
  EncodeLibraryFileResponse,
  ErrorResponse,
  LibraryCatalogSnapshot,
} from "@media-server/shared";

import type { AppContext } from "../app-context";

type LibraryFileParams = {
  fileId: string;
};

export function createLibraryRouter(context: AppContext) {
  const router = express.Router();

  router.get("/", (_req, res) => {
    res.json(context.libraryCatalog.getSnapshot());
  });

  router.get("/status", (_req, res) => {
    res.json(context.libraryCatalog.getStatus());
  });

  router.post(
    "/rescan",
    async (
      _req: express.Request<Record<string, never>, LibraryCatalogSnapshot | ErrorResponse>,
      res,
      next,
    ) => {
      try {
        const snapshot = await context.libraryCatalog.rescan();
        res.json(snapshot);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/files/:fileId/source", async (req, res, next) => {
    try {
      const existingFile = await context.libraryCatalog.resolveSourceFilePath(
        req.params.fileId,
      );

      if (!existingFile) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      res.sendFile(existingFile);
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/files/:fileId/encode",
    async (
      req: express.Request<LibraryFileParams, EncodeLibraryFileResponse | ErrorResponse>,
      res,
      next,
    ) => {
      try {
        const file = context.libraryCatalog.findFileById(req.params.fileId);

        if (!file) {
          res.status(404).json({ error: "File not found" });
          return;
        }

        if (file.browserCopyReady) {
          res.json({ status: "ready", fileId: file.id });
          return;
        }

        const sourcePath = await context.libraryCatalog.resolveSourceFilePath(
          req.params.fileId,
        );

        if (!sourcePath) {
          res.status(404).json({ error: "Source file not found" });
          return;
        }

        context.transcoderQueueService.enqueue(file.relativePath, sourcePath);
        void context.libraryCatalog.rescan().catch((error) => {
          console.error(
            "Failed to refresh library after queueing browser encode:",
            error,
          );
        });

        res.status(202).json({ status: "queued", fileId: file.id });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/files/:fileId/browser",
    async (req: express.Request<LibraryFileParams>, res, next) => {
      try {
        const existingFile = await context.libraryCatalog.resolveBrowserFilePath(
          req.params.fileId,
        );

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

  return router;
}
