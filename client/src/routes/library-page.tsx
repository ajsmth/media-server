import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  MoreHorizontal,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useSearchParams } from "react-router";

import { client, queryKeys } from "@/fetch-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLibrary } from "@/hooks/use-library";
import { cn } from "@/lib/utils";

type ViewerNode = {
  id: string;
  kind: "group" | "show" | "season" | "movie" | "other";
  label: string;
  depth: number;
  files: LibraryFileRecord[];
  allFiles: LibraryFileRecord[];
  parentId: string | null;
  hasChildren?: boolean;
  relativeDirectoryPath: string | null;
};

function normalizeSearchValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function matchesFuzzySearch(value: string, query: string) {
  const normalizedValue = normalizeSearchValue(value);
  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedQuery) {
    return true;
  }

  let queryIndex = 0;

  for (const character of normalizedValue) {
    if (character === normalizedQuery[queryIndex]) {
      queryIndex += 1;
    }

    if (queryIndex === normalizedQuery.length) {
      return true;
    }
  }

  return false;
}

function buildViewerNodes(
  movies: LibraryMovieRecord[],
  shows: LibraryShowRecord[],
  otherVideos: LibraryOtherVideoRecord[],
  allFiles: LibraryFileRecord[],
) {
  const nodes: ViewerNode[] = [];
  const showFiles = shows.flatMap((show) =>
    show.seasons.flatMap((season) =>
      season.episodes.flatMap((episode) => episode.files),
    ),
  );
  const movieFiles = movies.flatMap((movie) => movie.files);
  const otherFiles = otherVideos.flatMap((group) => group.files);

  nodes.push({
    id: "shows",
    kind: "group",
    label: "Shows",
    depth: 0,
    files: [],
    allFiles: showFiles,
    parentId: null,
    hasChildren: shows.length > 0,
    relativeDirectoryPath: null,
  });

  for (const show of shows) {
    const files = show.seasons.flatMap((season) =>
      season.episodes.flatMap((episode) => episode.files),
    );

    nodes.push({
      id: `show:${show.id}`,
      kind: "show",
      label: show.title,
      depth: 1,
      files: [],
      allFiles: files,
      parentId: "shows",
      hasChildren: show.seasons.length > 0,
      relativeDirectoryPath: resolveConcreteDirectoryPath(files, allFiles),
    });

    for (const season of show.seasons) {
      nodes.push(buildSeasonNode(show, season, allFiles));
    }
  }

  nodes.push({
    id: "movies",
    kind: "group",
    label: "Movies",
    depth: 0,
    files: [],
    allFiles: movieFiles,
    parentId: null,
    hasChildren: movies.length > 0,
    relativeDirectoryPath: null,
  });

  for (const movie of movies) {
    nodes.push({
      id: `movie:${movie.id}`,
      kind: "movie",
      label: movie.year ? `${movie.title} (${movie.year})` : movie.title,
      depth: 1,
      files: movie.files,
      allFiles: movie.files,
      parentId: "movies",
      relativeDirectoryPath: resolveConcreteDirectoryPath(movie.files, allFiles),
    });
  }

  nodes.push({
    id: "other",
    kind: "group",
    label: "Other",
    depth: 0,
    files: [],
    allFiles: otherFiles,
    parentId: null,
    hasChildren: otherVideos.length > 0,
    relativeDirectoryPath: null,
  });

  for (const group of otherVideos) {
    nodes.push({
      id: `other:${group.id}`,
      kind: "other",
      label: group.title,
      depth: 1,
      files: group.files,
      allFiles: group.files,
      parentId: "other",
      relativeDirectoryPath: resolveConcreteDirectoryPath(group.files, allFiles),
    });
  }

  return nodes;
}

function buildSeasonNode(
  show: LibraryShowRecord,
  season: LibrarySeasonRecord,
  allFiles: LibraryFileRecord[],
): ViewerNode {
  const files = season.episodes.flatMap((episode) => episode.files);

  return {
    id: `season:${show.id}:${season.id}`,
    kind: "season",
    label: `Season ${String(season.seasonNumber).padStart(2, "0")}`,
    depth: 2,
    files,
    allFiles: files,
    parentId: `show:${show.id}`,
    relativeDirectoryPath: resolveConcreteDirectoryPath(files, allFiles),
  };
}

