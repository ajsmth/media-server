import { promises as fs } from "node:fs";
import path from "node:path";
import parseVideoName from "video-name-parser";

const SUPPORTED_EXTENSIONS = new Set([".mp4", ".mkv"]);
const HIDDEN_DIRECTORIES = new Set([".incomplete", "browser", ".index"]);

type TorrentFileDescriptor = {
  name: string;
  path: string;
};

export type PlayableFileEntry = {
  relativePath: string;
  absolutePath: string;
  baseName: string;
  extension: string;
  sizeBytes: number;
  modifiedAt: string;
  modifiedAtMs: number;
};

export class MediaLibrary {
  constructor(private readonly mediaDir: string) { }

  async listPlayableFiles(): Promise<string[]> {
    const files = await this.listPlayableFileEntries();

    return files.map((file) => file.relativePath);
  }

  async listPlayableFileEntries(): Promise<PlayableFileEntry[]> {
    const files = await this.collectPlayableFiles(this.mediaDir);

    return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
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

  resolveUploadDestination(originalFileName: string): {
    absolutePath: string;
    relativePath: string;
  } {
    const baseName = path.basename(originalFileName).trim();

    if (!baseName) {
      throw new Error("File name is required");
    }

    const relativePath = this.suggestUploadRelativePath(baseName);
    const absolutePath = path.resolve(this.mediaDir, relativePath);

    if (!this.isInsideMediaDirectory(absolutePath)) {
      throw new Error("Upload destination must remain inside the media directory");
    }

    return {
      absolutePath,
      relativePath: relativePath.split(path.sep).join("/"),
    };
  }

  async deleteFile(relativePath: string): Promise<void> {
    const absolutePath = path.resolve(this.mediaDir, relativePath);

    if (!this.isInsideMediaDirectory(absolutePath)) {
      throw new Error("File path must remain inside the media directory");
    }

    await fs.rm(absolutePath, { force: true });
    await fs.rm(path.join(this.mediaDir, this.browserMediaPathFor(relativePath)), {
      force: true,
    });
    await this.removeEmptyParentDirectories(path.dirname(absolutePath));
  }

  async deleteDirectory(relativeDirectoryPath: string): Promise<void> {
    const normalizedPath = relativeDirectoryPath.split("/").join(path.sep);
    const absolutePath = path.resolve(this.mediaDir, normalizedPath);

    if (!this.isInsideMediaDirectory(absolutePath)) {
      throw new Error("Folder path must remain inside the media directory");
    }

    await fs.rm(absolutePath, { recursive: true, force: true });

    const browserDirectoryPath = path.join(
      this.mediaDir,
      "browser",
      normalizedPath,
    );
    await fs.rm(browserDirectoryPath, { recursive: true, force: true });
    await this.removeEmptyParentDirectories(path.dirname(absolutePath));
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
      const destination = this.resolveUploadDestination(file.name);
      const relativeMediaPath = destination.relativePath;
      const destinationPath = destination.absolutePath;

      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
      await fs.rm(destinationPath, { force: true });
      await this.moveFile(sourcePath, destinationPath);
      movedFiles.push(relativeMediaPath);
    }

    return movedFiles;
  }

  async organizeMisplacedFiles(): Promise<string[]> {
    await this.ensureMediaDirectories();

    const entries = await this.listPlayableFileEntries();
    const movedFiles: string[] = [];

    for (const entry of entries) {
      const normalizedPath = entry.relativePath.split("\\").join("/");
      const topLevelDirectory = normalizedPath.split("/")[0];

      if (topLevelDirectory === "Movies" || topLevelDirectory === "Shows") {
        continue;
      }

      const destination = this.resolveUploadDestination(entry.baseName);

      if (destination.relativePath === normalizedPath) {
        continue;
      }

      try {
        await fs.mkdir(path.dirname(destination.absolutePath), { recursive: true });
        await fs.rm(destination.absolutePath, { force: true });
        await this.moveFile(entry.absolutePath, destination.absolutePath);
        await this.moveBrowserCopy(normalizedPath, destination.relativePath);
        await this.removeEmptyParentDirectories(path.dirname(entry.absolutePath));
        movedFiles.push(destination.relativePath);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;

        if (code === "EPERM") {
          console.warn(
            `[library-organize] skipped "${normalizedPath}" because the filesystem denied the move. On macOS this is often an immutable file flag such as uchg.`,
          );
          continue;
        }

        throw error;
      }
    }

    return movedFiles;
  }

