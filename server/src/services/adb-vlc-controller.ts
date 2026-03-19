import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type AdbConnectionOptions = {
  nebulaIp: string;
  adbPort: number;
  vlcPackage: string;
  vlcActivity: string;
};

export class AdbVlcController {
  constructor(private readonly options: AdbConnectionOptions) {}

  async playMediaUrl(mediaUrl: string, mimeType = "video/mp4"): Promise<void> {
    await this.connectToDevice();
    await this.forceStopVlc();
    await this.launchVlc(mediaUrl, mimeType);
  }

  private async connectToDevice(): Promise<void> {
    await this.runAdbCommand([
      "connect",
      `${this.options.nebulaIp}:${this.options.adbPort}`,
    ]);
  }

  private async forceStopVlc(): Promise<void> {
    await this.runAdbCommand([
      "shell",
      "am",
      "force-stop",
      this.options.vlcPackage,
    ]);
  }

  private async launchVlc(mediaUrl: string, mimeType: string): Promise<void> {
    await this.runAdbCommand([
      "shell",
      "am",
      "start",
      "-a",
      "android.intent.action.VIEW",
      "-d",
      mediaUrl,
      "-t",
      mimeType,
      "-n",
      `${this.options.vlcPackage}/${this.options.vlcActivity}`,
    ]);
  }

  private async runAdbCommand(args: string[]): Promise<void> {
    try {
      const { stdout, stderr } = await execFileAsync("adb", args);

      if (stdout.trim()) {
        console.log(stdout.trim());
      }

      if (stderr.trim()) {
        console.error(stderr.trim());
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown ADB error";
      throw new Error(`ADB command failed (${args.join(" ")}): ${message}`);
    }
  }
}
