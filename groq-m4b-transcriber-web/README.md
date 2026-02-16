# Groq M4B Transcriber Web

Static web app (no backend) for transcribing audiobooks in the browser.

Pipeline:
1. Browser reads audio file.
2. `ffmpeg.wasm` converts to mono 16k WAV.
3. Silero VAD (`@ricky0123/vad-web`) chunks speech by silence boundaries.
4. Browser calls Groq Whisper API per chunk.
5. Transcript is shown in UI and can be downloaded.

## Run locally

```bash
cd /Users/jinyanliu/code/apps/groq-m4b-transcriber-web
npm install
npm run dev
```

## Build static site

```bash
npm run build
```

Deploy the `dist/` directory to any static host (Netlify, Vercel static, GitHub Pages, S3, etc).

## Security caveat

This is browser-only, so the Groq API key is entered and used on the client. That means key exposure risk exists for any end user who can inspect network requests/devtools.

For personal-only usage this can be acceptable. For multi-user/public deployment, a backend token proxy is safer.
