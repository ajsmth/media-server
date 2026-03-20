import { promises as fs } from "node:fs";
import path from "node:path";

const SUPPORTED_EXTENSIONS = new Set([".mp4", ".mkv"]);
const HIDDEN_DIRECTORIES = new Set([".incomplete", "browser"]);

type TorrentFileDescriptor = {
  name: string;
  path: string;
};

export class MediaLibrary {
  constructor(private readonly mediaDir: string) { }

  async listPlayableFiles(): Promise<string[]> {
    const files = await this.collectPlayableFiles(this.mediaDir);

    return files.sort((left, right) => left.localeCompare(right));
  }

  async resolveExistingFile(fileName: string): Promise<string | null> {
    const fullPath = path.resolve(this.mediaDir, fileName);

    if (!this.isInsideMediaDirectory(fullPath)) {
      return null;
    }

    try {
      await fs.access(fullPath);
      return fullPath;
    } catch {
      return null;
    }
  }

  async resolveExistingFileByBaseName(baseName: string): Promise<string | null> {
    const playableFiles = await this.listPlayableFiles();
    const matches = playableFiles.filter(
      (file) => path.basename(file) === baseName,
    );

    if (matches.length === 0) {
      return null;
    }

    if (matches.length > 1) {
      throw new Error(`Multiple media files share the name ${baseName}`);
    }

    return this.resolveExistingFile(matches[0]);
  }

  async ensureMediaDirectories(): Promise<void> {
    await fs.mkdir(this.mediaDir, { recursive: true });
  }

  toPublicMediaPath(fileName: string): string {
    return fileName.split(path.sep).map(encodeURIComponent).join("/");
  }

  async moveTorrentFilesIntoLibrary(
    sourceDir: string,
    files: TorrentFileDescriptor[],
  ): Promise<string[]> {
    await this.ensureMediaDirectories();

    const playableFiles = files.filter((file) =>
      SUPPORTED_EXTENSIONS.has(path.extname(file.name).toLowerCase()),
    );

    if (playableFiles.length === 0) {
      throw new Error("Torrent did not contain a supported media file");
    }

    const movedFiles: string[] = [];

    for (const file of playableFiles) {
      const sourcePath = path.join(sourceDir, file.path);
      const relativeMediaPath = file.path;
      const destinationPath = path.join(this.mediaDir, relativeMediaPath);

      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
      await fs.rm(destinationPath, { force: true });
      await fs.rename(sourcePath, destinationPath);
      movedFiles.push(relativeMediaPath);
    }

    return movedFiles;
  }

  browserMediaPathFor(fileName: string): string {
    const parsedPath = path.parse(fileName);
    const browserRelativePath = path.join("browser", parsedPath.dir, `${parsedPath.name}.mp4`);
    return browserRelativePath.split(path.sep).join("/");
  }

  private async collectPlayableFiles(directory: string): Promise<string[]> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          if (HIDDEN_DIRECTORIES.has(entry.name)) {
            return [];
          }

          return this.collectPlayableFiles(entryPath);
        }

        if (
          entry.isFile() &&
          SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
        ) {
          return [path.relative(this.mediaDir, entryPath)];
        }

        return [];
      }),
    );

    return files.flat();
  }

  private isInsideMediaDirectory(candidatePath: string): boolean {
    const relativePath = path.relative(this.mediaDir, candidatePath);

    return (
      relativePath !== "" &&
      !relativePath.startsWith("..") &&
      !path.isAbsolute(relativePath)
    );
  }
}
