import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type {
  LibraryEpisodeRecord,
  LibraryFileRecord,
  LibraryMovieRecord,
  LibraryOtherVideoRecord,
  LibraryShowRecord,
} from "@media-server/shared";
import { Clapperboard, LoaderCircle, RefreshCw, Tv2, Video } from "lucide-react";

import { client } from "@/fetch-client";
import { BrowserPlayer } from "@/components/library/browser-player";
import { FileActions } from "@/components/library/file-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLibrary } from "@/hooks/use-library";

function formatEpisodeLabel(episode: LibraryEpisodeRecord) {
  const suffix = episode.episodeNumbers.map((number) => `E${number}`).join("");
  return `S${String(episode.seasonNumber).padStart(2, "0")}${suffix}`;
}

function FileMeta({ file }: { file: LibraryFileRecord }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="outline">{file.basename}</Badge>
      {file.browserCopyReady ? (
        <Badge variant="success">Browser ready</Badge>
      ) : (
        <Badge variant="secondary">Transcoding if needed</Badge>
      )}
      <span>{new Date(file.modifiedAt).toLocaleDateString()}</span>
    </div>
  );
}

export function LibraryPage() {
  const {
    library,
    libraryQuery,
    libraryStatus,
    rescanLibraryMutation,
  } = useLibrary();
  const [selectedNebulaFileId, setSelectedNebulaFileId] = useState<string | null>(
    null,
  );
  const [selectedBrowserFile, setSelectedBrowserFile] =
    useState<LibraryFileRecord | null>(null);
  const [browserPlaybackError, setBrowserPlaybackError] = useState<
    string | null
  >(null);
  const [nebulaFeedback, setNebulaFeedback] = useState<string | null>(null);
  const [nebulaError, setNebulaError] = useState<string | null>(null);

  const playFileMutation = useMutation({
    mutationFn: (fileId: string) => client.playFile(fileId),
  });

  const totalTitles =
    library.movies.length + library.shows.length + library.otherVideos.length;
  const libraryError = libraryQuery.isError
    ? libraryQuery.error instanceof Error
      ? libraryQuery.error.message
      : "Unable to load the media library from the backend."
    : rescanLibraryMutation.isError
      ? rescanLibraryMutation.error instanceof Error
        ? rescanLibraryMutation.error.message
        : "Failed to rescan library"
      : null;

  async function handlePlayFile(file: LibraryFileRecord) {
    setSelectedNebulaFileId(file.id);
    setNebulaError(null);
    setNebulaFeedback(`Sending ${file.relativePath} to VLC...`);

    try {
      const payload = await playFileMutation.mutateAsync(file.id);
      const mediaLaunchOutput =
        payload.launch.launch.stdout || "No output from media launch.";
      setNebulaFeedback(
        `Sent ${file.relativePath} to VLC at ${payload.launch.mediaUrl}. ${mediaLaunchOutput}`,
      );
    } catch (error) {
      setNebulaError(
        error instanceof Error ? error.message : "Failed to launch VLC",
      );
      setNebulaFeedback(null);
    }
  }

  async function handlePlayInBrowser(file: LibraryFileRecord) {
    if (!file.browserUrl) {
      setBrowserPlaybackError("Browser-ready copy is not available yet.");
      return;
    }

    try {
      await client.ensureBrowserReady(file.browserUrl);
      setBrowserPlaybackError(null);
      setSelectedBrowserFile(file);
    } catch (error) {
      setBrowserPlaybackError(
        error instanceof Error
          ? error.message
          : "Browser-ready copy is not available yet.",
      );
    }
  }

  function renderMovie(movie: LibraryMovieRecord) {
    return (
      <Card key={movie.id}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{movie.title}</CardTitle>
              <CardDescription className="mt-2">
                {movie.year ? `${movie.year}` : "Movie"}
              </CardDescription>
            </div>
            <Badge variant="secondary">{movie.files.length} file(s)</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {movie.files.map((file) => (
            <div
              className="rounded-[1.5rem] border border-border bg-white/65 p-4"
              key={file.id}
            >
              <p className="font-medium text-foreground">{file.relativePath}</p>
              <FileMeta file={file} />
              <FileActions
                browserActive={selectedBrowserFile?.id === file.id}
                file={file}
                nebulaActive={selectedNebulaFileId === file.id}
                onBrowser={handlePlayInBrowser}
                onNebula={handlePlayFile}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  function renderShow(show: LibraryShowRecord) {
    return (
      <Card key={show.id}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{show.title}</CardTitle>
              <CardDescription className="mt-2">
                {show.seasons.length} season(s)
              </CardDescription>
            </div>
            <Badge variant="secondary">{show.seasons.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {show.seasons.map((season) => (
            <div
              className="rounded-[1.5rem] border border-border bg-secondary/50 p-4"
              key={season.id}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary/70">
                  Season {season.seasonNumber}
                </p>
                <Badge variant="outline">{season.episodes.length} episodes</Badge>
              </div>
              <div className="mt-4 grid gap-3">
                {season.episodes.map((episode) => (
                  <div
                    className="rounded-[1.25rem] border border-border bg-white/70 p-4"
                    key={episode.id}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="default">{formatEpisodeLabel(episode)}</Badge>
                      <p className="font-medium text-foreground">
                        {episode.title || "Episode"}
                      </p>
                    </div>
                    <div className="mt-3 grid gap-3">
                      {episode.files.map((file) => (
                        <div key={file.id}>
                          <p className="text-sm text-muted-foreground">
                            {file.relativePath}
                          </p>
                          <FileMeta file={file} />
                          <FileActions
                            browserActive={selectedBrowserFile?.id === file.id}
                            file={file}
                            nebulaActive={selectedNebulaFileId === file.id}
                            onBrowser={handlePlayInBrowser}
                            onNebula={handlePlayFile}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  function renderOtherVideo(otherVideo: LibraryOtherVideoRecord) {
    return (
      <Card key={otherVideo.id}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{otherVideo.title}</CardTitle>
              <CardDescription className="mt-2">
                Unsorted import
              </CardDescription>
            </div>
            <Badge variant="outline">{otherVideo.files.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {otherVideo.files.map((file) => (
            <div
              className="rounded-[1.5rem] border border-border bg-white/65 p-4"
              key={file.id}
            >
              <p className="font-medium text-foreground">{file.relativePath}</p>
              <FileMeta file={file} />
              <FileActions
                browserActive={selectedBrowserFile?.id === file.id}
                file={file}
                nebulaActive={selectedNebulaFileId === file.id}
                onBrowser={handlePlayInBrowser}
                onNebula={handlePlayFile}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(249,243,234,0.92))]">
          <CardHeader className="gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Badge variant="default">Managed index</Badge>
                <span className="text-sm text-muted-foreground">
                  {totalTitles} titles
                </span>
              </div>
              <CardTitle className="mt-4">Media library</CardTitle>
              <CardDescription className="mt-2">
                The app now treats library browsing as its own route, with
                movies, shows, and unsorted imports grouped separately.
              </CardDescription>
            </div>
            <Button
              disabled={rescanLibraryMutation.status === "pending"}
              onClick={() => void rescanLibraryMutation.mutateAsync()}
              variant="outline"
            >
              {rescanLibraryMutation.status === "pending" ? (
                <>
                  <LoaderCircle className="animate-spin" />
                  Rescanning
                </>
              ) : (
                <>
                  <RefreshCw />
                  Rescan library
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.5rem] bg-secondary/60 p-4">
              <div className="flex items-center gap-3">
                <Clapperboard className="size-4 text-primary" />
                <p className="text-sm font-medium">Movies</p>
              </div>
              <p className="mt-3 text-3xl font-semibold">{library.movies.length}</p>
            </div>
            <div className="rounded-[1.5rem] bg-secondary/60 p-4">
              <div className="flex items-center gap-3">
                <Tv2 className="size-4 text-primary" />
                <p className="text-sm font-medium">Shows</p>
              </div>
              <p className="mt-3 text-3xl font-semibold">{library.shows.length}</p>
            </div>
            <div className="rounded-[1.5rem] bg-secondary/60 p-4">
              <div className="flex items-center gap-3">
                <Video className="size-4 text-primary" />
                <p className="text-sm font-medium">Unsorted</p>
              </div>
              <p className="mt-3 text-3xl font-semibold">
                {library.otherVideos.length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[linear-gradient(145deg,rgba(15,95,117,0.96),rgba(18,30,40,0.96))] text-white">
          <CardHeader>
            <Badge
              className="w-fit border-white/15 bg-white/10 text-white"
              variant="outline"
            >
              Playback path
            </Badge>
            <CardTitle className="text-white">VLC + browser outputs</CardTitle>
            <CardDescription className="text-white/72">
              Send cataloged files straight to the projector or open the
              browser-safe version here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-white/82">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              Browser playback probes the generated browser copy before opening.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              Nebula playback sends the selected file id to the backend, which
              resolves the media URL and launches VLC over ADB.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              Library scan state: {libraryStatus?.state ?? "idle"}
            </div>
          </CardContent>
        </Card>
      </section>

      {libraryStatus?.state === "scanning" ? (
        <p className="rounded-2xl border border-primary/15 bg-primary/10 px-4 py-3 text-sm text-primary">
          Scanning media folder...
        </p>
      ) : null}
      {libraryStatus?.lastError ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {libraryStatus.lastError}
        </p>
      ) : null}
      {libraryError ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {libraryError}
        </p>
      ) : null}
      {nebulaFeedback ? (
        <p className="rounded-2xl border border-primary/10 bg-primary/10 px-4 py-3 text-sm text-primary">
          {nebulaFeedback}
        </p>
      ) : null}
      {nebulaError ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {nebulaError}
        </p>
      ) : null}

      {selectedBrowserFile ? (
        <BrowserPlayer
          error={browserPlaybackError}
          file={selectedBrowserFile}
          onVideoError={() =>
            setBrowserPlaybackError(
              "The browser-safe copy could not be played. It may still be transcoding.",
            )
          }
        />
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
                Collection
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                Movies
              </h3>
            </div>
            <Badge variant="secondary">{library.movies.length}</Badge>
          </div>
          {libraryQuery.status === "pending" ? (
            <Card>
              <CardHeader>
                <CardTitle>Loading movies...</CardTitle>
              </CardHeader>
            </Card>
          ) : library.movies.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No movies imported yet</CardTitle>
                <CardDescription>
                  Drop files into `/media` or import them through the torrent
                  flow.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            library.movies.map(renderMovie)
          )}
        </div>

        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
                Collection
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                Shows
              </h3>
            </div>
            <Badge variant="secondary">{library.shows.length}</Badge>
          </div>
          {library.shows.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No shows imported yet</CardTitle>
                <CardDescription>
                  Season-aware imports will appear here once the parser
                  classifies them.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            library.shows.map(renderShow)
          )}
        </div>
      </section>

      <section className="grid gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
              Review
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Unsorted imports
            </h3>
          </div>
          <Badge variant="outline">{library.otherVideos.length}</Badge>
        </div>
        {library.otherVideos.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Nothing needs review right now</CardTitle>
              <CardDescription>
                Files that do not cleanly parse into movies or shows will land
                here.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {library.otherVideos.map(renderOtherVideo)}
          </div>
        )}
      </section>
    </div>
  );
}
