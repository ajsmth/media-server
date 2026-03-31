import { promises as fs } from "node:fs";
import path from "node:path";

type PersistedOverrides = {
  merges?: Record<string, string>;
};

export class ShowGroupingOverrideService {
  private merges = new Map<string, string>();

  constructor(private readonly filePath: string) {}

  async initialize(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as PersistedOverrides;

      this.merges = new Map(
        Object.entries(parsed.merges ?? {}).map(([source, target]) => [
          normalizeIdentity(source),
          target,
        ]),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn("Unable to load show grouping overrides:", error);
      }
    }
  }

  resolve(title: string): { title: string; normalizedTitle: string } {
    const normalizedTitle = normalizeIdentity(title);
    const resolvedTitle = this.resolveTargetTitle(normalizedTitle) ?? title;

    return {
      title: resolvedTitle,
      normalizedTitle: normalizeIdentity(resolvedTitle),
    };
  }

  async merge(sourceTitle: string, targetTitle: string): Promise<void> {
    const sourceKey = normalizeIdentity(sourceTitle);
    const targetValue = humanizeTitle(targetTitle);
    const targetKey = normalizeIdentity(targetValue);

    if (!sourceKey || !targetKey) {
      throw new Error("Source and target show titles are required");
    }

    if (sourceKey === targetKey) {
      return;
    }

    this.merges.set(sourceKey, targetValue);

    for (const [key, value] of this.merges.entries()) {
      if (normalizeIdentity(value) === sourceKey) {
        this.merges.set(key, targetValue);
      }
    }

    await this.persist();
  }

  private resolveTargetTitle(sourceKey: string): string | null {
    let currentKey = sourceKey;
    const visited = new Set<string>();

    while (!visited.has(currentKey)) {
      visited.add(currentKey);
      const nextTitle = this.merges.get(currentKey);

      if (!nextTitle) {
        return null;
      }

      const nextKey = normalizeIdentity(nextTitle);

      if (nextKey === currentKey) {
        return nextTitle;
      }

      currentKey = nextKey;
    }

    return this.merges.get(sourceKey) ?? null;
  }

  private async persist(): Promise<void> {
    const payload: PersistedOverrides = {
      merges: Object.fromEntries(
        Array.from(this.merges.entries()).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    };

    await fs.writeFile(this.filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
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
