import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import WebTorrent, { type Torrent } from "webtorrent";
import type { TorrentDownloadRecord } from "@media-server/shared";

import { BrowserMediaTranscoder } from "./browser-media-transcoder";
import { MediaLibrary } from "./media-library";

type ManagedTorrent = {
  record: TorrentDownloadRecord;
  torrent: Torrent;
  sessionDir: string;
  progressLogger: NodeJS.Timeout;
};

export class TorrentDownloadService {
  private readonly client = new WebTorrent();
  private readonly downloads = new Map<string, ManagedTorrent>();
  private readonly history = new Map<string, TorrentDownloadRecord>();

  constructor(
    private readonly mediaLibrary: MediaLibrary,
    private readonly incompleteDir: string,
    private readonly browserMediaTranscoder: BrowserMediaTranscoder,
    private readonly onLibraryChanged: () => Promise<void>,
  ) {
    this.client.on("error", (error) => {
      console.error(`WebTorrent client error: ${error.message}`);
    });
  }

  async startDownload(magnetLink: string): Promise<TorrentDownloadRecord> {
    const trimmedMagnetLink = magnetLink.trim();

    if (!trimmedMagnetLink.startsWith("magnet:?")) {
      throw new Error("A valid magnet link is required");
    }

    await this.mediaLibrary.ensureMediaDirectories();
    await fs.mkdir(this.incompleteDir, { recursive: true });

    const id = randomUUID();
    const now = new Date().toISOString();
    const sessionDir = path.join(this.incompleteDir, id);
    await fs.mkdir(sessionDir, { recursive: true });

    const record: TorrentDownloadRecord = {
      id,
      magnetLink: trimmedMagnetLink,
      name: null,
      infoHash: null,
      status: "starting",
      progress: 0,
      downloadedBytes: 0,
      totalBytes: null,
      downloadSpeed: 0,
      processingProgress: null,
      processingDetails: null,
      browserCopyPath: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    };

    const torrent = this.client.add(trimmedMagnetLink, { path: sessionDir });
    const progressLogger = setInterval(() => {
      this.syncRecord(record, torrent);
      console.log(this.formatProgressLog(record));
    }, 2000);

    this.downloads.set(id, { record, torrent, sessionDir, progressLogger });
    this.history.set(id, record);

    torrent.once("ready", () => {
      this.syncRecord(record, torrent);
      record.status = torrent.done ? "completed" : "downloading";
      record.updatedAt = new Date().toISOString();
      console.log(
        `Started torrent ${record.name ?? record.id} (${record.infoHash ?? "pending info hash"})`,
      );
    });

    torrent.on("download", () => {
      this.syncRecord(record, torrent);
      record.status = torrent.done ? "completed" : "downloading";
      record.updatedAt = new Date().toISOString();
    });

    torrent.once("done", async () => {
      clearInterval(progressLogger);

      try {
        this.syncRecord(record, torrent);
        record.status = "processing";
        record.downloadSpeed = 0;
        record.processingProgress = 0;
        record.processingDetails = "Moving downloaded files into the media library.";
        record.updatedAt = new Date().toISOString();
        console.log(`Download complete for ${record.name ?? record.id}. Finalizing files.`);

        const movedFiles = await this.mediaLibrary.moveTorrentFilesIntoLibrary(
          sessionDir,
          torrent.files,
        );
        record.processingDetails = "Stopping torrent session.";
        await this.client.remove(torrent, { destroyStore: true });

        await Promise.all(
          movedFiles.map(async (relativeMediaPath) => {
            const sourcePath = await this.mediaLibrary.resolveExistingFile(relativeMediaPath);

            if (!sourcePath) {
              throw new Error(`Downloaded file missing from library: ${relativeMediaPath}`);
            }

            record.processingDetails = `Transcoding ${relativeMediaPath} for browser playback.`;
            record.browserCopyPath =
              this.browserMediaTranscoder.toBrowserRelativePath(relativeMediaPath);
            await this.browserMediaTranscoder.transcodeFile(
              relativeMediaPath,
              sourcePath,
              (progress) => {
                record.processingProgress = progress;
                record.updatedAt = new Date().toISOString();
              },
            );
          }),
        );

        record.status = "completed";
        record.processingProgress = 1;
        record.processingDetails = "Browser-ready copy completed.";
        record.updatedAt = new Date().toISOString();
        await this.onLibraryChanged();
        console.log(`Completed torrent ${record.name ?? record.id}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to finalize torrent";
        this.markAsError(record, message);
      } finally {
        this.downloads.delete(id);
        await fs.rm(sessionDir, { recursive: true, force: true });
      }
    });

    torrent.on("error", async (error) => {
      this.markAsError(record, error.message);
      clearInterval(progressLogger);
      this.downloads.delete(id);
      await fs.rm(sessionDir, { recursive: true, force: true });
    });

    return record;
  }

  listDownloads(): TorrentDownloadRecord[] {
    return Array.from(this.history.values()).sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  async cancelDownload(id: string): Promise<TorrentDownloadRecord> {
    const managedTorrent = this.downloads.get(id);

    if (!managedTorrent) {
      const previousRecord = this.history.get(id);

      if (previousRecord) {
        return previousRecord;
      }

      throw new Error("Torrent download not found");
    }

    const { record, torrent, sessionDir, progressLogger } = managedTorrent;
    clearInterval(progressLogger);

    await this.client.remove(torrent, { destroyStore: true });
    await fs.rm(sessionDir, { recursive: true, force: true });

    record.status = "cancelled";
    record.downloadSpeed = 0;
    record.updatedAt = new Date().toISOString();

    this.downloads.delete(id);
    console.log(`Cancelled torrent ${record.name ?? record.id}`);

    return record;
  }

  private syncRecord(record: TorrentDownloadRecord, torrent: Torrent): void {
    record.name = torrent.name || record.name;
    record.infoHash = torrent.infoHash || record.infoHash;
    record.progress = torrent.progress || 0;
    record.downloadedBytes = torrent.downloaded || 0;
    record.totalBytes = torrent.length || record.totalBytes;
    record.downloadSpeed = torrent.downloadSpeed || 0;
  }

  private markAsError(record: TorrentDownloadRecord, message: string): void {
    record.status = "error";
    record.errorMessage = message;
    record.downloadSpeed = 0;
    record.processingProgress = null;
    record.processingDetails = null;
    record.updatedAt = new Date().toISOString();
    console.error(`Torrent ${record.name ?? record.id} failed: ${message}`);
  }

  private formatProgressLog(record: TorrentDownloadRecord): string {
    const percent = (record.progress * 100).toFixed(1);
    const downloaded = this.formatBytes(record.downloadedBytes);
    const total = this.formatBytes(record.totalBytes ?? 0);
    const speed = `${this.formatBytes(record.downloadSpeed)}/s`;

    return `Torrent ${record.name ?? record.id}: ${percent}% (${downloaded} / ${total}) at ${speed}`;
  }

  private formatBytes(value: number): string {
    if (value <= 0) {
      return "0 B";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    const unitIndex = Math.min(
      Math.floor(Math.log(value) / Math.log(1024)),
      units.length - 1,
    );
    const normalizedValue = value / 1024 ** unitIndex;
    const digits = normalizedValue >= 10 || unitIndex === 0 ? 0 : 1;
    return `${normalizedValue.toFixed(digits)} ${units[unitIndex]}`;
  }
}
