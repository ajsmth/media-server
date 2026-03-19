import { promises as fs } from "node:fs";
import path from "node:path";

const SUPPORTED_EXTENSIONS = new Set([".mp4", ".mkv"]);

export class MediaLibrary {
  constructor(private readonly mediaDir: string) {}

  async listPlayableFiles(): Promise<string[]> {
    const entries = await fs.readdir(this.mediaDir, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((fileName) =>
        SUPPORTED_EXTENSIONS.has(path.extname(fileName).toLowerCase()),
      )
      .sort((left, right) => left.localeCompare(right));
  }

  async resolveExistingFile(fileName: string): Promise<string | null> {
    const fullPath = path.join(this.mediaDir, fileName);

    try {
      await fs.access(fullPath);
      return fullPath;
    } catch {
      return null;
    }
  }
}
