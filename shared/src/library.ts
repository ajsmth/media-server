export type ParsedMediaType = "movie" | "episode" | "other";

export type ParsedMediaConfidence = "high" | "medium" | "low";

export type ParsedMediaDetails = {
  rawName: string;
  title: string;
  normalizedTitle: string;
  type: ParsedMediaType;
  year: number | null;
  seasonNumber: number | null;
  episodeNumbers: number[];
  tags: string[];
  confidence: ParsedMediaConfidence;
};

export type LibraryFileRecord = {
  id: string;
  relativePath: string;
  basename: string;
  sizeBytes: number;
  modifiedAt: string;
  sourceUrl: string;
  browserUrl: string | null;
  browserCopyReady: boolean;
  parsed: ParsedMediaDetails;
};

export type LibraryMovieRecord = {
  id: string;
  title: string;
  sortTitle: string;
  year: number | null;
  files: LibraryFileRecord[];
};

export type LibraryEpisodeRecord = {
  id: string;
  title: string;
  seasonNumber: number;
  episodeNumbers: number[];
  files: LibraryFileRecord[];
};

export type LibrarySeasonRecord = {
  id: string;
  seasonNumber: number;
  episodes: LibraryEpisodeRecord[];
};

export type LibraryShowRecord = {
  id: string;
  title: string;
  sortTitle: string;
  seasons: LibrarySeasonRecord[];
};

export type LibraryOtherVideoRecord = {
  id: string;
  title: string;
  files: LibraryFileRecord[];
};

export type LibraryCatalogSnapshot = {
  generatedAt: string;
  lastScanAt: string | null;
  movies: LibraryMovieRecord[];
  shows: LibraryShowRecord[];
  otherVideos: LibraryOtherVideoRecord[];
};

export type LibraryCatalogStatus = {
  state: "idle" | "scanning" | "error";
  lastScanAt: string | null;
  lastError: string | null;
  watchEnabled: boolean;
};
