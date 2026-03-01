import { serve } from "bun";
import fs from "node:fs";
import path from "node:path";
import { TextChatService } from "./src/services/TextChatService";
import { VoiceChatService } from "./src/services/VoiceChatService";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

import { ApiKeyManager } from "./src/lib/apiKeyManager";

// --- SECURITY: API Key Rotation ---
const apiKeyManager = new ApiKeyManager();

// --- Knowledge Base ---
let eventInfo: any = {};
let projectsContext: string = "";

const initKnowledgeBase = async () => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.warn(`[INIT] Knowledge base not found at ${DB_PATH}`);
      return;
    }
    const rawData = fs.readFileSync(DB_PATH, "utf-8");
    const db = JSON.parse(rawData);
    eventInfo = db.events[0];
    const projects = db.projects || [];

    // Latency Optimization: Compress knowledge base string structure to minimize Input Tokens
    projectsContext = projects.map((p: any) =>
      `[Stall ${p.stall_number}]${p.title}|Cat:${p.category}|Desc:${(p.description || "").substring(0, 150)}`
    ).join(";");

    console.log(`[INIT] Knowledge base minified. ${projects.length} projects cached.`);
  } catch (error) {
    console.error("[INIT] Failed to load knowledge base:", error);
  }
};

export type WSContext = {
  userId: string;
  geminiLiveSession?: any;
  /** Last session resumption handle for reconnection */
  sessionResumeHandle?: string;
  /** Stored init config so GoAway/auto-reconnect can re-call connectWithRetry */
  voiceInitConfig?: {
    config: any;
    language: string;
    userMetadata: any;
    isFirstTime: boolean;
    systemInstruction: string;
  };
  /** Counter for auto-reconnect attempts */
  reconnectAttempts?: number;
};

// --- Service Initialization ---
// Both services manage API key state intrinsically to support round-robin
const textChatService = new TextChatService(apiKeyManager, {
  getProjectsContext: () => projectsContext,
  getEventInfo: () => eventInfo,
});

const voiceChatService = new VoiceChatService(apiKeyManager);

// Start server
const server = serve<WSContext>({
  port: process.env.PORT || 3005,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (!projectsContext) await initKnowledgeBase();

    // Health check for Cloud Run
    if (url.pathname === "/health") {
      return new Response("ok", { status: 200, headers });
    }

    // WebSocket upgrade
    if (url.pathname === "/api/ws") {
      if (server.upgrade(req, { data: { userId: "guest" } })) return;
      return new Response("Upgrade failed", { status: 400 });
    }

    // HTTP Chat Endpoint (SSE)
    if (url.pathname === "/api/chat" && req.method === "POST") {
      try {
        return await textChatService.handleStream(req);
      } catch (err) {
        console.error("Error handling chat stream:", err);
        return new Response("Error processing chat", { status: 500 });
      }
    }

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    // Serve static files from dist/
    const distDir = path.resolve("dist");
    let filePath = path.join(distDir, url.pathname === "/" ? "index.html" : url.pathname.substring(1));

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return new Response(Bun.file(filePath));
    }

    // SPA fallback
    const indexHtml = path.join(distDir, "index.html");
    if (fs.existsSync(indexHtml)) {
      return new Response(Bun.file(indexHtml));
    }

    return new Response("Not Found", { status: 404 });
  },
  websocket: {
    maxPayloadLength: 16 * 1024 * 1024, // 16 MB max incoming message
    backpressureLimit: 64 * 1024 * 1024, // 64 MB queued before dropping (audio chunks pile up)
    async message(ws, message) {
      try {
        const msg = JSON.parse(message.toString());
        const ctx = ws.data;

        switch (msg.type) {
          case "start_gemini_live":
            await voiceChatService.initSession(
              ws,
              {
                getProjectsContext: () => projectsContext,
                getEventInfo: () => eventInfo,
              },
              msg.language,
              msg.userMetadata,
              msg.isFirstTime
            );
            break;

          case "gemini_audio_in":
            if (ctx.geminiLiveSession) {
              try {
                // Use `audio` property per LiveSendRealtimeInputParameters type
                ctx.geminiLiveSession.sendRealtimeInput({
                  audio: {
                    mimeType: "audio/pcm;rate=16000",
                    data: msg.data, // base64
                  }
                });
              } catch (e: any) {
                console.error("[Voice API] sendRealtimeInput error:", e.message || e);
              }
            }
            break;

          case "activity_start":
            if (ctx.geminiLiveSession) {
              try {
                ctx.geminiLiveSession.sendRealtimeInput({ activityStart: {} });
              } catch (e: any) {
                console.error("[Voice API] activityStart error:", e.message || e);
              }
            }
            break;

          case "activity_end":
            if (ctx.geminiLiveSession) {
              try {
                ctx.geminiLiveSession.sendRealtimeInput({ activityEnd: {} });
              } catch (e: any) {
                console.error("[Voice API] activityEnd error:", e.message || e);
              }
            }
            break;

          case "stop_gemini_live":
            if (ctx.geminiLiveSession) {
              try { ctx.geminiLiveSession.close(); } catch (e) { }
              ctx.geminiLiveSession = undefined;
            }
            ws.send(JSON.stringify({ type: "gemini_live_stopped" }));
            break;

          default:
            console.warn(`[WS] Unknown message type: ${msg.type}`);
        }
      } catch (e) {
        console.error("[WS] Error handling message:", e);
        ws.send(JSON.stringify({ type: "error", message: "Internal server error" }));
      }
    },
    open(ws) { console.log(`[WS] Open`); },
    drain(ws) { console.log(`[WS] Backpressure drained, ready to send again`); },
    close(ws) {
      const ctx = ws.data as any;
      if (ctx.geminiLiveSession) {
        try { ctx.geminiLiveSession.close(); } catch (e) { }
      }
    }
  }
});

console.log(`[SERVER] Running on http://0.0.0.0:${server.port}`);
initKnowledgeBase();