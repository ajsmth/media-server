import { Film, HardDriveDownload, RefreshCw } from "lucide-react";
import { Link } from "react-router";

import { useLibrary } from "@/hooks/use-library";
import { useTorrents } from "@/hooks/use-torrents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function OverviewPage() {
  const { library, libraryStatus, rescanLibraryMutation } = useLibrary();
  const { downloads } = useTorrents();

  const totalTitles =
    library.movies.length + library.shows.length + library.otherVideos.length;
  const activeDownloads = downloads.filter(
    (download) =>
      download.status === "starting" ||
      download.status === "downloading" ||
      download.status === "processing",
  ).length;

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
    </div>
  );
}
