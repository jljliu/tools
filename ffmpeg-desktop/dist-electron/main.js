import { app, BrowserWindow, ipcMain } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ffmpeg from "fluent-ffmpeg";
const require$1 = createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
const ffmpegPath = require$1("ffmpeg-static");
const ffprobePath = require$1("@ffprobe-installer/ffprobe").path;
const fixPath = (pathStr) => pathStr.replace("app.asar", "app.asar.unpacked");
ffmpeg.setFfmpegPath(fixPath(ffmpegPath));
ffmpeg.setFfprobePath(fixPath(ffprobePath));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 600,
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    titleBarStyle: "hiddenInset",
    // Mac-style title bar
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(createWindow);
ipcMain.on("transcode-file", (_event, { filePath, format, id, hwAccel, codec, resolution, bitrate }) => {
  if (!win) return;
  const inputDir = path.dirname(filePath);
  const name = path.basename(filePath, path.extname(filePath));
  const outputPath = path.join(inputDir, `${name}_converted.${format}`);
  console.log(`Starting conversion: ${filePath} -> ${outputPath}, HW: ${hwAccel}, Codec: ${codec}, Res: ${resolution}, Bitrate: ${bitrate}`);
  const command = ffmpeg(filePath).toFormat(format);
  if (resolution && resolution !== "original") {
    command.size(resolution);
  }
  if (bitrate) {
    command.videoBitrate(`${bitrate}k`);
  }
  if (["mp4", "mov", "mkv"].includes(format)) {
    if (hwAccel && process.platform === "darwin") {
      if (codec === "hevc") {
        command.videoCodec("hevc_videotoolbox");
      } else {
        command.videoCodec("h264_videotoolbox");
      }
      if (!bitrate) {
        command.videoBitrate("2500k");
      }
    } else {
      if (codec === "hevc") {
        command.videoCodec("libx265");
      } else if (codec === "h264") {
        command.videoCodec("libx264");
      }
    }
  }
  if (format === "gif") {
    command.fps(10).size("320x?");
  } else if (format === "mp3") {
    command.noVideo();
  }
  command.on("progress", (progress) => {
    const percent = progress.percent || 0;
    win == null ? void 0 : win.webContents.send("conversion-progress", { id, progress: percent });
  }).on("end", () => {
    console.log(`Conversion complete: ${outputPath}`);
    win == null ? void 0 : win.webContents.send("conversion-complete", { id, outputPath });
  }).on("error", (err) => {
    console.error("Conversion error:", err);
    win == null ? void 0 : win.webContents.send("conversion-error", { id, error: err.message });
  }).save(outputPath);
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
