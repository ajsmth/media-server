import { promises as fs } from "node:fs";
import { watch, type FSWatcher } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import parseVideoName from "video-name-parser";
import type {
  LibraryCatalogSnapshot,
  LibraryCatalogStatus,
  LibraryOtherVideoRecord,
  LibraryFileRecord,
  ParsedMediaDetails,
} from "@media-server/shared";

import {
  MediaLibrary,
  type PlayableFileEntry,
} from "./media-library";

type LibraryCatalogServiceOptions = {
  mediaDir: string;
  indexFilePath: string;
  watchForChanges?: boolean;
};

type MutableMovie = {
  id: string;
  title: string;
  sortTitle: string;
  year: number | null;
  files: LibraryFileRecord[];
};

type MutableEpisode = {
  id: string;
  title: string;
  seasonNumber: number;
  episodeNumbers: number[];
  files: LibraryFileRecord[];
};

type MutableSeason = {
  id: string;
  seasonNumber: number;
  episodes: Map<string, MutableEpisode>;
};

type MutableShow = {
  id: string;
  title: string;
  sortTitle: string;
  seasons: Map<number, MutableSeason>;
};

const EMPTY_SNAPSHOT: LibraryCatalogSnapshot = {
  generatedAt: new Date(0).toISOString(),
  lastScanAt: null,
  movies: [],
  shows: [],
  otherVideos: [],
};

