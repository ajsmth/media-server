import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const config = {
  projectRoot,
  mediaDir: path.join(projectRoot, "media"),
  libraryIndexDir: path.join(projectRoot, "media", ".index"),
  libraryIndexFile: path.join(projectRoot, "media", ".index", "library.json"),
  incompleteDownloadsDir: path.join(projectRoot, "media", ".incomplete"),
  browserMediaDir: path.join(projectRoot, "media", "browser"),
  clientDistDir: path.join(projectRoot, "client", "dist"),
  serverHost: process.env.SERVER_HOST ?? "192.168.1.75",
  playbackHost: process.env.PLAYBACK_HOST ?? process.env.SERVER_HOST ?? "192.168.1.75",
  serverPort: toNumber(process.env.SERVER_PORT, 3000),
  nebulaIp: process.env.NEBULA_IP ?? "192.168.1.76",
  adbPort: toNumber(process.env.ADB_PORT, 5555),
  vlcPackage: "org.videolan.vlc",
  vlcAppActivity: "org.videolan.vlc.StartActivity",
  vlcPlaybackActivity: "org.videolan.vlc.gui.video.VideoPlayerActivity",
};

export type AppConfig = typeof config;
