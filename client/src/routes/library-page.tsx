import { useEffect, useMemo, useState } from "react";
import type {
  LibraryFileRecord,
  LibraryMovieRecord,
  LibraryOtherVideoRecord,
  LibrarySeasonRecord,
  LibraryShowRecord,
} from "@media-server/shared";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";

import { client } from "@/fetch-client";
import { BrowserPlayer } from "@/components/library/browser-player";
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
import { cn } from "@/lib/utils";

type ViewerNode = {
  id: string;
  label: string;
  depth: number;
  files: LibraryFileRecord[];
  parentId: string | null;
  hasChildren?: boolean;
};

function buildViewerNodes(
  movies: LibraryMovieRecord[],
  shows: LibraryShowRecord[],
  otherVideos: LibraryOtherVideoRecord[],
) {
  const nodes: ViewerNode[] = [];

  nodes.push({
    id: "shows",
    label: "Shows",
    depth: 0,
    files: [],
    parentId: null,
    hasChildren: shows.length > 0,
  });

  for (const show of shows) {
    nodes.push({
      id: `show:${show.id}`,
      label: show.title,
      depth: 1,
      files: [],
      parentId: "shows",
      hasChildren: show.seasons.length > 0,
    });

    for (const season of show.seasons) {
      nodes.push(buildSeasonNode(show, season));
    }
  }

  nodes.push({
    id: "movies",
    label: "Movies",
    depth: 0,
    files: [],
    parentId: null,
    hasChildren: movies.length > 0,
  });

  for (const movie of movies) {
    nodes.push({
      id: `movie:${movie.id}`,
      label: movie.year ? `${movie.title} (${movie.year})` : movie.title,
      depth: 1,
      files: movie.files,
      parentId: "movies",
    });
  }

  nodes.push({
    id: "other",
    label: "Other",
    depth: 0,
    files: [],
    parentId: null,
    hasChildren: otherVideos.length > 0,
  });

  for (const group of otherVideos) {
    nodes.push({
      id: `other:${group.id}`,
      label: group.title,
      depth: 1,
      files: group.files,
      parentId: "other",
    });
  }

  return nodes;
}

function buildSeasonNode(show: LibraryShowRecord, season: LibrarySeasonRecord): ViewerNode {
  return {
    id: `season:${show.id}:${season.id}`,
    label: `Season ${String(season.seasonNumber).padStart(2, "0")}`,
    depth: 2,
    files: season.episodes.flatMap((episode) => episode.files),
    parentId: `show:${show.id}`,
  };
}

function formatParsedLabel(file: LibraryFileRecord) {
  const { parsed } = file;

  if (parsed.type === "movie") {
    return parsed.year ? `${parsed.title} (${parsed.year})` : parsed.title;
  }

  if (parsed.type === "episode") {
    const season = parsed.seasonNumber ?? 0;
    const episodes = parsed.episodeNumbers
      .map((episodeNumber) => String(episodeNumber).padStart(2, "0"))
      .join("E");

    return episodes
      ? `${parsed.title} S${String(season).padStart(2, "0")}E${episodes}`
      : parsed.title;
  }

  return parsed.title;
}

function formatBrowserCopyStatus(file: LibraryFileRecord) {
  if (file.browserCopyStatus === "queued") {
    return "Queued";
  }

  if (
    file.browserCopyStatus === "processing" &&
    file.browserCopyProgress !== null
  ) {
    return `Encoding ${(file.browserCopyProgress * 100).toFixed(0)}%`;
  }

  if (file.browserCopyStatus === "processing") {
    return "Encoding";
  }

  return null;
}

