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
  clientDistDir: path.join(projectRoot, "client", "dist"),
  serverHost: process.env.SERVER_HOST ?? "192.168.1.66",
  serverPort: toNumber(process.env.SERVER_PORT, 3000),
  nebulaIp: process.env.NEBULA_IP ?? "192.168.1.69",
  adbPort: toNumber(process.env.ADB_PORT, 5555),
  vlcPackage: "org.videolan.vlc",
  vlcActivity: "org.videolan.vlc.StartActivity",
};
