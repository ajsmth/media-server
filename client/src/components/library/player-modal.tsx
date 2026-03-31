import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { LoaderCircle } from "lucide-react";

import { client } from "@/fetch-client";
import { BrowserPlayer } from "@/components/library/browser-player";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLibrary } from "@/hooks/use-library";
import { useProjector } from "@/hooks/use-projector";

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
  const { adbStatus } = useProjector();
  const [activeSessionKey, setActiveSessionKey] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isLaunchingNebula, setIsLaunchingNebula] = useState(false);
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);
  const [playbackSelection, setPlaybackSelection] = useState<"start" | "resume">("start");
  const [sessionInitialPositionSeconds, setSessionInitialPositionSeconds] = useState(0);

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
  const sessionKey = modalFileId ? `${modalFileId}:${shouldResume ? "resume" : "start"}` : null;

  useEffect(() => {
    if (!sessionKey) {
      setActiveSessionKey(null);
      setIsOverlayVisible(true);
      setPlaybackSelection("start");
      setSessionInitialPositionSeconds(0);
      return;
    }

    if (activeSessionKey === sessionKey || !modalFile) {
      return;
    }

    setActiveSessionKey(sessionKey);
    setIsOverlayVisible(true);
    setPlaybackSelection(shouldResume ? "resume" : "start");
    setSessionInitialPositionSeconds(
      shouldResume && modalFile.playback && !modalFile.playback.completed
        ? modalFile.playback.positionSeconds
        : 0,
    );
  }, [activeSessionKey, modalFile, sessionKey, shouldResume]);

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

  const resumePositionSeconds =
    modalFile && modalFile.playback && !modalFile.playback.completed
      ? modalFile.playback.positionSeconds
      : 0;
  const canResume = resumePositionSeconds > 0;

  async function handleLaunchNebula() {
    if (!modalFile) {
      return;
    }

    try {
      setPlayerError(null);
      setIsLaunchingNebula(true);
      await client.playFile(modalFile.id);
      closePlayer();
    } catch (error) {
      setPlayerError(error instanceof Error ? error.message : "Failed to launch on Nebula.");
    } finally {
      setIsLaunchingNebula(false);
    }
  }

  function handleSelectPlayback(mode: "start" | "resume") {
    setPlaybackSelection(mode);
    setSessionInitialPositionSeconds(mode === "resume" ? resumePositionSeconds : 0);
    setIsOverlayVisible(false);
  }

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
                ? playbackSelection === "resume" && sessionInitialPositionSeconds > 0
                  ? `Resuming at ${formatPlaybackTime(sessionInitialPositionSeconds, modalFile.playback?.durationSeconds ?? null)}`
                  : "Browser playback"
                : "Browser playback"}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-4 sm:p-5">
          {modalFile ? (
            <BrowserPlayer
              autoPlay={!isOverlayVisible}
              error={playerError}
              file={modalFile}
              initialPositionSeconds={sessionInitialPositionSeconds}
              modeLabel={playbackSelection === "resume" ? "Resume playback" : "Browser player"}
              onVideoError={() =>
                setPlayerError(
                  "The browser-safe copy could not be played. It may still be transcoding.",
                )
              }
              overlay={modalFile.browserUrl && isOverlayVisible ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-[1.5rem] bg-black/55 p-4">
                  <div className="flex flex-wrap items-center justify-center gap-2 rounded-[1rem] border border-white/10 bg-black/70 p-3 backdrop-blur">
                    <Button
                      onClick={() => handleSelectPlayback("start")}
                      type="button"
                      variant="secondary"
                    >
                      Play
                    </Button>
                    {canResume ? (
                      <Button
                        onClick={() => handleSelectPlayback("resume")}
                        type="button"
                        variant="default"
                      >
                        Resume
                      </Button>
                    ) : null}
                    {adbStatus?.connected ? (
                      <Button
                        disabled={isLaunchingNebula}
                        onClick={() => void handleLaunchNebula()}
                        type="button"
                        variant="outline"
                      >
                        {isLaunchingNebula ? (
                          <>
                            <LoaderCircle className="animate-spin" />
                            Launching
                          </>
                        ) : (
                          "Nebula play"
                        )}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
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
