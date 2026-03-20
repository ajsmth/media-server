import { AndroidDeviceClient } from "./android-device-client.js";

type VlcRemoteControllerOptions = {
  packageName: string;
  activityName: string;
};

export class VlcRemoteController {
  constructor(
    private readonly deviceClient: AndroidDeviceClient,
    private readonly options: VlcRemoteControllerOptions,
  ) {}

  async playMediaUrl(mediaUrl: string, mimeType = "video/mp4"): Promise<void> {
    await this.deviceClient.forceStopPackage(this.options.packageName);

    await this.deviceClient.launchActivity({
      action: "android.intent.action.VIEW",
      dataUrl: mediaUrl,
      mimeType,
      componentName: `${this.options.packageName}/${this.options.activityName}`,
    });
  }
}
