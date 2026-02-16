import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import { NonRealTimeVAD } from "@ricky0123/vad-web";

const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const FF_INPUT_MOUNT = "/input";
const FILE_SIZE_WARN_BYTES = 120 * 1024 * 1024;
const STATUS_HEARTBEAT_MS = 12000;
const CHUNK_REQUEST_TIMEOUT_MS = 8 * 60 * 1000;
const FFMPEG_CORE_VERSION = "0.12.9";
const MAX_WINDOWS_FALLBACK = 10000;

const els = {
  audioFile: document.querySelector("#audioFile"),
  apiKey: document.querySelector("#apiKey"),
  model: document.querySelector("#model"),
  language: document.querySelector("#language"),
  minSpeechMs: document.querySelector("#minSpeechMs"),
  minSilenceMs: document.querySelector("#minSilenceMs"),
  maxChunkSec: document.querySelector("#maxChunkSec"),
  startBtn: document.querySelector("#startBtn"),
  downloadBtn: document.querySelector("#downloadBtn"),
  status: document.querySelector("#status"),
  transcript: document.querySelector("#transcript"),
};

let transcriptBlobUrl = null;
const START_BUTTON_LABEL = els.startBtn.textContent || "Start Transcription";

function logStatus(line) {
  const now = new Date().toLocaleTimeString();
  els.status.textContent += `\n[${now}] ${line}`;
  els.status.scrollTop = els.status.scrollHeight;
}

function setIdleStatus(message = "Idle.") {
  els.status.textContent = message;
}

