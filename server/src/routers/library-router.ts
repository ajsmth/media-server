import express from "express";
import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type {
  DeleteLibraryFolderRequestBody,
  DeleteLibraryItemResponse,
  EncodeLibraryFileResponse,
  ErrorResponse,
  LibraryCatalogSnapshot,
  MergeLibraryShowRequestBody,
  RegenerateLibraryTitleRequestBody,
  RegenerateLibraryTitleResponse,
  SaveLibraryTitleOverrideRequestBody,
  UploadLibraryFileResponse,
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
        await context.mediaLibrary.organizeMisplacedFiles();
        const snapshot = await context.libraryCatalog.rescan();
        res.json(snapshot);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/upload",
    async (
      req: express.Request<
        Record<string, never>,
        UploadLibraryFileResponse | ErrorResponse
      >,
      res,
      next,
    ) => {
      try {
        const fileNameHeader = req.headers["x-file-name"];
        const fileName = Array.isArray(fileNameHeader)
          ? fileNameHeader[0]
          : fileNameHeader;

        if (!fileName) {
          res.status(400).json({ error: "x-file-name header is required" });
          return;
        }

        const destination = context.mediaLibrary.resolveUploadDestination(fileName);
        await fs.mkdir(path.dirname(destination.absolutePath), { recursive: true });
        await pipeline(
          req,
          createWriteStream(destination.absolutePath, { flags: "wx" }),
        );
        await context.libraryCatalog.rescan();

        res.status(201).json({
          status: "uploaded",
          relativePath: destination.relativePath,
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
          res.status(409).json({ error: "File already exists in the library" });
          return;
        }

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

  router.delete(
    "/files/:fileId",
    async (
      req: express.Request<LibraryFileParams, DeleteLibraryItemResponse | ErrorResponse>,
      res,
      next,
    ) => {
      try {
        const file = context.libraryCatalog.findFileById(req.params.fileId);

        if (!file) {
          res.status(404).json({ error: "File not found" });
          return;
        }

        await context.mediaLibrary.deleteFile(file.relativePath);
        await context.libraryCatalog.rescan();
        res.json({ status: "deleted", target: "file" });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/show-merges",
    async (
      req: express.Request<
        Record<string, never>,
        LibraryCatalogSnapshot | ErrorResponse,
        MergeLibraryShowRequestBody
      >,
      res,
      next,
    ) => {
      try {
        const sourceTitle = req.body.sourceTitle?.trim();
        const targetTitle = req.body.targetTitle?.trim();

        if (!sourceTitle || !targetTitle) {
          res.status(400).json({ error: "sourceTitle and targetTitle are required" });
          return;
        }

        await context.showGroupingOverrideService.merge(sourceTitle, targetTitle);
        const snapshot = await context.libraryCatalog.rescan();
        res.json(snapshot);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/titles/regenerate",
    async (
      req: express.Request<
        Record<string, never>,
        RegenerateLibraryTitleResponse | ErrorResponse,
        RegenerateLibraryTitleRequestBody
      >,
      res,
      next,
    ) => {
      try {
        const kind = req.body.kind;
        const currentTitle = req.body.currentTitle?.trim() ?? "";
        const relativePaths = req.body.relativePaths ?? [];

        if (!kind || !["show", "movie", "other"].includes(kind)) {
          res.status(400).json({ error: "A valid kind is required" });
          return;
        }

        if (relativePaths.length === 0) {
          res.status(400).json({ error: "relativePaths are required" });
          return;
        }

        const firstPath = relativePaths[0].split("\\").join("/");
        const fileName = path.parse(path.basename(firstPath)).name;
        const sourceText = fileName || currentTitle;
        const suggestedTitle = await context.titleExtractionService.extractTitle(sourceText);

        res.json({ suggestedTitle });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/titles/save",
    async (
      req: express.Request<
        Record<string, never>,
        LibraryCatalogSnapshot | ErrorResponse,
        SaveLibraryTitleOverrideRequestBody
      >,
      res,
      next,
    ) => {
      try {
        const kind = req.body.kind;
        const title = req.body.title?.trim();
        const relativePaths = req.body.relativePaths ?? [];

        if (!kind || !["show", "movie", "other"].includes(kind)) {
          res.status(400).json({ error: "A valid kind is required" });
          return;
        }

        if (!title) {
          res.status(400).json({ error: "title is required" });
          return;
        }

        if (relativePaths.length === 0) {
          res.status(400).json({ error: "relativePaths are required" });
          return;
        }

        await context.mediaTitleOverrideService.save(kind, relativePaths, title);
        const snapshot = await context.libraryCatalog.rescan();
        res.json(snapshot);
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    "/folders",
    async (
      req: express.Request<
        Record<string, never>,
        DeleteLibraryItemResponse | ErrorResponse,
        DeleteLibraryFolderRequestBody
      >,
      res,
      next,
    ) => {
      try {
        const relativePath = req.body.relativePath?.trim();

        if (!relativePath) {
          res.status(400).json({ error: "relativePath is required" });
          return;
        }

        await context.mediaLibrary.deleteDirectory(relativePath);
        await context.libraryCatalog.rescan();
        res.json({ status: "deleted", target: "folder" });
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