function normalizeRelativePath(value: string) {
  return value.split("\\").join("/");
}

function commonDirectoryPath(relativePaths: string[]) {
  const directorySegments = relativePaths
    .map((relativePath) => {
      const directory = normalizeRelativePath(relativePath).split("/").slice(0, -1);
      return directory.length > 0 ? directory : null;
    })
    .filter((directory): directory is string[] => directory !== null);

  if (directorySegments.length !== relativePaths.length || directorySegments.length === 0) {
    return null;
  }

  const sharedSegments = [...directorySegments[0]];

  for (const segments of directorySegments.slice(1)) {
    while (
      sharedSegments.length > 0 &&
      sharedSegments.some((segment, index) => segments[index] !== segment)
    ) {
      sharedSegments.pop();
    }
  }

  return sharedSegments.length > 0 ? sharedSegments.join("/") : null;
}

function isWithinDirectory(relativePath: string, directoryPath: string) {
  const normalizedPath = normalizeRelativePath(relativePath);
  const normalizedDirectory = normalizeRelativePath(directoryPath);

  return (
    normalizedPath === normalizedDirectory ||
    normalizedPath.startsWith(`${normalizedDirectory}/`)
  );
}

function resolveConcreteDirectoryPath(
  nodeFiles: LibraryFileRecord[],
  allFiles: LibraryFileRecord[],
) {
  const directoryPath = commonDirectoryPath(
    nodeFiles.map((file) => file.relativePath),
  );

  if (!directoryPath) {
    return null;
  }

  const nodeFileIds = new Set(nodeFiles.map((file) => file.id));
  const hasOutsideFiles = allFiles.some((file) =>
    isWithinDirectory(file.relativePath, directoryPath) &&
    !nodeFileIds.has(file.id)
  );

  return hasOutsideFiles ? null : directoryPath;
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

function formatFileProcessingStatus(file: LibraryFileRecord) {
  if (file.fileProcessingStatus === "queued") {
    return "Queued";
  }

  if (
    file.fileProcessingStatus === "processing" &&
    file.fileProcessingProgress !== null
  ) {
    return `Encoding ${(file.fileProcessingProgress * 100).toFixed(0)}%`;
  }

  if (file.fileProcessingStatus === "processing") {
    return "Encoding";
  }

  return null;
}

function getResumePositionSeconds(file: LibraryFileRecord) {
  if (!file.playback || file.playback.completed || file.playback.positionSeconds <= 0) {
    return null;
  }

  return file.playback.positionSeconds;
}

function getMostRecentResumableFile(files: LibraryFileRecord[]) {
  return files
    .filter((file) => getResumePositionSeconds(file) !== null)
    .sort((left, right) =>
      (right.playback?.updatedAt ?? "").localeCompare(left.playback?.updatedAt ?? ""),
    )[0] ?? null;
}

function formatPlaybackTimestamp(seconds: number | null) {
  if (seconds === null || seconds <= 0) {
    return null;
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

type RowActionsMenuProps = {
  onMerge?: (() => void) | null;
  onDelete?: (() => void) | null;
  onRegenerateTitle?: (() => void) | null;
};

function RowActionsMenu({
  onMerge,
  onDelete,
  onRegenerateTitle,
}: RowActionsMenuProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label="More actions"
          onClick={(event) => event.stopPropagation()}
          size="icon"
          variant="ghost"
        >
          <MoreHorizontal />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid gap-1">
          {onRegenerateTitle ? (
            <button
              className="w-full rounded-[0.8rem] px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary/70"
              onClick={onRegenerateTitle}
              type="button"
            >
              Regenerate title
            </button>
          ) : null}
          {onMerge ? (
            <button
              className="w-full rounded-[0.8rem] px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary/70"
              onClick={onMerge}
              type="button"
            >
              Merge into...
            </button>
          ) : null}
          {onDelete ? (
            <button
              className="w-full rounded-[0.8rem] px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
              onClick={onDelete}
              type="button"
            >
              Delete
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function LibraryPage() {
  const queryClient = useQueryClient();
  const { library, libraryQuery, libraryStatus, rescanLibraryMutation } =
    useLibrary();
  const [, setSearchParams] = useSearchParams();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [libraryActionError, setLibraryActionError] = useState<string | null>(null);
  const [isSavingRegeneratedTitle, setIsSavingRegeneratedTitle] = useState(false);
  const [isTitleDialogOpen, setIsTitleDialogOpen] = useState(false);
  const [isTitleSuggestionLoading, setIsTitleSuggestionLoading] = useState(false);
  const [regeneratedTitleInput, setRegeneratedTitleInput] = useState("");
  const [titleDialogNode, setTitleDialogNode] = useState<ViewerNode | null>(null);
  const [uploadingLabel, setUploadingLabel] = useState<string | null>(null);

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
    () => buildViewerNodes(library.movies, library.shows, library.otherVideos, allFiles),
    [allFiles, library.movies, library.shows, library.otherVideos],
  );
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([]);

  useEffect(() => {
    const defaultExpanded = nodes
      .filter((node) => node.parentId === null)
      .map((node) => node.id);

    setExpandedNodeIds((current) => {
      const next = current.filter((nodeId) =>
        nodes.some((node) => node.id === nodeId),
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

  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );

  const filteredFilesByNodeId = useMemo(() => {
    const next = new Map<string, LibraryFileRecord[]>();

    for (const node of nodes) {
      next.set(
        node.id,
        searchQuery
          ? node.files.filter((file) => matchesFuzzySearch(formatParsedLabel(file), searchQuery))
          : node.files,
      );
    }

    return next;
  }, [nodes, searchQuery]);

  const matchingNodeIdSet = useMemo(() => {
    if (!searchQuery) {
      return null;
    }

    const next = new Set<string>();

    for (const node of nodes) {
      if ((filteredFilesByNodeId.get(node.id) ?? []).length === 0) {
        continue;
      }

      let currentNode: ViewerNode | undefined = node;

      while (currentNode) {
        next.add(currentNode.id);
        currentNode = currentNode.parentId ? nodeById.get(currentNode.parentId) : undefined;
      }
    }

    return next;
  }, [filteredFilesByNodeId, nodeById, nodes, searchQuery]);

  const effectiveExpandedNodeIdSet = useMemo(() => {
    if (!matchingNodeIdSet) {
      return expandedNodeIdSet;
    }

    return new Set([...expandedNodeIds, ...matchingNodeIdSet]);
  }, [expandedNodeIdSet, expandedNodeIds, matchingNodeIdSet]);

  const visibleNodes = useMemo(() => {
    return nodes.filter((node) => {
      if (matchingNodeIdSet && !matchingNodeIdSet.has(node.id)) {
        return false;
      }

      let currentParentId = node.parentId;

      while (currentParentId) {
        if (!effectiveExpandedNodeIdSet.has(currentParentId)) {
          return false;
        }

        currentParentId = nodeById.get(currentParentId)?.parentId ?? null;
      }

      return true;
    });
  }, [effectiveExpandedNodeIdSet, matchingNodeIdSet, nodeById, nodes]);

  function toggleNode(nodeId: string) {
    setExpandedNodeIds((current) =>
      current.includes(nodeId)
        ? current.filter((id) => id !== nodeId)
        : [...current, nodeId],
    );
  }

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

  async function handleEncodeFile(file: LibraryFileRecord) {
    try {
      setLibraryActionError(null);
      await client.encodeLibraryFile(file.id);
      await rescanLibraryMutation.mutateAsync();
    } catch (error) {
      setLibraryActionError(
        error instanceof Error ? error.message : "Failed to queue browser encoding",
      );
    }
  }

  async function handleUploadSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    try {
      setLibraryActionError(null);

      for (const [index, file] of files.entries()) {
        setUploadingLabel(`Uploading ${index + 1}/${files.length}: ${file.name}`);
        await client.uploadLibraryFile(file);
      }

      await rescanLibraryMutation.mutateAsync();
    } catch (error) {
      setLibraryActionError(
        error instanceof Error ? error.message : "Failed to upload file to the library",
      );
    } finally {
      setUploadingLabel(null);
      event.target.value = "";
    }
  }

  async function handleDeleteFile(file: LibraryFileRecord) {
    if (!window.confirm(`Delete "${formatParsedLabel(file)}" from disk?`)) {
      return;
    }

    try {
      setLibraryActionError(null);
      await client.deleteLibraryFile(file.id);

      await rescanLibraryMutation.mutateAsync();
    } catch (error) {
      setLibraryActionError(
        error instanceof Error ? error.message : "Failed to delete file from the library",
      );
    }
  }

  async function handleDeleteFolder(node: ViewerNode) {
    if (!node.relativeDirectoryPath) {
      return;
    }

    if (!window.confirm(`Delete "${node.label}" and its files from disk?`)) {
      return;
    }

    try {
      setLibraryActionError(null);
      await client.deleteLibraryFolder(node.relativeDirectoryPath);

      await rescanLibraryMutation.mutateAsync();
    } catch (error) {
      setLibraryActionError(
        error instanceof Error ? error.message : "Failed to delete folder from the library",
      );
    }
  }

  async function handleMergeShow(node: ViewerNode) {
    if (node.kind !== "show") {
      return;
    }

    const targetTitle = window.prompt(
      `Merge "${node.label}" into which show title?`,
      node.label,
    )?.trim();

    if (!targetTitle || targetTitle === node.label) {
      return;
    }

    try {
      setLibraryActionError(null);
      const snapshot = await client.mergeLibraryShows(node.label, targetTitle);
      queryClient.setQueryData(queryKeys.library, snapshot);
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryStatus });
    } catch (error) {
      setLibraryActionError(
        error instanceof Error ? error.message : "Failed to merge show grouping",
      );
    }
  }

  async function handleOpenRegenerateTitleDialog(node: ViewerNode) {
    if (node.kind !== "show" && node.kind !== "movie" && node.kind !== "other") {
      return;
    }

    try {
      setLibraryActionError(null);
      setIsTitleSuggestionLoading(true);
      setTitleDialogNode(node);
      setIsTitleDialogOpen(true);
      setRegeneratedTitleInput(node.label);

      const response = await client.regenerateLibraryTitle({
        kind: node.kind,
        currentTitle: node.label,
        relativePaths: node.allFiles.map((file) => file.relativePath),
      });

      setRegeneratedTitleInput(response.suggestedTitle);
    } catch (error) {
      setIsTitleDialogOpen(false);
      setTitleDialogNode(null);
      setLibraryActionError(
        error instanceof Error ? error.message : "Failed to regenerate title",
      );
    } finally {
      setIsTitleSuggestionLoading(false);
    }
  }

  async function handleSaveRegeneratedTitle() {
    if (
      !titleDialogNode ||
      (
        titleDialogNode.kind !== "show" &&
        titleDialogNode.kind !== "movie" &&
        titleDialogNode.kind !== "other"
      )
    ) {
      return;
    }

    try {
      setLibraryActionError(null);
      setIsSavingRegeneratedTitle(true);
      const snapshot = await client.saveLibraryTitleOverride({
        kind: titleDialogNode.kind,
        title: regeneratedTitleInput,
        relativePaths: titleDialogNode.allFiles.map((file) => file.relativePath),
      });
      queryClient.setQueryData(queryKeys.library, snapshot);
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryStatus });
      setIsTitleDialogOpen(false);
      setTitleDialogNode(null);
      setRegeneratedTitleInput("");
    } catch (error) {
      setLibraryActionError(
        error instanceof Error ? error.message : "Failed to save title override",
      );
    } finally {
      setIsSavingRegeneratedTitle(false);
    }
  }

  async function handlePrimaryFileAction(file: LibraryFileRecord) {
    if (file.fileProcessingStatus === "unavailable") {
      await handleEncodeFile(file);
    }
  }

  async function handleResumeFile(file: LibraryFileRecord) {
    const resumePositionSeconds = getResumePositionSeconds(file);

    if (resumePositionSeconds === null) {
      return;
    }

    openPlayer(file.id, true);
  }

  async function handleResumeNode(node: ViewerNode) {
    const resumableFile = getMostRecentResumableFile(node.allFiles);

    if (!resumableFile) {
      return;
    }

    await handleResumeFile(resumableFile);
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
      <section className="flex flex-col gap-4 rounded-[1.5rem] border border-border/70 bg-white/60 p-4 backdrop-blur">
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
          <p className="mt-2 hidden text-sm text-muted-foreground sm:block">
            Shows are grouped into virtual directories.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            className="w-full sm:w-auto"
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
        </div>
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
      {libraryActionError ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {libraryActionError}
        </p>
      ) : null}
      {uploadingLabel ? (
        <p className="rounded-2xl border border-primary/15 bg-primary/10 px-4 py-3 text-sm text-primary">
          {uploadingLabel}
        </p>
      ) : null}

      <section>
        <Card className="bg-white/60">
          <CardHeader className="space-y-3">
            <CardTitle>Folder viewer</CardTitle>
            <CardDescription className="hidden sm:block">
              Grouped by shows, seasons, movies, and other videos.
            </CardDescription>
            <div>
              <input
                accept=".mkv,.mp4,video/*"
                className="hidden"
                multiple
                onChange={handleUploadSelection}
                ref={uploadInputRef}
                type="file"
              />
              <Button
                className="w-full sm:w-auto"
                disabled={uploadingLabel !== null}
                onClick={() => uploadInputRef.current?.click()}
                variant="outline"
              >
                <Upload />
                Add files
              </Button>
            </div>
            <div>
              <input
                className="w-full rounded-[1rem] border border-border/70 bg-white/80 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/60"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search files"
                type="search"
                value={searchQuery}
              />
            </div>
          </CardHeader>
          <CardContent className="grid auto-rows-min content-start min-h-[70vh] gap-1 sm:min-h-[48rem]">
            {searchQuery && visibleNodes.length === 0 ? (
              <p className="rounded-[1rem] border border-dashed border-border/80 px-4 py-6 text-sm text-muted-foreground">
                No matching files.
              </p>
            ) : null}
            {visibleNodes.map((node) => (
              <div className="grid gap-2" key={node.id}>
                {(() => {
                  const visibleFiles = filteredFilesByNodeId.get(node.id) ?? [];
                  const isExpandable = node.hasChildren || visibleFiles.length > 0;
                  const isExpanded = effectiveExpandedNodeIdSet.has(node.id);
                  const showOpenFolder = isExpanded;
                    const canDeleteFolder = node.relativeDirectoryPath !== null;
                    const showRowActions = node.kind === "show";
                    const canRegenerateTitle =
                      node.kind === "show" || node.kind === "movie" || node.kind === "other";
                    const showActionsMenu = canDeleteFolder || showRowActions || canRegenerateTitle;
                    const canResumeNode =
                      (node.id.startsWith("show:") || node.id.startsWith("movie:")) &&
                      getMostRecentResumableFile(node.allFiles) !== null;

                  return (
                    <div
                      className={cn(
                        "flex items-center gap-1 rounded-[1rem] px-1 py-1 text-sm transition-colors sm:gap-2",
                        isExpanded
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-white/80 hover:text-foreground",
                      )}
                    >
                      <button
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-[1rem] px-2 py-2 text-left"
                        onClick={() => toggleNode(node.id)}
                        style={{ paddingLeft: `${12 + node.depth * 16}px` }}
                        type="button"
                      >
                        {isExpandable ? (
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
                      </button>
                      {canResumeNode ? (
                        <Button
                          className="h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-xs"
                          onClick={() => void handleResumeNode(node)}
                          size="sm"
                          variant="outline"
                        >
                          Resume
                        </Button>
                      ) : null}
                      <span className="text-xs opacity-70">{node.allFiles.length}</span>
                      {showActionsMenu ? (
                        <RowActionsMenu
                          onRegenerateTitle={
                            canRegenerateTitle ? () => void handleOpenRegenerateTitleDialog(node) : null
                          }
                          onMerge={node.kind === "show" ? () => void handleMergeShow(node) : null}
                          onDelete={canDeleteFolder ? () => void handleDeleteFolder(node) : null}
                        />
                      ) : null}
                    </div>
                  );
                })()}

                {effectiveExpandedNodeIdSet.has(node.id) ? (
                  (filteredFilesByNodeId.get(node.id) ?? []).length ? (
                    <div className="flex flex-col gap-2">
                      {(filteredFilesByNodeId.get(node.id) ?? []).map((file) => (
                        <div className="flex flex-col gap-2" key={file.id}>
                          {(() => {
                            const resumePositionSeconds = getResumePositionSeconds(file);

                            return (
                          <div
                            className="flex flex-col gap-2 rounded-[1rem] border border-border/70 bg-white/75 px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4"
                            style={{ marginLeft: `${28 + node.depth * 16}px` }}
                          >
                            <button
                              className="min-w-0 flex-1 rounded-[0.9rem] px-1 py-1 text-left transition-colors hover:bg-white/80"
                              onClick={() => openPlayer(file.id, resumePositionSeconds !== null)}
                              type="button"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <p className="min-w-0 truncate font-medium text-foreground">
                                  {formatParsedLabel(file)}
                                </p>
                                {formatFileProcessingStatus(file) ? (
                                  <Badge className="shrink-0" variant="secondary">
                                    {formatFileProcessingStatus(file)}
                                  </Badge>
                                ) : null}
                              </div>
                              {resumePositionSeconds !== null ? (
                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                  Resume at {formatPlaybackTimestamp(resumePositionSeconds)}
                                </p>
                              ) : null}
                            </button>
                            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
                              {file.fileProcessingStatus !== "ready" ? (
                                <Button
                                  className="h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-xs"
                                  disabled={
                                    file.fileProcessingStatus === "queued" ||
                                    file.fileProcessingStatus === "processing"
                                  }
                                  onClick={() => void handlePrimaryFileAction(file)}
                                  size="sm"
                                  variant="outline"
                                >
                                  {file.fileProcessingStatus === "queued"
                                    ? "Queued"
                                    : file.fileProcessingStatus === "processing"
                                      ? "Encoding"
                                      : "Encode"}
                                </Button>
                              ) : null}
                              <RowActionsMenu
                                onDelete={() => void handleDeleteFile(file)}
                              />
                            </div>
                          </div>
                            );
                          })()}
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

      <Dialog
        onOpenChange={(open) => {
          setIsTitleDialogOpen(open);

          if (!open) {
            setTitleDialogNode(null);
            setRegeneratedTitleInput("");
            setIsTitleSuggestionLoading(false);
          }
        }}
        open={isTitleDialogOpen}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Regenerate title</DialogTitle>
            <DialogDescription>
              Review the regenerated title, edit it if needed, then save it to the library index.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            {titleDialogNode ? (
              <p className="text-sm text-muted-foreground">
                Updating <span className="font-medium text-foreground">{titleDialogNode.label}</span>
              </p>
            ) : null}
            <Input
              disabled={isTitleSuggestionLoading || isSavingRegeneratedTitle}
              onChange={(event) => setRegeneratedTitleInput(event.target.value)}
              placeholder="Generated title"
              value={regeneratedTitleInput}
            />
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => {
                  setIsTitleDialogOpen(false);
                  setTitleDialogNode(null);
                  setRegeneratedTitleInput("");
                }}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={
                  isTitleSuggestionLoading ||
                  isSavingRegeneratedTitle ||
                  regeneratedTitleInput.trim().length === 0
                }
                onClick={() => void handleSaveRegeneratedTitle()}
                type="button"
              >
                {isTitleSuggestionLoading ? (
                  <>
                    <LoaderCircle className="animate-spin" />
                    Regenerating
                  </>
                ) : isSavingRegeneratedTitle ? (
                  <>
                    <LoaderCircle className="animate-spin" />
                    Saving
                  </>
                ) : (
                  "Save title"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
