import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  PlaybackProgressRecord,
  PlaybackSource,
} from "@media-server/shared";

type PersistedPlaybackState = Record<string, PlaybackProgressRecord>;

type SavePlaybackProgressInput = {
  relativePath: string;
  positionSeconds: number;
  durationSeconds: number | null;
  source: PlaybackSource;
};

const COMPLETED_PROGRESS_THRESHOLD = 0.9;
const COMPLETED_REMAINING_SECONDS_THRESHOLD = 5 * 60;

export class PlaybackProgressService {
  private records = new Map<string, PlaybackProgressRecord>();
  private persistPromise: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async initialize(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as PersistedPlaybackState;
      this.records = new Map(Object.entries(parsed));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn("Unable to load playback progress state:", error);
      }
    }
  }

  get(relativePath: string): PlaybackProgressRecord | null {
    return this.records.get(relativePath) ?? null;
  }

  list(): Array<[string, PlaybackProgressRecord]> {
    return Array.from(this.records.entries());
  }

  async save(input: SavePlaybackProgressInput): Promise<PlaybackProgressRecord> {
    const durationSeconds = normalizeDurationSeconds(input.durationSeconds);
    const positionSeconds = normalizePositionSeconds(
      input.positionSeconds,
      durationSeconds,
    );
    const progress = durationSeconds && durationSeconds > 0
      ? Math.min(positionSeconds / durationSeconds, 1)
      : 0;
    const completed = isConsideredComplete(positionSeconds, durationSeconds);
    const now = new Date().toISOString();
    const nextRecord: PlaybackProgressRecord = {
      positionSeconds: completed && durationSeconds !== null
        ? durationSeconds
        : positionSeconds,
      durationSeconds,
      progress: completed ? 1 : progress,
      completed,
      updatedAt: now,
      completedAt: completed ? now : null,
      source: input.source,
    };

    this.records.set(input.relativePath, nextRecord);
    await this.persist();
    return nextRecord;
  }

  private async persist(): Promise<void> {
    this.persistPromise = this.persistPromise.then(async () => {
      const payload = Object.fromEntries(this.records);
      await fs.writeFile(
        this.filePath,
        `${JSON.stringify(payload, null, 2)}\n`,
        "utf8",
      );
    });

    return this.persistPromise;
  }
}

function normalizeDurationSeconds(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function normalizePositionSeconds(
  value: number,
  durationSeconds: number | null,
): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  if (durationSeconds === null) {
    return value;
  }

  return Math.min(value, durationSeconds);
}

function isConsideredComplete(
  positionSeconds: number,
  durationSeconds: number | null,
): boolean {
  if (durationSeconds === null || durationSeconds <= 0) {
    return false;
  }

  const remainingSeconds = durationSeconds - positionSeconds;
  const progress = positionSeconds / durationSeconds;

  return (
    progress >= COMPLETED_PROGRESS_THRESHOLD ||
    remainingSeconds <= COMPLETED_REMAINING_SECONDS_THRESHOLD
  );
}
