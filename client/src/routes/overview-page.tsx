import { Film, HardDriveDownload, RefreshCw } from "lucide-react";
import { Link, useSearchParams } from "react-router";

import { usePlaybackHistory } from "@/hooks/use-playback-history";
import { useLibrary } from "@/hooks/use-library";
import { useTorrents } from "@/hooks/use-torrents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function formatPlaybackPercent(progress: number) {
  return `${Math.round(progress * 100)}%`;
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

export function OverviewPage() {
  const [, setSearchParams] = useSearchParams();
  const { library, libraryStatus, rescanLibraryMutation } = useLibrary();
  const { downloads } = useTorrents();
  const { playbackHistory } = usePlaybackHistory();

  const totalTitles =
    library.movies.length + library.shows.length + library.otherVideos.length;
  const activeDownloads = downloads.filter(
    (download) =>
      download.status === "starting" ||
      download.status === "downloading" ||
      download.status === "processing",
  ).length;

  function openPlayer(fileId: string, resume: boolean) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("play", fileId);

      if (resume) {
        next.set("resume", "1");
      } else {
        next.delete("resume");
      }

      return next;
    });
  }

  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <div className="grid gap-3 rounded-[1.5rem] border border-border/70 bg-white/60 p-4 backdrop-blur md:grid-cols-[repeat(3,minmax(0,1fr))_auto] md:items-center">
          <div className="rounded-[1.15rem] border border-border/70 bg-white/75 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Film className="size-4 text-primary" />
              Library
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{totalTitles}</p>
          </div>
          <div className="rounded-[1.15rem] border border-border/70 bg-white/75 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HardDriveDownload className="size-4 text-primary" />
              Active downloads
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{activeDownloads}</p>
          </div>
          <div className="rounded-[1.15rem] border border-border/70 bg-white/75 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="size-4 text-primary" />
              Library scan
            </div>
            <p className="mt-2 text-2xl font-semibold capitalize text-foreground">
              {libraryStatus?.state ?? "idle"}
            </p>
          </div>
          <Button
            className="w-full md:w-auto"
            disabled={rescanLibraryMutation.status === "pending"}
            onClick={() => void rescanLibraryMutation.mutateAsync()}
            variant="outline"
          >
            {rescanLibraryMutation.status === "pending" ? "Rescanning..." : "Rescan"}
          </Button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-[1.5rem] border border-border/70 bg-white/60 p-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
                Routes
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                Main actions
              </h3>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            <Link
              className="flex items-center justify-between rounded-[1.1rem] border border-border/70 bg-white/75 px-4 py-4 transition-colors hover:bg-white"
              to="/library"
            >
              <div>
                <p className="font-semibold text-foreground">Open library</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Browse folders and launch playback.
                </p>
              </div>
              <Badge variant="secondary">{totalTitles}</Badge>
            </Link>
            <Link
              className="flex items-center justify-between rounded-[1.1rem] border border-border/70 bg-white/75 px-4 py-4 transition-colors hover:bg-white"
              to="/downloads"
            >
              <div>
                <p className="font-semibold text-foreground">Open downloads</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start torrents and watch the queue.
                </p>
              </div>
              <Badge variant="secondary">{downloads.length}</Badge>
            </Link>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-border/70 bg-white/60 p-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
                Queue
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                Recent activity
              </h3>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {downloads.slice(0, 5).map((download) => (
              <div
                className="flex items-center justify-between gap-3 rounded-[1.1rem] border border-border/70 bg-white/75 px-4 py-3"
                key={download.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {download.name ?? "Fetching torrent metadata..."}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Updated {new Date(download.updatedAt).toLocaleTimeString()}
                  </p>
                </div>
                <Badge variant="secondary">{download.status}</Badge>
              </div>
            ))}
            {downloads.length === 0 ? (
              <p className="rounded-[1.1rem] border border-dashed border-border/80 px-4 py-6 text-sm text-muted-foreground">
                No torrent activity yet.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[1.5rem] border border-border/70 bg-white/60 p-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
                Watching
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                Continue watching
              </h3>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {playbackHistory.continueWatching.map((item) => (
              <button
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[1.1rem] border border-border/70 bg-white/75 px-4 py-3 text-left transition-colors hover:bg-white"
                key={item.fileId}
                onClick={() => openPlayer(item.fileId, true)}
                type="button"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{item.title}</p>
                  {item.subtitle ? (
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {item.subtitle}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatPlaybackTime(item.positionSeconds, item.durationSeconds)}
                  </p>
                </div>
                <Badge className="shrink-0" variant="secondary">
                  {formatPlaybackPercent(item.progress)}
                </Badge>
              </button>
            ))}
            {playbackHistory.continueWatching.length === 0 ? (
              <p className="rounded-[1.1rem] border border-dashed border-border/80 px-4 py-6 text-sm text-muted-foreground">
                No in-progress titles yet.
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-border/70 bg-white/60 p-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
                History
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                Recently finished
              </h3>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {playbackHistory.recentlyFinished.map((item) => (
              <button
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[1.1rem] border border-border/70 bg-white/75 px-4 py-3 text-left transition-colors hover:bg-white"
                key={item.fileId}
                onClick={() => openPlayer(item.fileId, false)}
                type="button"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{item.title}</p>
                  {item.subtitle ? (
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {item.subtitle}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Finished {new Date(item.completedAt ?? item.updatedAt).toLocaleString()}
                  </p>
                </div>
                <Badge className="shrink-0" variant="secondary">Done</Badge>
              </button>
            ))}
            {playbackHistory.recentlyFinished.length === 0 ? (
              <p className="rounded-[1.1rem] border border-dashed border-border/80 px-4 py-6 text-sm text-muted-foreground">
                No completed titles yet.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
