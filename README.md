# TechEx AI

TechEx AI is a React + Bun application for TechEx 2026 that supports:
- text chat over SSE (`/api/chat`)
- real-time voice chat over WebSocket (`/api/ws`)
- map trigger responses for stall navigation (`[SHOW_MAP: ...]` / `show_map`)

It uses a local JSON knowledge base at `data/db.json` (event + 35 projects/stalls).

## Tech stack

- Frontend: React 19 + Vite 7
- Backend: Bun server (`server.ts`)
- AI SDK: `@google/genai`
- Voice: Gemini Live native audio model

## Project structure (key files)

- `src/` - frontend app, hooks, UI, context
- `server.ts` - Bun HTTP + WebSocket API server
- `src/services/TextChatService.ts` - SSE text chat pipeline
- `src/services/VoiceChatService.ts` - Gemini Live voice pipeline
- `src/lib/apiKeyManager.ts` - Gemini API key rotation
- `data/db.json` - event + stall knowledge base

## Local setup

1. Install dependencies:
   ```bash
   bun install
   ```

2. Configure environment variables in `.env`:
   - `key1`, `key2`, `key3` (or more): Gemini API keys (server rotates keys that start with `key`)
   - `PORT` (optional): API server port (default: `3005`)
   - `GEMINI_API_KEY` (optional): used by some tests/scripts

## Run locally

Run frontend and backend in separate terminals:

```bash
# terminal 1 (Vite frontend on :3000)
bun run dev
```

```bash
# terminal 2 (Bun API server on :3005 by default)
bun run start
```

Vite proxies `/api` to `http://127.0.0.1:3005`.

## Build and test

```bash
bun run build
bun test
```

Note: some end-to-end voice tests require API keys and a reachable Gemini service.

## System design

Generate/update the diagram with:

```bash
npm run diagram:system
```

Rendered view:

![TechEx AI system design](assets/system-design.svg)

Static PNG copy (useful for docs/decks): `assets/system-design.png`

## Deployment

This repo includes:
- `Dockerfile` (multi-stage Bun build)
- `render.yaml` (Render service config)