function setRunPhase(phase) {
  els.startBtn.textContent = phase || START_BUTTON_LABEL;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatTimestamp(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function parseWavPcm16(buffer) {
  const view = new DataView(buffer);
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (riff !== "RIFF" || wave !== "WAVE") {
    throw new Error("Invalid WAV file.");
  }

  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let dataOffset = 0;
  let dataSize = 0;

  while (offset + 8 <= view.byteLength) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkDataOffset = offset + 8;

    if (chunkId === "fmt ") {
      const audioFormat = view.getUint16(chunkDataOffset, true);
      channels = view.getUint16(chunkDataOffset + 2, true);
      sampleRate = view.getUint32(chunkDataOffset + 4, true);
      bitsPerSample = view.getUint16(chunkDataOffset + 14, true);
      if (audioFormat !== 1) {
        throw new Error("WAV is not PCM.");
      }
    }

    if (chunkId === "data") {
      dataOffset = chunkDataOffset;
      dataSize = chunkSize;
      break;
    }

    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  if (!dataOffset || !dataSize) {
    throw new Error("WAV data chunk not found.");
  }
  if (channels !== 1) {
    throw new Error(`Expected mono WAV but got ${channels} channels.`);
  }
  if (bitsPerSample !== 16) {
    throw new Error(`Expected 16-bit WAV but got ${bitsPerSample}-bit.`);
  }

  const samples = dataSize / 2;
  const float32 = new Float32Array(samples);
  let ptr = dataOffset;
  for (let i = 0; i < samples; i++) {
    float32[i] = Math.max(-1, Math.min(1, view.getInt16(ptr, true) / 32768));
    ptr += 2;
  }

  return { sampleRate, audio: float32 };
}

function encodeWavFromFloat32(float32, sampleRate) {
  const buffer = new ArrayBuffer(44 + float32.length * 2);
  const view = new DataView(buffer);

  const writeAscii = (start, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(start + i, str.charCodeAt(i));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + float32.length * 2, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, float32.length * 2, true);

  let offset = 44;
  for (let i = 0; i < float32.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function splitLongSegments(segments, sampleRate, maxChunkSec) {
  if (!Number.isFinite(maxChunkSec) || maxChunkSec <= 0) return segments;

  const maxSamples = Math.floor(maxChunkSec * sampleRate);
  const out = [];

  for (const segment of segments) {
    if (segment.audio.length <= maxSamples) {
      out.push(segment);
      continue;
    }

    let offset = 0;
    while (offset < segment.audio.length) {
      const end = Math.min(segment.audio.length, offset + maxSamples);
      out.push({
        startSec: segment.startSec + offset / sampleRate,
        endSec: segment.startSec + end / sampleRate,
        audio: segment.audio.subarray(offset, end),
      });
      offset = end;
    }
  }

  return out;
}

async function withHeartbeat(label, run, everyMs = STATUS_HEARTBEAT_MS) {
  const startedAt = Date.now();
  const timer = setInterval(() => {
    const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
    logStatus(`${label}... ${elapsedSec}s elapsed`);
  }, everyMs);

  try {
    return await run();
  } finally {
    clearInterval(timer);
  }
}

async function loadFfmpeg() {
  const coreBases = [
    `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`,
    `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`,
  ];

  let lastError = null;

  for (const baseURL of coreBases) {
    const ffmpeg = new FFmpeg();
    try {
      logStatus(`Loading ffmpeg core from ${new URL(baseURL).host} (blob mode)...`);
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ffmpeg;
    } catch (error) {
      lastError = error;
      ffmpeg.terminate();
      logStatus(`ffmpeg blob load failed from ${new URL(baseURL).host}, trying next source...`);
    }
  }

  for (const baseURL of coreBases) {
    const ffmpeg = new FFmpeg();
    try {
      logStatus(`Loading ffmpeg core from ${new URL(baseURL).host} (direct mode)...`);
      await ffmpeg.load({
        coreURL: `${baseURL}/ffmpeg-core.js`,
        wasmURL: `${baseURL}/ffmpeg-core.wasm`,
      });
      return ffmpeg;
    } catch (error) {
      lastError = error;
      ffmpeg.terminate();
      logStatus(`ffmpeg direct load failed from ${new URL(baseURL).host}, trying next source...`);
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError || "unknown error");
  throw new Error(`Unable to load ffmpeg-core.js (${message}). Check network access to cdn.jsdelivr.net/unpkg.com.`);
}

function toArrayBuffer(data) {
  const wavBytes = data instanceof Uint8Array ? data : new Uint8Array(data.buffer);
  return wavBytes.buffer.slice(wavBytes.byteOffset, wavBytes.byteOffset + wavBytes.byteLength);
}

async function mountInputFile(ffmpeg, file) {
  try {
    await ffmpeg.unmount(FF_INPUT_MOUNT);
  } catch {
    // Ignore stale mount cleanup.
  }
  try {
    await ffmpeg.deleteDir(FF_INPUT_MOUNT);
  } catch {
    // Ignore stale dir cleanup.
  }
  await ffmpeg.createDir(FF_INPUT_MOUNT);
  await ffmpeg.mount("WORKERFS", { files: [file] }, FF_INPUT_MOUNT);
  return `${FF_INPUT_MOUNT}/${file.name}`;
}

async function unmountInputFile(ffmpeg) {
  try {
    await ffmpeg.unmount(FF_INPUT_MOUNT);
  } catch {
    // Ignore cleanup failures.
  }
  try {
    await ffmpeg.deleteDir(FF_INPUT_MOUNT);
  } catch {
    // Ignore cleanup failures.
  }
}

async function probeDurationSec(ffmpeg, inputPath) {
  let durationSec = null;
  const logHandler = ({ message }) => {
    // Look for "Duration: 00:00:00.00," pattern
    const match = message.match(/Duration:\s+(\d{2}):(\d{2}):(\d{2}\.\d+)/);
    if (match) {
      const hours = parseFloat(match[1]);
      const minutes = parseFloat(match[2]);
      const seconds = parseFloat(match[3]);
      durationSec = hours * 3600 + minutes * 60 + seconds;
    }
  };

  ffmpeg.on("log", logHandler);

  try {
    await ffmpeg.exec(["-i", inputPath]);
  } catch (e) {
    // ffmpeg.exec might fail because we didn't provide an output file,
    // but we only care about the log output which happens before that error.
    console.warn("ffmpeg probe exec error (expected):", e);
  } finally {
    ffmpeg.off("log", logHandler);
  }

  return durationSec;
}

async function convertWindowToMono16kWav(ffmpeg, { inputPath, startSec, durationSec, windowIndex }) {
  const outputName = `window_${String(windowIndex + 1).padStart(5, "0")}.wav`;
  const code = await ffmpeg.exec([
    "-ss",
    startSec.toFixed(3),
    "-t",
    durationSec.toFixed(3),
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-f",
    "wav",
    outputName,
  ]);

  if (code !== 0) {
    if (startSec > 0) return null;
    throw new Error(`ffmpeg failed while converting window ${windowIndex + 1}.`);
  }

  let output;
  try {
    output = await ffmpeg.readFile(outputName);
  } catch {
    if (startSec > 0) return null;
    throw new Error(`ffmpeg did not produce output for window ${windowIndex + 1}.`);
  } finally {
    try {
      await ffmpeg.deleteFile(outputName);
    } catch {
      // Ignore cleanup failures.
    }
  }

  const wavBuffer = toArrayBuffer(output);
  if (wavBuffer.byteLength <= 44) {
    return null;
  }
  return wavBuffer;
}

async function getDurationFromMetadata(file) {
  return new Promise((resolve, reject) => {
    const objectURL = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";

    const cleanup = () => {
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(objectURL);
    };

    audio.onloadedmetadata = () => {
      const durationSec = audio.duration;
      cleanup();
      if (!Number.isFinite(durationSec) || durationSec <= 0) {
        reject(new Error("Audio metadata duration is invalid."));
        return;
      }
      resolve(durationSec);
    };

    audio.onerror = () => {
      cleanup();
      reject(new Error("Browser metadata probe failed."));
    };

    audio.src = objectURL;
  });
}

async function loadVad({ minSpeechMs, minSilenceMs }) {
  logStatus("Loading VAD model...");
  return NonRealTimeVAD.new({
    model: "v5",
    minSpeechMs,
    minSilenceMs,
    ortConfig: (ort) => {
      ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/";
      ort.env.wasm.numThreads = 1; // Disable threading to avoid COOP/COEP issues if they persist, or just for safety
    },
    baseAssetPath: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.27/dist/",
  });
}

async function vadChunkFloat32(vad, audio, sampleRate) {
  logStatus("Running VAD speech segmentation...");
  const segments = await vad.run(audio, sampleRate);

  return segments.map((segment) => ({
    startSec: segment.start / sampleRate,
    endSec: segment.end / sampleRate,
    audio: segment.audio,
  }));
}

async function transcribeChunk({ apiKey, model, language, chunkBlob, chunkLabel }) {
  const form = new FormData();
  form.append("model", model);
  form.append("file", chunkBlob, `${chunkLabel.replace(/\s+/g, "_")}.wav`);
  form.append("temperature", "0");
  if (language) {
    form.append("language", language);
  }

  logStatus(`Uploading ${chunkLabel} (${formatBytes(chunkBlob.size)})...`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CHUNK_REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  const waitTimer = setInterval(() => {
    const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
    logStatus(`Waiting on Groq for ${chunkLabel}... ${elapsedSec}s elapsed`);
  }, STATUS_HEARTBEAT_MS);

  let response;
  try {
    response = await fetch(GROQ_TRANSCRIBE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Groq request timed out for ${chunkLabel} after ${CHUNK_REQUEST_TIMEOUT_MS / 1000}s.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    clearInterval(waitTimer);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq transcription failed (${response.status}): ${text.slice(0, 500)}`);
  }

  const json = await response.json();
  logStatus(`Transcribed ${chunkLabel}`);
  return (json.text || "").trim();
}

async function runTranscription() {
  const file = els.audioFile.files?.[0];
  const apiKey = els.apiKey.value.trim();
  const model = els.model.value.trim();
  const language = els.language.value.trim();
  const minSpeechMs = Number(els.minSpeechMs.value);
  const minSilenceMs = Number(els.minSilenceMs.value);
  const maxChunkSec = Number(els.maxChunkSec.value);

  if (!file) throw new Error("Select an audiobook file.");
  if (!apiKey) throw new Error("Enter your Groq API key.");
  if (!model) throw new Error("Model is required.");
  if (!Number.isFinite(maxChunkSec) || maxChunkSec <= 0) {
    throw new Error("Max chunk sec must be a positive number.");
  }

  const windowSec = Math.max(30, Math.floor(maxChunkSec));
  logStatus(`Selected file: ${file.name} (${formatBytes(file.size)})`);
  if (file.size >= FILE_SIZE_WARN_BYTES) {
    logStatus(`Large file detected. Processing in ${windowSec}s windows to avoid browser memory stalls.`);
  }

  setRunPhase("Loading FFmpeg...");
  const ffmpeg = await withHeartbeat("Loading ffmpeg wasm", () => loadFfmpeg());

  let inputPath = "";
  try {
    setRunPhase("Preparing audio...");
    inputPath = await withHeartbeat("Mounting audiobook in worker FS", () => mountInputFile(ffmpeg, file), 10000);
    let durationSec = await withHeartbeat("Probing audio duration with ffprobe", () => probeDurationSec(ffmpeg, inputPath), 10000);
    if (!durationSec) {
      logStatus("ffprobe duration probe failed, trying browser metadata...");
      durationSec = await withHeartbeat("Reading browser metadata", () => getDurationFromMetadata(file), 10000).catch(() => null);
    }

    let totalWindows = null;
    if (durationSec && durationSec > 0) {
      totalWindows = Math.max(1, Math.ceil(durationSec / windowSec));
      logStatus(`Audio duration: ${(durationSec / 60).toFixed(2)} min (${totalWindows} window(s))`);
    } else {
      logStatus("Duration unavailable. Will process windows until EOF is reached.");
    }

    setRunPhase("Loading VAD...");
    const vad = await withHeartbeat("Loading VAD model", () => loadVad({ minSpeechMs, minSilenceMs }));

    const lines = [];
    let globalChunkCount = 0;

    const loopLimit = totalWindows || MAX_WINDOWS_FALLBACK;
    for (let windowIndex = 0; windowIndex < loopLimit; windowIndex++) {
      const windowStartSec = windowIndex * windowSec;
      const windowDurationSec = durationSec ? Math.min(windowSec, durationSec - windowStartSec) : windowSec;
      if (windowDurationSec <= 0) break;

      const windowLabel = totalWindows
        ? `window ${windowIndex + 1}/${totalWindows}`
        : `window ${windowIndex + 1}`;

      setRunPhase(windowLabel);
      logStatus(`${windowLabel}: ${formatTimestamp(windowStartSec)} -> ${formatTimestamp(windowStartSec + windowDurationSec)}`);

      const wavBuffer = await withHeartbeat(
        `Converting ${windowLabel}`,
        () =>
          convertWindowToMono16kWav(ffmpeg, {
            inputPath,
            startSec: windowStartSec,
            durationSec: windowDurationSec,
            windowIndex,
          }),
      );
      if (!wavBuffer) {
        if (!durationSec) {
          logStatus(`Reached EOF at ${windowLabel}.`);
        }
        break;
      }

      const { sampleRate, audio } = parseWavPcm16(wavBuffer);
      let chunks = await withHeartbeat(`VAD on ${windowLabel}`, () =>
        vadChunkFloat32(vad, audio, sampleRate),
      );
      chunks = splitLongSegments(chunks, sampleRate, windowSec);

      if (!chunks.length) {
        logStatus(`No speech detected in ${windowLabel}.`);
        continue;
      }

      logStatus(`${windowLabel} yielded ${chunks.length} speech chunk(s).`);

      for (let chunkInWindow = 0; chunkInWindow < chunks.length; chunkInWindow++) {
        const chunk = chunks[chunkInWindow];
        globalChunkCount += 1;
        const chunkWav = encodeWavFromFloat32(chunk.audio, sampleRate);
        const chunkLabel = `chunk ${globalChunkCount} (window ${windowIndex + 1}, part ${chunkInWindow + 1}/${chunks.length})`;
        const text = await transcribeChunk({
          apiKey,
          model,
          language,
          chunkBlob: chunkWav,
          chunkLabel,
        });

        if (!text) continue;
        lines.push(`[${formatTimestamp(windowStartSec + chunk.startSec)}] ${text}`);
        els.transcript.value = `${lines.join("\n")}\n`;
      }
    }

    if (!lines.length) {
      throw new Error("No speech segments were transcribed.");
    }

    return lines;
  } finally {
    await unmountInputFile(ffmpeg);
    ffmpeg.terminate();
  }
}

function updateDownload(lines) {
  if (transcriptBlobUrl) {
    URL.revokeObjectURL(transcriptBlobUrl);
    transcriptBlobUrl = null;
  }

  const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/plain;charset=utf-8" });
  transcriptBlobUrl = URL.createObjectURL(blob);

  els.downloadBtn.disabled = lines.length === 0;
  els.downloadBtn.onclick = () => {
    const a = document.createElement("a");
    a.href = transcriptBlobUrl;
    a.download = "transcript.txt";
    a.click();
  };
}

els.startBtn.addEventListener("click", async () => {
  els.startBtn.disabled = true;
  els.downloadBtn.disabled = true;
  els.transcript.value = "";
  setIdleStatus("Starting...");
  setRunPhase("Starting...");

  try {
    const lines = await runTranscription();
    updateDownload(lines);
    logStatus(`Done. Transcript lines: ${lines.length}`);
  } catch (error) {
    logStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    els.startBtn.disabled = false;
    setRunPhase("");
  }
});
