import { serve } from "bun";
import fs from "node:fs";
import path from "node:path";

// Set credentials for this project only
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(process.cwd(), "google-credentials.json");

import { GoogleGenAI } from "@google/genai";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";

const DB_PATH = path.join(process.cwd(), "data", "db.json");
const API_KEY = process.env.VITE_GEMINI_API_KEY || ""; 

// Google Cloud TTS Client
// Ensure GOOGLE_APPLICATION_CREDENTIALS env var is set to path of key file
// OR run 'gcloud auth application-default login'
const ttsClient = new TextToSpeechClient();

// Helper to get context from JSON DB
const getKnowledgeContext = () => {
  try {
    if (!fs.existsSync(DB_PATH)) return "Database not found.";
    const rawData = fs.readFileSync(DB_PATH, "utf-8");
    const db = JSON.parse(rawData);
    const event = db.events[0];
    const projects = db.projects || [];

    if (!event) return "No event data found.";

    const projectStrings = projects.map(p =>
      `- Stall ${p.stall_number} [${p.category}]: "${p.title}" by ${p.team_name}.\n  Details: ${p.description}`
    ).join("\n");

    return `
You are an intelligent 3D Avatar Assistant for TechEx AI.
**Core Identity:**
- Name: TechEx Avatar
- Purpose: Assist users with information about technology and the event.
- Personality: Professional, knowledgeable, futuristic, polite.
- Model: Gemini 3 Flash (Prototype)

**Real-World Knowledge Base:**
- Event: ${event.name} (${event.date}) at ${event.location}
- Overview: ${event.description}
- Layout: ${event.layout_info}

**Projects:**
${projectStrings}

**Instructions:**
- Keep responses concise (spoken word optimized).
- STRICTLY use the provided "Real-World Knowledge Base".
`;
  } catch (error) {
    console.error("DB Error:", error);
    return "";
  }
};

const contextConfig = {
  systemInstruction: getKnowledgeContext(),
};

const server = serve({
  port: 3001,
  async fetch(req) {
    const url = new URL(req.url);

    // HEADERS for CORS
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    // --- API: TTS (Google Cloud) ---
    if (url.pathname === "/api/tts" && req.method === "POST") {
      try {
        const { text } = await req.json();
        
        if (!text) {
            return new Response(JSON.stringify({ error: "Text missing" }), { status: 400, headers });
        }

        const request = {
          input: { text: text },
          // Voice Selection: Neural2 (High Quality)
          // hi-IN-Neural2-B (Male), hi-IN-Neural2-A (Female)
          // en-IN-Neural2-B (Male), en-IN-Neural2-A (Female)
          // Defaulting to English Indian Male for TechEx context
          voice: { languageCode: 'en-IN', name: 'en-IN-Neural2-B' },
          audioConfig: { audioEncoding: 'MP3' as const },
        };

        const [response] = await ttsClient.synthesizeSpeech(request);
        const audioContent = response.audioContent;

        if (!audioContent) {
             throw new Error("No audio content returned");
        }

        return new Response(JSON.stringify({ audioContent: audioContent.toString('base64') }), {
            headers: { "Content-Type": "application/json", ...headers }
        });

      } catch (error: any) {
        console.error("TTS Error:", error);
        return new Response(JSON.stringify({ error: error.message || "TTS Failed" }), { status: 500, headers });
      }
    }

    // --- API: Chat Streaming ---
    if (url.pathname === "/api/chat" && req.method === "POST") {
      try {
        const body = await req.json();
        const { message, history } = body;

        if (!API_KEY) {
          return new Response(JSON.stringify({ error: "API Key missing" }), { status: 500, headers });
        }

        const client = new GoogleGenAI({ apiKey: API_KEY });

        const formattedHistory = (history || []).map((msg: any) => ({
          role: msg.role === 'assistant' ? 'model' : msg.role,
          parts: [{ text: msg.text }]
        }));

        formattedHistory.push({ role: 'user', parts: [{ text: message }] });

        const result = await client.models.generateContentStream({
          model: 'gemini-2.0-flash', 
          contents: formattedHistory,
          config: {
            systemInstruction: contextConfig.systemInstruction,
          }
        });

        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            try {
              const streamResult = result as any;
              const streamIterable = streamResult.stream || streamResult;

              for await (const chunk of streamIterable) {
                const chunkText = typeof chunk.text === 'function' ? chunk.text() : chunk.text;
                if (chunkText) {
                  controller.enqueue(encoder.encode(chunkText));
                }
              }
              controller.close();
            } catch (e) {
              console.error("Stream Error:", e);
              controller.error(e);
            }
          }
        });

        return new Response(stream, {
          headers: {
            ...headers,
            "Content-Type": "text/plain; charset=utf-8"
          }
        });

      } catch (error: any) {
        console.error("Chat API Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
      }
    }

    // --- API: Context ---
    if (url.pathname === "/api/context") {
      const context = getKnowledgeContext();
      return Response.json({ context }, { headers });
    }

    // --- Static Assets ---
    const distDir = path.resolve("dist");
    let filePath = path.join(distDir, url.pathname === "/" ? "index.html" : url.pathname.substring(1));

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return new Response(Bun.file(filePath));
    }

    const indexHtml = path.join(distDir, "index.html");
    if (fs.existsSync(indexHtml)) {
      return new Response(Bun.file(indexHtml));
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at http://localhost:${server.port}`);