export class LibraryCatalogService {
  private snapshot: LibraryCatalogSnapshot = EMPTY_SNAPSHOT;
  private readonly fileIndex = new Map<string, LibraryFileRecord>();
  private readonly status: LibraryCatalogStatus = {
    state: "idle",
    lastScanAt: null,
    lastError: null,
    watchEnabled: true,
  };
  private scanPromise: Promise<LibraryCatalogSnapshot> | null = null;
  private watcher: FSWatcher | null = null;
  private pendingScanTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly mediaLibrary: MediaLibrary,
    private readonly options: LibraryCatalogServiceOptions,
  ) {
    this.status.watchEnabled = options.watchForChanges ?? true;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(path.dirname(this.options.indexFilePath), { recursive: true });
    await this.loadPersistedSnapshot();
    await this.rescan();
    this.startWatcher();
  }

  getSnapshot(): LibraryCatalogSnapshot {
    return this.snapshot;
  }

  getStatus(): LibraryCatalogStatus {
    return { ...this.status };
  }

  async rescan(): Promise<LibraryCatalogSnapshot> {
    if (this.scanPromise) {
      return this.scanPromise;
    }

    this.status.state = "scanning";
    this.status.lastError = null;

    this.scanPromise = this.performRescan()
      .then((snapshot) => {
        this.snapshot = snapshot;
        this.rebuildFileIndex(snapshot);
        this.status.state = "idle";
        this.status.lastScanAt = snapshot.lastScanAt;
        return snapshot;
      })
      .catch((error) => {
        this.status.state = "error";
        this.status.lastError =
          error instanceof Error ? error.message : "Library scan failed";
        throw error;
      })
      .finally(() => {
        this.scanPromise = null;
      });

    return this.scanPromise;
  }

  findFileById(fileId: string): LibraryFileRecord | null {
    return this.fileIndex.get(fileId) ?? null;
  }

  async resolveSourceFilePath(fileId: string): Promise<string | null> {
    const file = this.findFileById(fileId);

    if (!file) {
      return null;
    }

    return this.mediaLibrary.resolveExistingFile(file.relativePath);
  }

  async resolveBrowserFilePath(fileId: string): Promise<string | null> {
    const file = this.findFileById(fileId);

    if (!file || !file.browserCopyReady) {
      return null;
    }

    return this.mediaLibrary.resolveExistingFile(this.mediaLibrary.browserMediaPathFor(file.relativePath));
  }

  private async loadPersistedSnapshot(): Promise<void> {
    try {
      const raw = await fs.readFile(this.options.indexFilePath, "utf8");
      const parsed = JSON.parse(raw) as LibraryCatalogSnapshot;
      this.snapshot = parsed;
      this.status.lastScanAt = parsed.lastScanAt;
      this.rebuildFileIndex(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn("Unable to load library index:", error);
      }
    }
  }

  private async performRescan(): Promise<LibraryCatalogSnapshot> {
    const entries = await this.mediaLibrary.listPlayableFileEntries();
    const movies = new Map<string, MutableMovie>();
    const shows = new Map<string, MutableShow>();
    const otherVideos = new Map<string, LibraryOtherVideoRecord>();

    for (const entry of entries) {
      const parsed = this.classifyEntry(entry.relativePath);
      const file = await this.buildFileRecord(entry, parsed);

      if (parsed.type === "movie") {
        const movieKey = `${parsed.normalizedTitle}|${parsed.year ?? ""}`;
        const existingMovie = movies.get(movieKey) ?? {
          id: hashId(`movie:${movieKey}`),
          title: parsed.title,
          sortTitle: normalizeSortTitle(parsed.title),
          year: parsed.year,
          files: [],
        };
        existingMovie.files.push(file);
        movies.set(movieKey, existingMovie);
        continue;
      }

      if (parsed.type === "episode" && parsed.seasonNumber !== null) {
        const showKey = parsed.normalizedTitle;
        const existingShow = shows.get(showKey) ?? {
          id: hashId(`show:${showKey}`),
          title: parsed.title,
          sortTitle: normalizeSortTitle(parsed.title),
          seasons: new Map<number, MutableSeason>(),
        };
        const existingSeason = existingShow.seasons.get(parsed.seasonNumber) ?? {
          id: hashId(`season:${showKey}:${parsed.seasonNumber}`),
          seasonNumber: parsed.seasonNumber,
          episodes: new Map<string, MutableEpisode>(),
        };
        const episodeKey = `${parsed.seasonNumber}:${parsed.episodeNumbers.join("-")}`;
        const existingEpisode = existingSeason.episodes.get(episodeKey) ?? {
          id: hashId(`episode:${showKey}:${episodeKey}`),
          title: describeEpisode(parsed.episodeNumbers),
          seasonNumber: parsed.seasonNumber,
          episodeNumbers: parsed.episodeNumbers,
          files: [],
        };
        existingEpisode.files.push(file);
        existingSeason.episodes.set(episodeKey, existingEpisode);
        existingShow.seasons.set(parsed.seasonNumber, existingSeason);
        shows.set(showKey, existingShow);
        continue;
      }

      const otherKey = parsed.normalizedTitle || hashId(`other:${entry.relativePath}`);
      const existingOther = otherVideos.get(otherKey) ?? {
        id: hashId(`other-group:${otherKey}`),
        title: parsed.title,
        files: [],
      };
      existingOther.files.push(file);
      otherVideos.set(otherKey, existingOther);
    }

    const snapshot: LibraryCatalogSnapshot = {
      generatedAt: new Date().toISOString(),
      lastScanAt: new Date().toISOString(),
      movies: Array.from(movies.values())
        .map((movie) => ({
          ...movie,
          files: movie.files.sort(compareFiles),
        }))
        .sort((left, right) => left.sortTitle.localeCompare(right.sortTitle)),
      shows: Array.from(shows.values())
        .map((show) => ({
          id: show.id,
          title: show.title,
          sortTitle: show.sortTitle,
          seasons: Array.from(show.seasons.values())
            .sort((left, right) => left.seasonNumber - right.seasonNumber)
            .map((season) => ({
              id: season.id,
              seasonNumber: season.seasonNumber,
              episodes: Array.from(season.episodes.values())
                .sort(compareEpisodes)
                .map((episode) => ({
                  ...episode,
                  files: episode.files.sort(compareFiles),
                })),
            })),
        }))
        .sort((left, right) => left.sortTitle.localeCompare(right.sortTitle)),
      otherVideos: Array.from(otherVideos.values())
        .map((group) => ({
          ...group,
          files: group.files.sort(compareFiles),
        }))
        .sort((left, right) => left.title.localeCompare(right.title)),
    };

    await fs.writeFile(
      this.options.indexFilePath,
      `${JSON.stringify(snapshot, null, 2)}\n`,
      "utf8",
    );

    return snapshot;
  }

  private async buildFileRecord(
    entry: PlayableFileEntry,
    parsed: ParsedMediaDetails,
  ): Promise<LibraryFileRecord> {
    const fileId = hashId(`file:${entry.relativePath}`);
    const browserCopyReady = await this.mediaLibrary.hasBrowserMediaFor(entry.relativePath);
    const sourceUrl = `/api/library/files/${fileId}/source`;
    const browserUrl = browserCopyReady ? `/api/library/files/${fileId}/browser` : null;

    return {
      id: fileId,
      relativePath: entry.relativePath,
      basename: entry.baseName,
      sizeBytes: entry.sizeBytes,
      modifiedAt: entry.modifiedAt,
      sourceUrl,
      browserUrl,
      browserCopyReady,
      parsed,
    };
  }

  private classifyEntry(relativePath: string): ParsedMediaDetails {
    const normalizedRelativePath = relativePath.split(path.sep).join("/");
    const segments = normalizedRelativePath.split("/");
    const stem = path.parse(segments.at(-1) ?? normalizedRelativePath).name;
    const rootFolder = segments.length > 1 ? segments[0] : null;
    const seasonNumberFromFolder = detectSeasonFolderNumber(segments);
    const parsed = parseVideoName(stem);

    if (
      parsed.type === "series" &&
      typeof parsed.season === "number" &&
      Array.isArray(parsed.episode) &&
      parsed.episode.length > 0
    ) {
      const showTitleSource = rootFolder && seasonNumberFromFolder !== null
        ? rootFolder
        : parsed.name ?? stem;
      return {
        rawName: stem,
        title: humanizeTitle(showTitleSource),
        normalizedTitle: normalizeIdentity(showTitleSource),
        type: "episode",
        year: null,
        seasonNumber: parsed.season,
        episodeNumbers: [...parsed.episode].sort((left, right) => left - right),
        tags: parsed.tag ?? [],
        confidence: "high",
      };
    }

    if (parsed.type === "movie") {
      const movieTitleSource =
        rootFolder && namesLikelyMatch(rootFolder, stem) ? rootFolder : parsed.name ?? stem;
      return {
        rawName: stem,
        title: humanizeTitle(movieTitleSource),
        normalizedTitle: normalizeIdentity(movieTitleSource),
        type: "movie",
        year: parsed.year ?? null,
        seasonNumber: null,
        episodeNumbers: [],
        tags: parsed.tag ?? [],
        confidence: parsed.year ? "high" : "medium",
      };
    }

    if (rootFolder && seasonNumberFromFolder !== null) {
      return {
        rawName: stem,
        title: humanizeTitle(rootFolder),
        normalizedTitle: normalizeIdentity(rootFolder),
        type: "episode",
        year: null,
        seasonNumber: seasonNumberFromFolder,
        episodeNumbers: [],
        tags: [],
        confidence: "low",
      };
    }

    if (rootFolder && namesLikelyMatch(rootFolder, stem)) {
      return {
        rawName: stem,
        title: humanizeTitle(rootFolder),
        normalizedTitle: normalizeIdentity(rootFolder),
        type: "movie",
        year: null,
        seasonNumber: null,
        episodeNumbers: [],
        tags: [],
        confidence: "medium",
      };
    }

    if (segments.length === 1) {
      return {
        rawName: stem,
        title: humanizeTitle(stem),
        normalizedTitle: normalizeIdentity(stem),
        type: "movie",
        year: null,
        seasonNumber: null,
        episodeNumbers: [],
        tags: parsed.tag ?? [],
        confidence: "low",
      };
    }

    return {
      rawName: stem,
      title: humanizeTitle(rootFolder ?? stem),
      normalizedTitle: normalizeIdentity(rootFolder ?? stem),
      type: "other",
      year: null,
      seasonNumber: null,
      episodeNumbers: [],
      tags: parsed.tag ?? [],
      confidence: "low",
    };
  }

  private rebuildFileIndex(snapshot: LibraryCatalogSnapshot): void {
    this.fileIndex.clear();

    for (const movie of snapshot.movies) {
      for (const file of movie.files) {
        this.fileIndex.set(file.id, file);
      }
    }

    for (const show of snapshot.shows) {
      for (const season of show.seasons) {
        for (const episode of season.episodes) {
          for (const file of episode.files) {
            this.fileIndex.set(file.id, file);
          }
        }
      }
    }

    for (const group of snapshot.otherVideos) {
      for (const file of group.files) {
        this.fileIndex.set(file.id, file);
      }
    }
  }

  private startWatcher(): void {
    if (!this.status.watchEnabled) {
      return;
    }

    try {
      this.watcher?.close();
      this.watcher = watch(
        this.options.mediaDir,
        { recursive: true },
        (_eventType, fileName) => {
          const relativePath = fileName?.toString().split(path.sep).join("/") ?? "";

          if (
            !relativePath ||
            relativePath.startsWith(".incomplete/") ||
            relativePath.startsWith("browser/") ||
            relativePath.startsWith(".index/")
          ) {
            return;
          }

          if (this.pendingScanTimer) {
            clearTimeout(this.pendingScanTimer);
          }

          this.pendingScanTimer = setTimeout(() => {
            void this.rescan().catch((error) => {
              console.error("Automatic library rescan failed:", error);
            });
            this.pendingScanTimer = null;
          }, 750);
        },
      );
    } catch (error) {
      this.status.watchEnabled = false;
      this.status.lastError =
        error instanceof Error ? error.message : "Unable to start library watcher";
    }
  }
}

