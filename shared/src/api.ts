import type { LibraryCatalogSnapshot, LibraryCatalogStatus } from "./library";

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
