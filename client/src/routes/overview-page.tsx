import { Film, HardDriveDownload, MonitorPlay, RefreshCw } from "lucide-react";
import { Link } from "react-router";

import { useLibrary } from "@/hooks/use-library";
import { useProjector } from "@/hooks/use-projector";
import { useTorrents } from "@/hooks/use-torrents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function OverviewPage() {
  const { library, libraryStatus, rescanLibraryMutation } = useLibrary();
  const { adbStatus } = useProjector();
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
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-[linear-gradient(160deg,rgba(15,95,117,0.97),rgba(30,50,64,0.94))] text-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge
                className="border-white/20 bg-white/10 text-white"
                variant="outline"
              >
                Library
              </Badge>
              <Film className="size-5 text-white/75" />
            </div>
            <CardTitle className="text-white">Cataloged titles</CardTitle>
            <CardDescription className="text-white/72">
              Movies, shows, and unsorted imports tracked from the media folder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{totalTitles}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Downloads</Badge>
              <HardDriveDownload className="size-5 text-primary" />
            </div>
            <CardTitle>Active intake</CardTitle>
            <CardDescription>
              Torrents currently starting, downloading, or converting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold text-foreground">
              {activeDownloads}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant={adbStatus?.connected ? "success" : "outline"}>
                Projector
              </Badge>
              <MonitorPlay className="size-5 text-primary" />
            </div>
            <CardTitle>Nebula bridge</CardTitle>
            <CardDescription>
              Current ADB state for the projector control path.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">
              {adbStatus?.connected ? "Connected" : "Disconnected"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {adbStatus ? `${adbStatus.host}:${adbStatus.port}` : "Loading target..."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="outline">Scan state</Badge>
              <RefreshCw className="size-5 text-primary" />
            </div>
            <CardTitle>Library watcher</CardTitle>
            <CardDescription>
              Manual rescan is still available even while live watching is
              enabled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xl font-semibold capitalize text-foreground">
              {libraryStatus?.state ?? "idle"}
            </p>
            <Button
              disabled={rescanLibraryMutation.status === "pending"}
              onClick={() => void rescanLibraryMutation.mutateAsync()}
              variant="outline"
            >
              {rescanLibraryMutation.status === "pending"
                ? "Rescanning..."
                : "Rescan now"}
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Next actions</CardTitle>
            <CardDescription>
              The app is now split by workflow, so library playback and torrent
              intake can evolve independently.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Link to="/library">
              <div className="rounded-[1.5rem] border border-border bg-secondary/55 p-5 transition-colors hover:bg-secondary/80">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
                  Route
                </p>
                <p className="mt-3 text-xl font-semibold tracking-tight">
                  Library
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Browse movies and shows, open browser playback, or push a file
                  to the projector.
                </p>
              </div>
            </Link>
            <Link to="/downloads">
              <div className="rounded-[1.5rem] border border-border bg-secondary/55 p-5 transition-colors hover:bg-secondary/80">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
                  Route
                </p>
                <p className="mt-3 text-xl font-semibold tracking-tight">
                  Downloads
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Submit magnet links and monitor download plus browser-copy
                  processing.
                </p>
              </div>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              Quick summary pulled from the current query cache.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {downloads.slice(0, 4).map((download) => (
              <div
                className="rounded-2xl border border-border bg-white/65 px-4 py-3"
                key={download.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-foreground">
                    {download.name ?? "Fetching metadata..."}
                  </p>
                  <Badge variant="secondary">{download.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Updated {new Date(download.updatedAt).toLocaleTimeString()}
                </p>
              </div>
            ))}
            {downloads.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No torrent activity yet. Add a magnet link from the downloads
                route when you are ready.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
