import type {
  LibraryCatalogSnapshot,
  LibraryCatalogStatus,
  PlaybackProgressRecord,
  PlaybackSource,
} from "./library";

export type ErrorResponse = {
  error: string;
};

export type AdbStatus = {
  host: string;
  port: number;
  serial: string;
  connected: boolean;
  lastError: string | null;
};

export type VlcCommandResult = {
  command: string;
  stdout: string;
};

export type PlayRequestBody = {
  fileId?: string;
  startSeconds?: number;
};

export type PlayResponse = {
  status: "playing";
  fileId: string;
  launch: {
    mediaUrl: string;
    launch: VlcCommandResult;
  };
};

export type LaunchVlcResponse = {
  status: "launched";
  launch: VlcCommandResult;
};

export type SavePlaybackProgressRequestBody = {
  positionSeconds?: number;
  durationSeconds?: number | null;
  source?: PlaybackSource;
};

export type PlaybackHistoryItem = {
  fileId: string;
  title: string;
  subtitle: string | null;
  relativePath: string;
  parsedType: "movie" | "episode" | "other";
  progress: number;
  positionSeconds: number;
  durationSeconds: number | null;
  updatedAt: string;
  completedAt: string | null;
  source: PlaybackSource;
};

export type PlaybackHistoryResponse = {
  continueWatching: PlaybackHistoryItem[];
  recentlyFinished: PlaybackHistoryItem[];
};

export type SavePlaybackProgressResponse = PlaybackProgressRecord;

export type EncodeLibraryFileResponse = {
  status: "queued" | "ready";
  fileId: string;
};

export type UploadLibraryFileResponse = {
  status: "uploaded";
  relativePath: string;
};

export type DeleteLibraryItemResponse = {
  status: "deleted";
  target: "file" | "folder";
};

export type DeleteLibraryFolderRequestBody = {
  relativePath?: string;
};

export type MergeLibraryShowRequestBody = {
  sourceTitle?: string;
  targetTitle?: string;
};

export type RegenerateLibraryTitleRequestBody = {
  kind?: "show" | "movie" | "other";
  currentTitle?: string;
  relativePaths?: string[];
};

export type SaveLibraryTitleOverrideRequestBody = {
  kind?: "show" | "movie" | "other";
  title?: string;
  relativePaths?: string[];
};

export type RegenerateLibraryTitleResponse = {
  suggestedTitle: string;
};

export type CreateTorrentRequestBody = {
  magnetLink?: string;
};

export type TorrentDownloadStatus =
  | "starting"
  | "downloading"
  | "processing"
  | "completed"
  | "cancelled"
  | "error";

export type TorrentDownloadRecord = {
  id: string;
  magnetLink: string;
  name: string | null;
  infoHash: string | null;
  status: TorrentDownloadStatus;
  progress: number;
  downloadedBytes: number;
  totalBytes: number | null;
  downloadSpeed: number;
  processingProgress: number | null;
  processingDetails: string | null;
  browserCopyPath: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LibraryResponse = LibraryCatalogSnapshot;

export type LibraryStatusResponse = LibraryCatalogStatus;