function normalizeIdentity(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[\W_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function humanizeTitle(value: string): string {
  const normalized = value
    .replace(/\.[^.]+$/, "")
    .replace(/[._]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const lowerCased = normalized.toLowerCase();

  return lowerCased.replace(/\b([a-z0-9])([a-z0-9']*)/g, (_match, first, rest) =>
    `${first.toUpperCase()}${rest}`,
  );
}

function normalizeSortTitle(value: string): string {
  return value.toLowerCase().replace(/^(the|a|an)\s+/i, "").trim();
}

function hashId(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function detectSeasonFolderNumber(segments: string[]): number | null {
  for (const segment of segments) {
    const match = segment.match(/season[\s._-]*(\d{1,2})/i);

    if (match) {
      return Number.parseInt(match[1], 10);
    }
  }

  return null;
}

function namesLikelyMatch(left: string, right: string): boolean {
  return normalizeIdentity(left) === normalizeIdentity(right);
}

function compareFiles(left: LibraryFileRecord, right: LibraryFileRecord): number {
  return left.relativePath.localeCompare(right.relativePath);
}

function compareEpisodes(left: MutableEpisode, right: MutableEpisode): number {
  const leftEpisode = left.episodeNumbers[0] ?? 0;
  const rightEpisode = right.episodeNumbers[0] ?? 0;

  if (leftEpisode !== rightEpisode) {
    return leftEpisode - rightEpisode;
  }

  return left.title.localeCompare(right.title);
}

function describeEpisode(episodeNumbers: number[]): string {
  if (episodeNumbers.length === 0) {
    return "Unknown Episode";
  }

  if (episodeNumbers.length === 1) {
    return `Episode ${episodeNumbers[0]}`;
  }

  return `Episodes ${episodeNumbers.join(", ")}`;
}