  browserMediaPathFor(fileName: string): string {
    const parsedPath = path.parse(fileName);
    const browserRelativePath = path.join("browser", parsedPath.dir, `${parsedPath.name}.mp4`);
    return browserRelativePath.split(path.sep).join("/");
  }

  async hasBrowserMediaFor(fileName: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.mediaDir, this.browserMediaPathFor(fileName)));
      return true;
    } catch {
      return false;
    }
  }

  private suggestUploadRelativePath(fileName: string): string {
    const parsedPath = path.parse(fileName);
    const parsed = parseVideoName(parsedPath.name);

    if (
      parsed.type === "series" &&
      typeof parsed.season === "number" &&
      parsed.name
    ) {
      const showDirectory = sanitizePathSegment(humanizeTitle(parsed.name));
      const seasonDirectory = `Season ${String(parsed.season).padStart(2, "0")}`;

      return path.join("Shows", showDirectory, seasonDirectory, fileName);
    }

    if (parsed.type === "movie" && parsed.name) {
      const title = humanizeTitle(parsed.name);
      const movieDirectory = sanitizePathSegment(
        parsed.year ? `${title} (${parsed.year})` : title,
      );

      return path.join("Movies", movieDirectory, fileName);
    }

    return fileName;
  }

  private async moveBrowserCopy(
    fromRelativePath: string,
    toRelativePath: string,
  ): Promise<void> {
    const existingBrowserPath = path.join(
      this.mediaDir,
      this.browserMediaPathFor(fromRelativePath),
    );
    const nextBrowserPath = path.join(
      this.mediaDir,
      this.browserMediaPathFor(toRelativePath),
    );

    try {
      await fs.access(existingBrowserPath);
    } catch {
      return;
    }

    await fs.mkdir(path.dirname(nextBrowserPath), { recursive: true });
    await fs.rm(nextBrowserPath, { force: true });
    await this.moveFile(existingBrowserPath, nextBrowserPath);
    await this.removeEmptyParentDirectories(path.dirname(existingBrowserPath));
  }

  private async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      await fs.rename(sourcePath, destinationPath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code !== "EXDEV" && code !== "EPERM") {
        throw error;
      }

      await fs.copyFile(sourcePath, destinationPath);
      await fs.unlink(sourcePath);
    }
  }

  private async collectPlayableFiles(directory: string): Promise<PlayableFileEntry[]> {
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
          const stats = await fs.stat(entryPath);
          return [{
            relativePath: path.relative(this.mediaDir, entryPath),
            absolutePath: entryPath,
            baseName: path.basename(entryPath),
            extension: path.extname(entry.name).toLowerCase(),
            sizeBytes: stats.size,
            modifiedAt: stats.mtime.toISOString(),
            modifiedAtMs: stats.mtimeMs,
          }];
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

  private async removeEmptyParentDirectories(directoryPath: string): Promise<void> {
    let currentPath = directoryPath;

    while (currentPath !== this.mediaDir && this.isInsideMediaDirectory(currentPath)) {
      try {
        const entries = await fs.readdir(currentPath);

        if (entries.length > 0) {
          return;
        }

        await fs.rmdir(currentPath);
        currentPath = path.dirname(currentPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          currentPath = path.dirname(currentPath);
          continue;
        }

        throw error;
      }
    }
  }
}

function humanizeTitle(value: string): string {
  const normalized = value
    .replace(/[._]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const lowerCased = normalized.toLowerCase();

  return lowerCased.replace(/\b([a-z0-9])([a-z0-9']*)/g, (_match, first, rest) =>
    `${first.toUpperCase()}${rest}`,
  );
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim() || "Untitled";
}
