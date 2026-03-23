import { useEffect, useRef } from "react";
import type { LibraryFileRecord } from "@media-server/shared";

import { client } from "@/fetch-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type BrowserPlayerProps = {
  file: LibraryFileRecord;
  error: string | null;
  initialPositionSeconds?: number | null;
  modeLabel?: string;
  onVideoError: () => void;
  src?: string;
};

export function BrowserPlayer({
  file,
  error,
  initialPositionSeconds = null,
  modeLabel = "Browser player",
  onVideoError,
  src,
}: BrowserPlayerProps) {
  const lastSyncedPositionRef = useRef<number>(-1);
  const didApplyInitialPositionRef = useRef(false);

  useEffect(() => {
    lastSyncedPositionRef.current = -1;
    didApplyInitialPositionRef.current = false;
  }, [file.id, initialPositionSeconds]);

  async function syncProgress(video: HTMLVideoElement) {
    const durationSeconds = Number.isFinite(video.duration) ? video.duration : null;
    const positionSeconds = video.currentTime;

    try {
      await client.savePlaybackProgress(file.id, {
        positionSeconds,
        durationSeconds,
        source: "browser",
      });
      lastSyncedPositionRef.current = positionSeconds;
    } catch (syncError) {
      console.error("Failed to save browser playback progress:", syncError);
    }
  }

  return (
    <Card className="overflow-hidden bg-slate-950 text-white">
      <CardHeader className="border-b border-white/10">
        <CardTitle className="text-white">{modeLabel}</CardTitle>
        <CardDescription className="text-white/65">
          {file.relativePath}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {error ? (
          <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        ) : null}
        <video
          className="aspect-video w-full rounded-[1.5rem] bg-black"
          controls
          key={`${file.id}:${initialPositionSeconds ?? 0}`}
          onEnded={(event) => {
            void syncProgress(event.currentTarget);
          }}
          onError={onVideoError}
          onLoadedMetadata={(event) => {
            if (
              didApplyInitialPositionRef.current ||
              initialPositionSeconds === null ||
              initialPositionSeconds <= 0
            ) {
              return;
            }

            const video = event.currentTarget;
            video.currentTime = Math.min(
              initialPositionSeconds,
              Number.isFinite(video.duration) ? video.duration : initialPositionSeconds,
            );
            didApplyInitialPositionRef.current = true;
          }}
          onPause={(event) => {
            void syncProgress(event.currentTarget);
          }}
          preload="metadata"
          src={src ?? file.browserUrl ?? undefined}
          onTimeUpdate={(event) => {
            const video = event.currentTarget;

            if (
              lastSyncedPositionRef.current >= 0 &&
              video.currentTime - lastSyncedPositionRef.current < 10
            ) {
              return;
            }

            void syncProgress(video);
          }}
        />
      </CardContent>
    </Card>
  );
}
