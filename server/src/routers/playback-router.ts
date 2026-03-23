import express from "express";
import type {
  ErrorResponse,
  LaunchVlcResponse,
  LibraryFileRecord,
  PlaybackHistoryItem,
  PlaybackHistoryResponse,
  PlayRequestBody,
  PlayResponse,
  SavePlaybackProgressRequestBody,
  SavePlaybackProgressResponse,
} from "@media-server/shared";

import { config } from "../config";
import type { AppContext } from "../app-context";

export function createPlaybackRouter(context: AppContext) {
  const router = express.Router();

  router.get(
    "/playback/history",
    (_req: express.Request<Record<string, never>, PlaybackHistoryResponse>, res) => {
      const files = flattenLibraryFiles(context.libraryCatalog.getSnapshot());
      const playbackItems = files
        .filter((file) => file.playback !== null)
        .map((file) => toPlaybackHistoryItem(file))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

      res.json({
        continueWatching: playbackItems.filter((item) => !item.completedAt).slice(0, 8),
        recentlyFinished: playbackItems.filter((item) => item.completedAt).slice(0, 8),
      });
    },
  );

  router.post(
    "/playback/files/:fileId/progress",
    async (
      req: express.Request<
        { fileId: string },
        SavePlaybackProgressResponse | ErrorResponse,
        SavePlaybackProgressRequestBody
      >,
      res,
      next,
    ) => {
      try {
        const file = context.libraryCatalog.findFileById(req.params.fileId);

        if (!file) {
          res.status(404).json({ error: "File not found" });
          return;
        }

        if (typeof req.body.positionSeconds !== "number") {
          res.status(400).json({ error: "positionSeconds is required" });
          return;
        }

        const playback = await context.playbackProgressService.save({
          relativePath: file.relativePath,
          positionSeconds: req.body.positionSeconds,
          durationSeconds: req.body.durationSeconds ?? null,
          source: req.body.source ?? "browser",
        });

        res.json(playback);
      } catch (error) {
        next(error);
      }
    },
  );

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

        const startSeconds = req.body.startSeconds;

        if (typeof startSeconds === "number" && startSeconds > 0) {
          console.log(
            `[playback] resume requested for projector playback at ${startSeconds.toFixed(1)}s, but start seek is not wired into the Android VLC launch yet.`,
          );
        }

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

function flattenLibraryFiles(snapshot: ReturnType<AppContext["libraryCatalog"]["getSnapshot"]>) {
  return [
    ...snapshot.movies.flatMap((movie) => movie.files),
    ...snapshot.shows.flatMap((show) =>
      show.seasons.flatMap((season) =>
        season.episodes.flatMap((episode) => episode.files),
      ),
    ),
    ...snapshot.otherVideos.flatMap((group) => group.files),
  ];
}

function toPlaybackHistoryItem(file: LibraryFileRecord): PlaybackHistoryItem {
  const playback = file.playback!;

  return {
    fileId: file.id,
    title: formatPlaybackTitle(file),
    subtitle: formatPlaybackSubtitle(file),
    relativePath: file.relativePath,
    parsedType: file.parsed.type,
    progress: playback.progress,
    positionSeconds: playback.positionSeconds,
    durationSeconds: playback.durationSeconds,
    updatedAt: playback.updatedAt,
    completedAt: playback.completedAt,
    source: playback.source,
  };
}

function formatPlaybackTitle(file: LibraryFileRecord): string {
  if (file.parsed.type === "movie") {
    return file.parsed.year ? `${file.parsed.title} (${file.parsed.year})` : file.parsed.title;
  }

  if (file.parsed.type === "episode") {
    const seasonNumber = file.parsed.seasonNumber ?? 0;
    const episodeLabel = file.parsed.episodeNumbers
      .map((episodeNumber) => String(episodeNumber).padStart(2, "0"))
      .join("E");

    return `${file.parsed.title} S${String(seasonNumber).padStart(2, "0")}E${episodeLabel}`;
  }

  return file.parsed.title;
}

function formatPlaybackSubtitle(file: LibraryFileRecord): string | null {
  if (file.parsed.type === "episode") {
    return file.parsed.title;
  }

  return null;
}
