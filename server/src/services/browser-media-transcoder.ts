import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type TranscodeProgressHandler = (progress: number) => void;

export class BrowserMediaTranscoder {
  constructor(private readonly browserMediaDir: string) {}

  async transcodeFile(
    relativeMediaPath: string,
    sourcePath: string,
    onProgress?: TranscodeProgressHandler,
  ): Promise<string> {
    const outputRelativePath = this.toBrowserRelativePath(relativeMediaPath);
    const outputPath = path.join(this.browserMediaDir, outputRelativePath);
    const temporaryOutputPath = path.join(
      path.dirname(outputPath),
      `${path.parse(outputPath).name}.partial.mp4`,
    );
    const sourceDurationSeconds = await this.readDurationSeconds(sourcePath);

    await mkdir(path.dirname(outputPath), { recursive: true });
    await rm(outputPath, { force: true });
    await rm(temporaryOutputPath, { force: true });

    console.log(`Transcoding ${relativeMediaPath} for browser playback`);

    try {
      await this.runTranscode(
        sourcePath,
        temporaryOutputPath,
        sourceDurationSeconds,
        onProgress,
      );
      await rename(temporaryOutputPath, outputPath);
      onProgress?.(1);
      console.log(`Created browser copy ${outputRelativePath}`);
    } catch (error) {
      await rm(temporaryOutputPath, { force: true });
      throw error;
    }

    return outputRelativePath;
  }

  toBrowserRelativePath(relativeMediaPath: string): string {
    const parsedPath = path.parse(relativeMediaPath);
    return path.join(parsedPath.dir, `${parsedPath.name}.mp4`);
  }

  private async readDurationSeconds(sourcePath: string): Promise<number> {
    const { stdout } = await execFileAsync("/opt/homebrew/bin/ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      sourcePath,
    ]);

    const durationSeconds = Number.parseFloat(stdout.trim());

    if (Number.isNaN(durationSeconds) || durationSeconds <= 0) {
      throw new Error(`Unable to determine media duration for ${sourcePath}`);
    }

    return durationSeconds;
  }

  private runTranscode(
    sourcePath: string,
    outputPath: string,
    sourceDurationSeconds: number,
    onProgress?: TranscodeProgressHandler,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpegProcess = spawn("/opt/homebrew/bin/ffmpeg", [
        "-y",
        "-i",
        sourcePath,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        "-progress",
        "pipe:1",
        "-nostats",
        outputPath,
      ]);

      let stderrOutput = "";
      let stdoutBuffer = "";

      ffmpegProcess.stdout.on("data", (chunk: Buffer | string) => {
        stdoutBuffer += chunk.toString();
        const lines = stdoutBuffer.split("\n");
        stdoutBuffer = lines.pop() ?? "";

        for (const line of lines) {
          const [key, rawValue] = line.trim().split("=");

          if (key !== "out_time_ms" || !rawValue) {
            continue;
          }

          const encodedMicroseconds = Number.parseInt(rawValue, 10);

          if (Number.isNaN(encodedMicroseconds) || encodedMicroseconds < 0) {
            continue;
          }

          const progress = Math.min(
            encodedMicroseconds / (sourceDurationSeconds * 1_000_000),
            0.99,
          );
          onProgress?.(progress);
        }
      });

      ffmpegProcess.stderr.on("data", (chunk: Buffer | string) => {
        stderrOutput += chunk.toString();
      });

      ffmpegProcess.once("error", (error) => {
        reject(error);
      });

      ffmpegProcess.once("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(stderrOutput.trim() || `ffmpeg exited with code ${code}`));
      });
    });
  }
}
