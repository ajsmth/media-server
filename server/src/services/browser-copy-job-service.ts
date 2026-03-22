import type { BrowserCopyStatus } from "@media-server/shared";

import { BrowserMediaTranscoder } from "./browser-media-transcoder";

type BrowserCopyEncodingStatus = {
  state: BrowserCopyStatus;
  progress: number | null;
  details: string | null;
};

type BrowserCopyJob = {
  relativePath: string;
  sourcePath: string;
};

export class BrowserCopyJobService {
  private readonly queue: BrowserCopyJob[] = [];
  private readonly statuses = new Map<string, BrowserCopyEncodingStatus>();
  private readonly progressLogBuckets = new Map<string, number>();
  private isProcessing = false;

  constructor(
    private readonly browserMediaTranscoder: BrowserMediaTranscoder,
    private readonly onLibraryChanged: () => Promise<void>,
  ) {}

  enqueue(relativePath: string, sourcePath: string): BrowserCopyEncodingStatus {
    const existingStatus = this.statuses.get(relativePath);

    if (existingStatus) {
      console.log(`[browser-copy] already queued: ${relativePath}`);
      return existingStatus;
    }

    const status: BrowserCopyEncodingStatus = {
      state: "queued",
      progress: null,
      details: "Queued for browser encoding.",
    };

    this.statuses.set(relativePath, status);
    this.queue.push({ relativePath, sourcePath });
    console.log(
      `[browser-copy] queued ${relativePath} (${this.queue.length} waiting)`,
    );
    this.processQueue();
    return status;
  }

  getStatus(relativePath: string): BrowserCopyEncodingStatus | null {
    return this.statuses.get(relativePath) ?? null;
  }

  private processQueue(): void {
    if (this.isProcessing) {
      return;
    }

    const nextJob = this.queue.shift();

    if (!nextJob) {
      return;
    }

    this.isProcessing = true;
    this.progressLogBuckets.set(nextJob.relativePath, -1);
    const status = this.statuses.get(nextJob.relativePath);

    if (status) {
      status.state = "processing";
      status.details = `Encoding ${nextJob.relativePath} for browser playback.`;
      status.progress = 0;
    }
    console.log(
      `[browser-copy] started ${nextJob.relativePath} (${this.queue.length} remaining)`,
    );

    void this.browserMediaTranscoder
      .transcodeFile(
        nextJob.relativePath,
        nextJob.sourcePath,
        (progress) => {
          const currentStatus = this.statuses.get(nextJob.relativePath);

          if (!currentStatus) {
            return;
          }

          currentStatus.progress = progress;
          currentStatus.details = `Encoding ${nextJob.relativePath} for browser playback.`;
          const progressBucket = Math.floor(progress * 10);
          const previousBucket =
            this.progressLogBuckets.get(nextJob.relativePath) ?? -1;

          if (progressBucket > previousBucket) {
            this.progressLogBuckets.set(nextJob.relativePath, progressBucket);
            console.log(
              `[browser-copy] ${nextJob.relativePath} ${Math.round(progress * 100)}%`,
            );
          }
        },
      )
      .then(async () => {
        this.statuses.delete(nextJob.relativePath);
        this.progressLogBuckets.delete(nextJob.relativePath);
        console.log(`[browser-copy] completed ${nextJob.relativePath}`);
        await this.onLibraryChanged();
      })
      .catch((error) => {
        const currentStatus = this.statuses.get(nextJob.relativePath);
        this.progressLogBuckets.delete(nextJob.relativePath);

        if (currentStatus) {
          currentStatus.progress = null;
          currentStatus.details =
            error instanceof Error ? error.message : "Encoding failed";
        }
        console.error(
          `[browser-copy] failed ${nextJob.relativePath}: ${
            error instanceof Error ? error.message : "Encoding failed"
          }`,
        );
      })
      .finally(() => {
        this.isProcessing = false;
        this.processQueue();
      });
  }
}
