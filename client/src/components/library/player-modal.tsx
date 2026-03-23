import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { client } from "@/fetch-client";
import { BrowserPlayer } from "@/components/library/browser-player";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLibrary } from "@/hooks/use-library";

function formatPlayerTitle(input: {
  parsed: {
    type: "movie" | "episode" | "other";
    title: string;
    year: number | null;
    seasonNumber: number | null;
    episodeNumbers: number[];
  };
}) {
  if (input.parsed.type === "movie") {
    return input.parsed.year
      ? `${input.parsed.title} (${input.parsed.year})`
      : input.parsed.title;
  }

  if (input.parsed.type === "episode") {
    const seasonNumber = input.parsed.seasonNumber ?? 0;
    const episodeLabel = input.parsed.episodeNumbers
      .map((episodeNumber) => String(episodeNumber).padStart(2, "0"))
      .join("E");

    return `${input.parsed.title} S${String(seasonNumber).padStart(2, "0")}E${episodeLabel}`;
  }

  return input.parsed.title;
}

function formatPlaybackTime(positionSeconds: number, durationSeconds: number | null) {
  const totalSeconds = Math.floor(positionSeconds);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const currentLabel = hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;

  if (durationSeconds === null) {
    return currentLabel;
  }

  const totalDurationSeconds = Math.floor(durationSeconds);
  const durationMinutes = Math.floor((totalDurationSeconds % 3600) / 60);
  const durationRemainderSeconds = totalDurationSeconds % 60;
  const durationHours = Math.floor(totalDurationSeconds / 3600);
  const durationLabel = durationHours > 0
    ? `${durationHours}:${String(durationMinutes).padStart(2, "0")}:${String(durationRemainderSeconds).padStart(2, "0")}`
    : `${durationMinutes}:${String(durationRemainderSeconds).padStart(2, "0")}`;

  return `${currentLabel} / ${durationLabel}`;
}

export function PlayerModal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { library } = useLibrary();
  const [playerError, setPlayerError] = useState<string | null>(null);

  const allFiles = useMemo(
    () => [
      ...library.movies.flatMap((movie) => movie.files),
      ...library.shows.flatMap((show) =>
        show.seasons.flatMap((season) =>
          season.episodes.flatMap((episode) => episode.files),
        ),
      ),
      ...library.otherVideos.flatMap((group) => group.files),
    ],
    [library],
  );

  const modalFileId = searchParams.get("play");
  const shouldResume = searchParams.get("resume") === "1";
  const modalFile = allFiles.find((file) => file.id === modalFileId) ?? null;
  const initialPositionSeconds = shouldResume && modalFile?.playback && !modalFile.playback.completed
    ? modalFile.playback.positionSeconds
    : 0;

  useEffect(() => {
    if (!modalFile) {
      setPlayerError(null);
      return;
    }

    if (!modalFile.browserUrl) {
      setPlayerError("Browser-ready copy is not available yet.");
      return;
    }

    let cancelled = false;

    void client.ensureBrowserReady(modalFile.browserUrl)
      .then(() => {
        if (!cancelled) {
          setPlayerError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setPlayerError(
            error instanceof Error
              ? error.message
              : "Browser-ready copy is not available yet.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [modalFile]);

  function closePlayer() {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("play");
      next.delete("resume");
      return next;
    });
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          closePlayer();
        }
      }}
      open={modalFileId !== null}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-[960px]">
        <div className="border-b border-border/70 px-5 py-4">
          <DialogHeader>
            <DialogTitle>{modalFile ? formatPlayerTitle(modalFile) : "Player"}</DialogTitle>
            <DialogDescription>
              {modalFile
                ? shouldResume && initialPositionSeconds > 0
                  ? `Resuming at ${formatPlaybackTime(initialPositionSeconds, modalFile.playback?.durationSeconds ?? null)}`
                  : "Browser playback"
                : "Browser playback"}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-4 sm:p-5">
          {modalFile ? (
            <BrowserPlayer
              error={playerError}
              file={modalFile}
              initialPositionSeconds={initialPositionSeconds}
              modeLabel={shouldResume ? "Resume playback" : "Browser player"}
              onVideoError={() =>
                setPlayerError(
                  "The browser-safe copy could not be played. It may still be transcoding.",
                )
              }
              src={modalFile.browserUrl ?? undefined}
            />
          ) : (
            <p className="rounded-[1rem] border border-dashed border-border/80 px-4 py-6 text-sm text-muted-foreground">
              The selected file is no longer available in the library.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
