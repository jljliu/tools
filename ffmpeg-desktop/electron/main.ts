import { app, BrowserWindow, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ffmpeg from 'fluent-ffmpeg'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Setup FFMPEG paths
const ffmpegPath = require('ffmpeg-static')
const ffprobePath = require('@ffprobe-installer/ffprobe').path

// Fix for packaged app
const fixPath = (pathStr: string) => pathStr.replace('app.asar', 'app.asar.unpacked')

ffmpeg.setFfmpegPath(fixPath(ffmpegPath))
ffmpeg.setFfprobePath(fixPath(ffprobePath))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 600,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    titleBarStyle: 'hiddenInset', // Mac-style title bar
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)

// IPC Handlers
ipcMain.on('transcode-file', (_event, { filePath, format, id, hwAccel, codec, resolution, bitrate }) => {
  if (!win) return

  const inputDir = path.dirname(filePath)
  const name = path.basename(filePath, path.extname(filePath))
  const outputPath = path.join(inputDir, `${name}_converted.${format}`)

  console.log(`Starting conversion: ${filePath} -> ${outputPath}, HW: ${hwAccel}, Codec: ${codec}, Res: ${resolution}, Bitrate: ${bitrate}`)

  const command = ffmpeg(filePath).toFormat(format)

  // Resolution
  if (resolution && resolution !== 'original') {
    command.size(resolution)
  }

  // Bitrate
  if (bitrate) {
    command.videoBitrate(`${bitrate}k`)
  }

  // Codec & Hardware Acceleration
  if (['mp4', 'mov', 'mkv'].includes(format)) {
    if (hwAccel && process.platform === 'darwin') {
      // Hardware Acceleration Logic
      if (codec === 'hevc') {
        command.videoCodec('hevc_videotoolbox')
      } else {
        // Default to H.264 for 'auto' or 'h264'
        command.videoCodec('h264_videotoolbox')
      }
      // VideoToolbox often needs explicit bitrate or it might default to low quality
      if (!bitrate) {
        command.videoBitrate('2500k')
      }
    } else {
      // Software Encoding Logic
      if (codec === 'hevc') {
        command.videoCodec('libx265')
      } else if (codec === 'h264') {
        command.videoCodec('libx264')
      }
      // 'auto' uses default
    }
  }

  // Format specific overrides
  if (format === 'gif') {
    command.fps(10).size('320x?')
  } else if (format === 'mp3') {
    command.noVideo()
  }

  command
    .on('progress', (progress: any) => {
      // fluent-ffmpeg progress.percent can be undefined sometimes
      const percent = progress.percent || 0
      win?.webContents.send('conversion-progress', { id, progress: percent })
    })
    .on('end', () => {
      console.log(`Conversion complete: ${outputPath}`)
      win?.webContents.send('conversion-complete', { id, outputPath })
    })
    .on('error', (err: any) => {
      console.error('Conversion error:', err)
      win?.webContents.send('conversion-error', { id, error: err.message })
    })
    .save(outputPath)
})
