import { AndroidDeviceClient } from "./android-device-client.js";

type VlcRemoteControllerOptions = {
  packageName: string;
  appActivityName: string;
  playbackActivityName: string;
};

type VlcAppLaunchResult = {
  launch: {
    command: string;
    stdout: string;
  };
};

type VlcMediaLaunchResult = {
  mediaUrl: string;
  launch: {
    command: string;
    stdout: string;
  };
};

export class VlcRemoteController {
  constructor(
    private readonly deviceClient: AndroidDeviceClient,
    private readonly options: VlcRemoteControllerOptions,
  ) {}

  async launchApp(): Promise<VlcAppLaunchResult> {
    const launch = await this.deviceClient.runShellCommand(
      [
        "am start",
        "-n",
        quoteShellArg(`${this.options.packageName}/${this.options.appActivityName}`),
      ].join(" "),
    );

    return {
      launch: {
        command: launch.command,
        stdout: launch.stdout,
      },
    };
  }

  async playMediaUrl(
    mediaUrl: string,
    mimeType = "video/mp4",
  ): Promise<VlcMediaLaunchResult> {
    await this.deviceClient.forceStopPackage(this.options.packageName);

    const launch = await this.deviceClient.runShellCommand(
      [
        "am start",
        "-a",
        "'android.intent.action.VIEW'",
        "-d",
        quoteShellArg(mediaUrl),
        "-t",
        quoteShellArg(mimeType),
        "-n",
        quoteShellArg(`${this.options.packageName}/${this.options.playbackActivityName}`),
      ].join(" "),
    );

    return {
      mediaUrl,
      launch: {
        command: launch.command,
        stdout: launch.stdout,
      },
    };
  }
}

function quoteShellArg(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}
