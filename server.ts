import { serve } from "bun";
import fs from "node:fs";
import path from "node:path";
import { handleWSMessage } from "./src/lib/wsHandler";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

// --- SECURITY: Backend-only secrets ---
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("Error: GEMINI_API_KEY is missing in environment");
  process.exit(1);
}

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

// Start server
const server = serve({
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
    async message(ws, message) {
      await handleWSMessage(ws as any, message, {
        geminiKey: API_KEY || "",
        projectsContext,
        eventInfo,
      });
    },
    open(ws) { console.log(`[WS] Open`); },
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