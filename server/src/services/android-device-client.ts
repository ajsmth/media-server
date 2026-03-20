import { createClient, Utils } from "@u4/adbkit";

type AndroidDeviceClientOptions = {
  host: string;
  port: number;
};

type ShellResult = {
  stdout: string;
  stderr: string;
};

export type AndroidConnectionStatus = {
  host: string;
  port: number;
  serial: string;
  connected: boolean;
  lastError: string | null;
};

export class AndroidDeviceClient {
  private readonly adbClient = createClient();
  private lastConnectionError: string | null = null;

  constructor(private readonly options: AndroidDeviceClientOptions) {}

  async connect(): Promise<void> {
    try {
      await this.adbClient.connect(this.options.host, this.options.port);
      this.lastConnectionError = null;
    } catch (error) {
      this.lastConnectionError =
        error instanceof Error ? error.message : "Unable to connect to Android device";
      throw error;
    }
  }

  async getStatus(): Promise<AndroidConnectionStatus> {
    try {
      const devices = await this.adbClient.listDevices();
      const serial = this.getDeviceSerial();
      const connected = devices.some((device) => device.id === serial);

      if (connected) {
        this.lastConnectionError = null;
      }

      return {
        host: this.options.host,
        port: this.options.port,
        serial,
        connected,
        lastError: this.lastConnectionError,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to query Android device status";
      this.lastConnectionError = message;

      return {
        host: this.options.host,
        port: this.options.port,
        serial: this.getDeviceSerial(),
        connected: false,
        lastError: message,
      };
    }
  }

  async forceStopPackage(packageName: string): Promise<void> {
    await this.runShellCommand(`am force-stop ${quoteShellArg(packageName)}`);
  }

  async launchActivity(input: {
    action: string;
    dataUrl: string;
    mimeType: string;
    componentName: string;
  }): Promise<void> {
    await this.runShellCommand(
      [
        "am start",
        "-a",
        quoteShellArg(input.action),
        "-d",
        quoteShellArg(input.dataUrl),
        "-t",
        quoteShellArg(input.mimeType),
        "-n",
        quoteShellArg(input.componentName),
      ].join(" "),
    );
  }

  async runShellCommand(command: string): Promise<ShellResult> {
    await this.connect();
    const deviceClient = this.adbClient.getDevice(this.getDeviceSerial());
    const stream = await deviceClient.shell(command);
    const output = await Utils.readAll(stream);
    const stdout = output.toString().trim();

    return {
      stdout,
      stderr: "",
    };
  }

  private getDeviceSerial(): string {
    if (this.options.host.includes(":")) {
      return this.options.host;
    }

    return `${this.options.host}:${this.options.port}`;
  }
}

function quoteShellArg(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}
