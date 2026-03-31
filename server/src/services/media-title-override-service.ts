import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

type PersistedOverrides = {
  overrides?: Record<string, string>;
};

type MediaTitleOverrideKind = "show" | "movie" | "other";

export class MediaTitleOverrideService {
  private overrides = new Map<string, string>();

  constructor(private readonly filePath: string) {}

  async initialize(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as PersistedOverrides;
      this.overrides = new Map(Object.entries(parsed.overrides ?? {}));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn("Unable to load media title overrides:", error);
      }
    }
  }

  resolve(kind: MediaTitleOverrideKind, relativePaths: string[]): string | null {
    return this.overrides.get(this.buildKey(kind, relativePaths)) ?? null;
  }

  async save(kind: MediaTitleOverrideKind, relativePaths: string[], title: string): Promise<void> {
    const normalizedTitle = title.trim();

    if (!normalizedTitle) {
      throw new Error("A title is required");
    }

    this.overrides.set(this.buildKey(kind, relativePaths), normalizedTitle);
    await this.persist();
  }

  private buildKey(kind: MediaTitleOverrideKind, relativePaths: string[]): string {
    const normalizedPaths = relativePaths
      .map((value) => value.split("\\").join("/"))
      .sort((left, right) => left.localeCompare(right));
    const commonDirectory = findCommonDirectory(normalizedPaths);
    const stableSource = commonDirectory || normalizedPaths.join("|");

    return `${kind}:${createHash("sha1").update(stableSource).digest("hex").slice(0, 12)}`;
  }

  private async persist(): Promise<void> {
    const payload: PersistedOverrides = {
      overrides: Object.fromEntries(
        Array.from(this.overrides.entries()).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    };

    await fs.writeFile(this.filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }
}

function findCommonDirectory(relativePaths: string[]): string | null {
  if (relativePaths.length === 0) {
    return null;
  }

  const directories = relativePaths.map((relativePath) =>
    relativePath.split("/").slice(0, -1),
  );
  const shared = [...directories[0]];

  for (const directory of directories.slice(1)) {
    while (
      shared.length > 0 &&
      shared.some((segment, index) => directory[index] !== segment)
    ) {
      shared.pop();
    }
  }

  return shared.length > 0 ? shared.join("/") : null;
}
