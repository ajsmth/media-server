import type { FileProcessingStatusSnapshot } from "./file-processing-status-provider";
import { BrowserMediaTranscoder } from "./browser-media-transcoder";

type TranscoderQueueJob = {
  relativePath: string;
  sourcePath: string;
};

export class TranscoderQueueService {
  private readonly queue: TranscoderQueueJob[] = [];
  private readonly statuses = new Map<string, FileProcessingStatusSnapshot>();
  private readonly progressLogBuckets = new Map<string, number>();
  private isProcessing = false;

  constructor(
    private readonly browserMediaTranscoder: BrowserMediaTranscoder,
    private readonly onLibraryChanged: () => Promise<void>,
  ) {}

  enqueue(relativePath: string, sourcePath: string): FileProcessingStatusSnapshot {
    const existingStatus = this.statuses.get(relativePath);

    if (existingStatus) {
      console.log(`[transcoder-queue] already queued: ${relativePath}`);
      return existingStatus;
    }

    const status: FileProcessingStatusSnapshot = {
      state: "queued",
      progress: null,
      details: "Queued for browser encoding.",
    };

    this.statuses.set(relativePath, status);
    this.queue.push({ relativePath, sourcePath });
    console.log(
      `[transcoder-queue] queued ${relativePath} (${this.queue.length} waiting)`,
    );
    this.processQueue();
    return status;
  }

  getStatus(relativePath: string): FileProcessingStatusSnapshot | null {
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
      `[transcoder-queue] started ${nextJob.relativePath} (${this.queue.length} remaining)`,
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
              `[transcoder-queue] ${nextJob.relativePath} ${Math.round(progress * 100)}%`,
            );
          }
        },
      )
      .then(async () => {
        this.statuses.delete(nextJob.relativePath);
        this.progressLogBuckets.delete(nextJob.relativePath);
        console.log(`[transcoder-queue] completed ${nextJob.relativePath}`);
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
          `[transcoder-queue] failed ${nextJob.relativePath}: ${
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
