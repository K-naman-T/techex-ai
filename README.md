# TechEx AI

TechEx AI is the TechEx 2026 guide: a React + Bun experience that combines conversational chat, duplex speech, and guided navigation across the exhibition floor. This README is the canonical documentation for contributors and operators.

## Feature Highlights

- **Conversational chat** over SSE (`/api/chat`) driven by `gemini-2.5-flash`, enriched with event metadata and 35+ stall writeups.
- **Hands-free voice assistant** over WebSocket (`/api/ws`) using Gemini Live native audio (`gemini-2.5-flash-native-audio-preview-12-2025`).
- **Map triggers** (`[SHOW_MAP: ...]` / `show_map`) that pivot the UI to the correct stall in real time.
- **Rotating Gemini keys** via `src/lib/apiKeyManager.ts` to dodge rate limits.
- **Single knowledge base** (`data/db.json`) that feeds both chat and voice.

## Tech Stack

- React 19 + Vite 7 frontend
- Tailwind-esque utility styling plus custom 3D orb avatar
- Bun HTTP/WebSocket server (`server.ts`)
- Google `@google/genai` SDK (text + Live APIs)
- Mermaid CLI for architecture diagrams

## Architecture Overview

The system is split between a Vite SPA and a Bun server. The diagram below mirrors the runtime wiring and is tracked in-source.

Generate/update the diagram with:

```bash
npm run diagram:system
```

Rendered view:

![TechEx AI system design](assets/system-design.svg)

Static PNG copy (useful for decks): `assets/system-design.png`

### Runtime Flow

#### Text Chat (SSE `/api/chat`)
- `ChatModal` posts prompts + history.
- `server.ts` routes to `TextChatService` which:
  1. Loads the speaker profile, event schedule, and `data/db.json` entries.
  2. Builds a contextual system prompt (language mirroring, map-call format, persona rules).
  3. Streams `gemini-2.5-flash` deltas back over SSE (`chat_delta`).
  4. Emits `show_map` events when the model requests `[SHOW_MAP: ...]`.
- Retries rotate between any env vars prefixed `key` to distribute throughput.

#### Voice Assistant (WebSocket `/api/ws` + Gemini Live)

1. **User input** – Press/hold the orb (`StyledOrbAvatar` in `src/App.jsx`). `useWSVoice` spins up an `AudioWorklet`, captures 16 kHz PCM, and opens a WebSocket.
2. **Client streaming** – The hook sends `{type:"activity_start"}`, streams mic frames as `{type:"gemini_audio_in", data:<base64>}`, then `{type:"activity_end"}` on release.
3. **Server session** – `server.ts` upgrades the socket and hands it to `VoiceChatService`.
4. **Gemini Live connect** – `VoiceChatService` (`src/services/VoiceChatService.ts`):
   - Pulls the next Gemini key from `src/lib/apiKeyManager.ts`.
   - Calls `ai.live.connect` with Despina voice, `responseModalities:[AUDIO]`, manual activity detection disabled, and a tool named `show_map(stallId)`.
   - Injects the same knowledge base + persona rules used in text chat.
5. **Duplex streaming** – Incoming socket payloads are forwarded to Gemini Live. The SDK callback returns base64 PCM which is forwarded back to the browser as `{type:"audio_out", mime:"audio/pcm;rate=24000", data:<base64>}`.
6. **Client playback + UI** – `useWSVoice` decodes PCM into a `MediaSource`, plays it through the orb, and raises map events when `{type:"show_map"}` frames appear. Turn completion updates UI state so the mic can re-arm.

Gemini Live session resumption and context compression are enabled, so reconnects (network or rate limits) reuse the server-issued `sessionHandle` without losing history.

#### Map + Knowledge
- Knowledge: `data/db.json` (projects, map metadata, guide copy). Also see `data/models.json`, `data/live_models.txt`, and `data/techex.sqlite` for supplemental assets.
- Map assets: `public/assets/map-floorplan.svg` and `assets/map-techex.jpeg`.
- Map triggers come from either `[SHOW_MAP: ID]` text markers or the `show_map` tool call in Live responses.

## Project Structure

- `src/` – React app, hooks (`useWSVoice`, etc.), contexts, UI components.
- `server.ts` – Bun HTTP + WebSocket server wiring.
- `src/services/TextChatService.ts` – SSE chat orchestrator.
- `src/services/VoiceChatService.ts` – Gemini Live session proxy.
- `src/lib/apiKeyManager.ts` – Fatigue-free key rotation over `key*` env vars.
- `data/` – Knowledge base JSON and supporting files (`db.json`, extracted projects, sqlite cache, model lists).
- `tests/` – All load-test configs, logs, captured JSON outputs, and ad-hoc Bun scripts consolidated here.
- `scripts/` – Utility tooling:
  - `capture_response.ts` – capture Live responses to WAV.
  - `debug_db.ts` / `migrate.ts` – Supabase/Postgres helpers.
  - `extract_ppt.py` + `merge_db.py` – Build/update `data/extracted_projects.json` and merge into `db.json`.
  - `generate_favicon.py` – Crop favicon from the TechEx logo.

## Data & Assets

- **Knowledge base**: edit `data/db.json` and rerun any ingestion scripts if new projects arrive.
- **Mermaid diagram**: `assets/system-design.mmd` + `npm run diagram:system` (requires global `@mermaid-js/mermaid-cli`). SVG + PNG render to `assets/`.
- **3D / media**: `assets/*.glb`, `.fbx`, `pcm-processor.js`, etc. used by the orbiting avatar scenes.

## Environment & Configuration

Create `.env` with:

- `key1`, `key2`, ...: Gemini API keys (any prefix `key` is auto-detected/rotated).
- `PORT` (optional): Bun server port (defaults to `3005`).
- `GEMINI_API_KEY` (optional): used by scripts/tests needing a single key.

Mermaid CLI (`mmdc`) is installed globally (`npm install -g @mermaid-js/mermaid-cli`) so the diagram script works in any shell. Puppeteer runs headless via `mermaid-puppeteer-config.json`.

## Local Development

Install deps:

```bash
bun install
```

Run frontend and backend side-by-side (Vite proxies `/api` to Bun by default):

```bash
# terminal 1 – frontend on :3000
bun run dev

# terminal 2 – Bun API server on :3005
bun run start
```

## Build & Test

```bash
bun run build
bun test
```

End-to-end voice tests call Gemini Live, so they require working keys and outbound network access.

## Testing, Logs & Load Harness

Everything test-related now resides in `tests/`:

- `tests/*.ts` – Bun integration suites (chat pipeline, voice WS, knowledge checks).
- `tests/load-test*.yml|txt` – k6-style load runs plus captured outputs.
- `tests/results*.json`, `tests/server.log`, etc. – archived experiment data for reference.

## Deployment

This repo ships with:

- `Dockerfile` – Multi-stage Bun image ready for Render/Fly/Cloud Run.
- `render.yaml` – Render service definition (build/run commands + env vars).
- Any deploy needs the same `key*` env vars set server-side plus volumes/persistence if you plan to edit `data/db.json` at runtime.
