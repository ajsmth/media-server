const express = require("express");
const { spawn, exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const MEDIA_DIR = path.join(__dirname, "media");
app.use("/media", express.static(MEDIA_DIR));
const PLAYLIST_PATH = path.join(__dirname, "stream.m3u8");

const SERVER_IP = "192.168.1.66";
const SERVER_PORT = 3000;
const NEBULA_IP = "192.168.1.69";

let ffmpegProcess = null;

/* ============================= */
/*        LIST FILES API         */
/* ============================= */

app.get("/files", (req, res) => {
  console.log("Listing files...");
  const files = fs
    .readdirSync(MEDIA_DIR)
    .filter((f) => f.endsWith(".mp4") || f.endsWith(".mkv"));
  res.json(files);
});

/* ============================= */
/*          PLAY API             */
/* ============================= */

app.post("/play", (req, res) => {
  const file = req.body.file;
  const fullPath = path.join(MEDIA_DIR, file);

  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: "File not found" });
  }

  const fileUrl = `http://${SERVER_IP}:${SERVER_PORT}/media/${encodeURIComponent(file)}`;

  console.log("\nLaunching VLC with:", fileUrl);

  exec(`adb connect ${NEBULA_IP}:5555`, (err) => {
    if (err) {
      console.log("ADB connect error:", err.message);
    }

    exec(`adb shell am force-stop org.videolan.vlc`, () => {
      exec(
        `adb shell am start \
          -a android.intent.action.VIEW \
          -d "${fileUrl}" \
          -t "video/mp4" \
          -n org.videolan.vlc/org.videolan.vlc.StartActivity`,
        (err, stdout, stderr) => {
          if (err) {
            console.log("ADB launch error:", err.message);
          } else {
            console.log("VLC launched successfully.");
          }
        },
      );
    });
  });

  res.json({ status: "playing", file });
});
/* ============================= */
/*        VLC LAUNCHER           */
/* ============================= */

/* ============================= */
/*        START SERVER           */
/* ============================= */

app.listen(SERVER_PORT, () => {
  console.log(`Server running at http://${SERVER_IP}:${SERVER_PORT}`);
});