export function LibraryPage() {
  const { library, libraryQuery, libraryStatus, rescanLibraryMutation } =
    useLibrary();
  const [encodeError, setEncodeError] = useState<string | null>(null);
  const [selectedPlayback, setSelectedPlayback] = useState<{
    fileId: string;
    mode: "browser";
  } | null>(null);
  const [browserPlaybackError, setBrowserPlaybackError] = useState<string | null>(
    null,
  );

  const allFiles = useMemo(
    () =>
      [
        ...library.movies.flatMap((movie) => movie.files),
        ...library.shows.flatMap((show) =>
          show.seasons.flatMap((season) =>
            season.episodes.flatMap((episode) => episode.files),
          ),
        ),
        ...library.otherVideos.flatMap((otherVideo) => otherVideo.files),
      ].sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
    [library],
  );

  const nodes = useMemo(
    () => buildViewerNodes(library.movies, library.shows, library.otherVideos),
    [library.movies, library.shows, library.otherVideos],
  );
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([]);

  useEffect(() => {
    if (!nodes.some((node) => node.id === selectedNodeId)) {
      const firstNodeWithFiles = nodes.find((node) => node.files.length > 0);
      setSelectedNodeId(firstNodeWithFiles?.id ?? nodes[0]?.id ?? "");
    }
  }, [nodes, selectedNodeId]);

  useEffect(() => {
    const defaultExpanded = nodes
      .filter((node) => node.hasChildren)
      .map((node) => node.id);

    setExpandedNodeIds((current) => {
      const next = current.filter((nodeId) =>
        nodes.some((node) => node.id === nodeId && node.hasChildren),
      );

      if (next.length > 0) {
        return next;
      }

      return defaultExpanded;
    });
  }, [nodes]);

  const expandedNodeIdSet = useMemo(
    () => new Set(expandedNodeIds),
    [expandedNodeIds],
  );

  const visibleNodes = useMemo(() => {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));

    return nodes.filter((node) => {
      let currentParentId = node.parentId;

      while (currentParentId) {
        if (!expandedNodeIdSet.has(currentParentId)) {
          return false;
        }

        currentParentId = nodeById.get(currentParentId)?.parentId ?? null;
      }

      return true;
    });
  }, [expandedNodeIdSet, nodes]);

  function toggleNode(nodeId: string) {
    setExpandedNodeIds((current) =>
      current.includes(nodeId)
        ? current.filter((id) => id !== nodeId)
        : [...current, nodeId],
    );
  }

  async function handlePlayInBrowser(file: LibraryFileRecord) {
    if (!file.browserUrl) {
      setBrowserPlaybackError("Browser-ready copy is not available yet.");
      setSelectedPlayback({ fileId: file.id, mode: "browser" });
      return;
    }

    try {
      await client.ensureBrowserReady(file.browserUrl);
      setBrowserPlaybackError(null);
      setSelectedPlayback({ fileId: file.id, mode: "browser" });
    } catch (error) {
      setBrowserPlaybackError(
        error instanceof Error
          ? error.message
          : "Browser-ready copy is not available yet.",
      );
      setSelectedPlayback({ fileId: file.id, mode: "browser" });
    }
  }

  async function handleEncodeFile(file: LibraryFileRecord) {
    try {
      setEncodeError(null);
      await client.encodeLibraryFile(file.id);
      await rescanLibraryMutation.mutateAsync();
    } catch (error) {
      setEncodeError(
        error instanceof Error ? error.message : "Failed to queue browser encoding",
      );
    }
  }

  async function handlePrimaryFileAction(file: LibraryFileRecord) {
    if (file.browserCopyStatus === "ready") {
      await handlePlayInBrowser(file);
      return;
    }

    if (file.browserCopyStatus === "unavailable") {
      await handleEncodeFile(file);
    }
  }

  const libraryError = libraryQuery.isError
    ? libraryQuery.error instanceof Error
      ? libraryQuery.error.message
      : "Unable to load the media library from the backend."
    : rescanLibraryMutation.isError
      ? rescanLibraryMutation.error instanceof Error
        ? rescanLibraryMutation.error.message
        : "Failed to rescan library"
      : null;

  return (
    <div className="grid gap-6">
      <section className="flex flex-col gap-4 rounded-[1.5rem] border border-border/70 bg-white/60 p-4 backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">Library</Badge>
            <span className="text-sm text-muted-foreground">
              {library.shows.length} shows, {library.movies.length} movies, {allFiles.length} files
            </span>
          </div>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            Media viewer
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Shows are grouped into virtual directories.
          </p>
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
      {encodeError ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {encodeError}
        </p>
      ) : null}

      <section>
        <Card className="bg-white/60">
          <CardHeader>
            <CardTitle>Folder viewer</CardTitle>
          <CardDescription>
              Grouped by shows, seasons, movies, and other videos.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1">
            {visibleNodes.map((node) => (
              <div className="grid gap-2" key={node.id}>
                {(() => {
                  const isExpanded = expandedNodeIdSet.has(node.id);
                  const showOpenFolder = node.hasChildren ? isExpanded : selectedNodeId === node.id;

                  return (
                <button
                  className={cn(
                    "flex items-center gap-2 rounded-[1rem] px-3 py-2 text-left text-sm transition-colors",
                    selectedNodeId === node.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-white/80 hover:text-foreground",
                  )}
                  onClick={() => {
                    setSelectedNodeId(node.id);
                    if (node.hasChildren) {
                      toggleNode(node.id);
                    }
                  }}
                  style={{ paddingLeft: `${12 + node.depth * 16}px` }}
                  type="button"
                >
                  {node.hasChildren ? (
                    isExpanded ? (
                      <ChevronDown className="size-4 shrink-0" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0" />
                    )
                  ) : (
                    <span className="size-5 shrink-0" />
                  )}
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {showOpenFolder ? (
                      <FolderOpen className="size-4 shrink-0" />
                    ) : (
                      <Folder className="size-4 shrink-0" />
                    )}
                    <span className="truncate">{node.label}</span>
                  </span>
                  <span className="ml-auto text-xs opacity-70">{node.files.length}</span>
                </button>
                  );
                })()}

                {selectedNodeId === node.id ? (
                  node.files.length ? (
                    <div className="grid gap-2">
                      {node.files.map((file) => (
                        <div className="grid gap-2" key={file.id}>
                          <div
                            className="flex items-center justify-between gap-3 rounded-[1rem] border border-border/70 bg-white/75 px-4 py-3"
                            style={{ marginLeft: `${28 + node.depth * 16}px` }}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <p className="min-w-0 truncate font-medium text-foreground">
                                {formatParsedLabel(file)}
                              </p>
                              {formatBrowserCopyStatus(file) ? (
                                <Badge variant="secondary">
                                  {formatBrowserCopyStatus(file)}
                                </Badge>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                disabled={
                                  file.browserCopyStatus === "queued" ||
                                  file.browserCopyStatus === "processing"
                                }
                                onClick={() => void handlePrimaryFileAction(file)}
                                size="sm"
                                variant="outline"
                              >
                                {file.browserCopyStatus === "ready"
                                  ? "Play"
                                  : file.browserCopyStatus === "queued"
                                    ? "Queued"
                                  : file.browserCopyStatus === "processing"
                                    ? "Encoding"
                                    : "Encode"}
                              </Button>
                            </div>
                          </div>

                          {selectedPlayback?.fileId === file.id ? (
                            <div style={{ marginLeft: `${28 + node.depth * 16}px` }}>
                              <BrowserPlayer
                                error={browserPlaybackError}
                                file={file}
                                modeLabel="Browser player"
                                onVideoError={() =>
                                  setBrowserPlaybackError(
                                    "The browser-safe copy could not be played. It may still be transcoding.",
                                  )
                                }
                                src={file.browserUrl ?? undefined}
                              />
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : node.hasChildren ? null : (
                    <p
                      className="rounded-[1rem] border border-dashed border-border/80 px-4 py-6 text-sm text-muted-foreground"
                      style={{ marginLeft: `${28 + node.depth * 16}px` }}
                    >
                      No files in this group.
                    </p>
                  )
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
