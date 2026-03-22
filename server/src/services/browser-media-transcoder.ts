import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type TranscodeProgressHandler = (progress: number) => void;

type ProbeStream = {
  codec_name?: string;
  codec_type?: string;
  profile?: string;
};

type ProbeFormat = {
  duration?: string;
};

type ProbeResult = {
  format?: ProbeFormat;
  streams?: ProbeStream[];
};

type BrowserEncodeStrategy = "remux" | "audio-only" | "full";

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
    const probeResult = await this.readProbeResult(sourcePath);
    const sourceDurationSeconds = this.readDurationSeconds(sourcePath, probeResult);
    const strategy = this.chooseStrategy(probeResult);

    await mkdir(path.dirname(outputPath), { recursive: true });
    await rm(outputPath, { force: true });
    await rm(temporaryOutputPath, { force: true });

    console.log(
      `Preparing ${relativeMediaPath} for browser playback via ${strategy}`,
    );

    try {
      await this.runTranscode(
        sourcePath,
        temporaryOutputPath,
        sourceDurationSeconds,
        strategy,
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

  private async readProbeResult(sourcePath: string): Promise<ProbeResult> {
    const { stdout } = await execFileAsync("/opt/homebrew/bin/ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type,codec_name,profile",
      "-of",
      "json",
      sourcePath,
    ]);

    return JSON.parse(stdout) as ProbeResult;
  }

  private readDurationSeconds(
    sourcePath: string,
    probeResult: ProbeResult,
  ): Promise<number> | number {
    const durationSeconds = Number.parseFloat(probeResult.format?.duration ?? "");

    if (!Number.isNaN(durationSeconds) && durationSeconds > 0) {
      return durationSeconds;
    }

    return this.readDurationSecondsFallback(sourcePath);
  }

  private async readDurationSecondsFallback(sourcePath: string): Promise<number> {
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

  private chooseStrategy(probeResult: ProbeResult): BrowserEncodeStrategy {
    const videoStream = probeResult.streams?.find(
      (stream) => stream.codec_type === "video",
    );
    const audioStream = probeResult.streams?.find(
      (stream) => stream.codec_type === "audio",
    );

    const videoCodec = videoStream?.codec_name?.toLowerCase() ?? "";
    const videoProfile = videoStream?.profile?.toLowerCase() ?? "";
    const audioCodec = audioStream?.codec_name?.toLowerCase() ?? "";
    const videoIsSafariSafe =
      videoCodec === "h264" &&
      !videoProfile.includes("high 10") &&
      !videoProfile.includes("4:2:2") &&
      !videoProfile.includes("4:4:4");
    const audioIsSafariSafe = !audioStream || audioCodec === "aac";

    if (videoIsSafariSafe && audioIsSafariSafe) {
      return "remux";
    }

    if (videoIsSafariSafe) {
      return "audio-only";
    }

    return "full";
  }

  private runTranscode(
    sourcePath: string,
    outputPath: string,
    sourceDurationSeconds: number | Promise<number>,
    strategy: BrowserEncodeStrategy,
    onProgress?: TranscodeProgressHandler,
  ): Promise<void> {
    return Promise.resolve(sourceDurationSeconds).then((resolvedDurationSeconds) =>
      new Promise((resolve, reject) => {
        const strategyArgs =
          strategy === "remux"
            ? ["-c", "copy"]
            : strategy === "audio-only"
              ? [
                  "-c:v",
                  "copy",
                  "-c:a",
                  "aac",
                  "-ac",
                  "2",
                  "-ar",
                  "48000",
                  "-b:a",
                  "192k",
                ]
              : [
                  "-c:v",
                  "libx264",
                  "-preset",
                  "veryfast",
                  "-crf",
                  "23",
                  "-profile:v",
                  "high",
                  "-level",
                  "4.1",
                  "-c:a",
                  "aac",
                  "-ac",
                  "2",
                  "-ar",
                  "48000",
                  "-b:a",
                  "192k",
                ];

        const ffmpegArgs = [
          "-y",
          "-i",
          sourcePath,
          "-map",
          "0:v:0",
          "-map",
          "0:a:0?",
          ...strategyArgs,
          "-movflags",
          "+faststart",
          "-progress",
          "pipe:1",
          "-nostats",
          outputPath,
        ];

        const ffmpegProcess = spawn("/opt/homebrew/bin/ffmpeg", ffmpegArgs);

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
              encodedMicroseconds / (resolvedDurationSeconds * 1_000_000),
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
      }),
    );
  }
}
