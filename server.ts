import { serve } from "bun";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { Buffer } from "node:buffer";
import { GoogleGenerativeAI } from "@google/generative-ai";

const DB_PATH = path.join(process.cwd(), "data", "db.json");
const API_KEY = process.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || "");
if (!API_KEY) {
  console.error("Error: VITE_GEMINI_API_KEY is missing in .env");
  process.exit(1);
} else {
  console.log(`[INIT] Gemini API Key found: ${API_KEY.substring(0, 4)}...${API_KEY.substring(API_KEY.length - 4)}`);
}
const ELEVENLABS_API_KEY = process.env.VITE_ELEVENLABS_API_KEY || "";
const SARVAM_API_KEY = process.env.VITE_SARVAM_API_KEY || "";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Error: DATABASE_URL is missing in .env");
  process.exit(1);
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Error: Supabase credentials missing in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Database Setup (PostgreSQL) ---
const sql = postgres(DATABASE_URL, {
  ssl: 'require', // Required for Supabase
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Initialize Schema (using Postgres syntax with UUID as TEXT)
try {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, -- Stores Supabase User UUID
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      title TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT,
      content TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_configs (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      voice_provider TEXT DEFAULT 'elevenlabs',
      voice_id TEXT,
      stt_language TEXT DEFAULT 'en-IN'
    );
  `;
  console.log("[DB] PostgreSQL Database initialized and schema verified.");
} catch (error) {
  console.error("[DB] Error initializing schema:", error);
}

// --- Helper: Verify Auth & Sync User (TEMPORARILY BYPASSED) ---
const GUEST_USER = {
  id: "guest-user",
  email: "guest@example.com",
  user_metadata: { full_name: "Guest User" }
};

// One-time Sync for Guest User at startup
try {
  await sql`
    INSERT INTO users (id, email, name)
    VALUES (${GUEST_USER.id}, ${GUEST_USER.email}, ${GUEST_USER.user_metadata.full_name})
    ON CONFLICT (id) DO NOTHING
  `;
  console.log("[DB] Guest user synced at startup.");
} catch (e) {
  console.error("[DB] Guest sync failed:", e);
}

async function authenticate(req: Request) {
  // Near-instant return for guest
  return GUEST_USER;
}

// --- RAG: Vector Store Implementation ---
class LocalVectorStore {
  documents: any[] = [];
  embeddings: number[][] = [];

  constructor() { }

  similarity(vecA: number[], vecB: number[]) {
    if (!vecA || !vecB || vecA.length === 0 || vecA.length !== vecB.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      const a = vecA[i] ?? 0;
      const b = vecB[i] ?? 0;
      dot += a * b;
      normA += a * a;
      normB += b * b;
    }
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dot / magnitude;
  }

  async addDocuments(docs: any[]) {
    this.documents = docs;
    console.log(`[RAG] Generating embeddings for ${docs.length} documents...`);

    for (const doc of docs) {
      const textToEmbed = `Title: ${doc.title}. Category: ${doc.category}. Description: ${doc.description}. Keywords: ${doc.team_name}`;
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const result = await model.embedContent(textToEmbed);
        const embedding = result.embedding.values;

        if (embedding) {
          this.embeddings.push(embedding);
        } else {
          console.warn("[RAG] Failed to embed:", doc.title);
          this.embeddings.push(new Array(768).fill(0));
        }
      } catch (e) {
        console.error("[RAG] Embedding Error:", e);
        this.embeddings.push([]);
      }
      // Small delay to avoid rate limits on startup
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log(`[RAG] Indexing complete.`);
  }

  async search(query: string, topK: number = 3) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
      const result = await model.embedContent(query);
      const queryEmbedding = result.embedding.values;

      if (!queryEmbedding) return [];

      const scores = this.embeddings.map((emb, idx) => ({
        index: idx,
        score: this.similarity(queryEmbedding, emb)
      }));

      scores.sort((a, b) => b.score - a.score);
      return scores.slice(0, topK).map(s => this.documents[s.index]);
    } catch (e) {
      console.error("[RAG] Search Error:", e);
      return [];
    }
  }
}

const vectorStore = new LocalVectorStore();
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

    // Efficiency: Pre-build context string to save per-request CPU
    projectsContext = projects.map((p: any) =>
      `Project: ${p.title} | Stall: ${p.stall_number} | Category: ${p.category} | Description: ${p.description}`
    ).join("\n");

    console.log(`[INIT] Knowledge base loaded. ${projects.length} projects cached.`);
  } catch (error) {
    console.error("[INIT] Failed to load knowledge base:", error);
  }
};

// Start server IMMEDIATELY, fetch KB in background
const server = serve({
  port: process.env.PORT || 3005,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    // Lazy load KB if background fetch hasn't finished
    if (!projectsContext) await initKnowledgeBase();

    if (req.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    // --- API: Auth (DEPRECATED - Moved to Supabase Frontend) ---
    if (url.pathname.startsWith("/api/auth/")) {
      return new Response(JSON.stringify({ error: "Deprecated. Use Supabase SDK on frontend." }), { status: 410, headers });
    }

    // --- API: User Config (Get/Update) ---
    if (url.pathname === "/api/user/config" && req.method === "POST") {
      try {
        const user = await authenticate(req);
        if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
        const userId = user.id;

        const { voice_provider, voice_id, stt_language } = await req.json() as any;

        // Upsert Config in Postgres
        const [current] = await sql`SELECT * FROM user_configs WHERE user_id = ${userId}`;
        const config = {
          user_id: userId,
          voice_provider: voice_provider || current?.voice_provider || 'elevenlabs',
          voice_id: voice_id || current?.voice_id,
          stt_language: stt_language || current?.stt_language || 'en-IN'
        };

        await sql`
          INSERT INTO user_configs ${sql(config)}
          ON CONFLICT (user_id) DO UPDATE SET
            voice_provider = EXCLUDED.voice_provider,
            voice_id = EXCLUDED.voice_id,
            stt_language = EXCLUDED.stt_language
        `;

        return new Response(JSON.stringify({ message: "Config updated" }), { headers });
      } catch (error) {
        console.error("[CONFIG] Error:", error);
        return new Response(JSON.stringify({ error: "Failed to update config" }), { status: 500, headers });
      }
    }

    // --- API: Conversations (List/Create) ---
    if (url.pathname === "/api/conversations" && req.method === "GET") {
      try {
        const user = await authenticate(req);
        if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
        const userId = user.id;

        const conversations = await sql`SELECT * FROM conversations WHERE user_id = ${userId} ORDER BY created_at DESC`;
        return new Response(JSON.stringify(conversations), { headers });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Failed to fetch conversations" }), { status: 500, headers });
      }
    }

    if (url.pathname === "/api/conversations" && req.method === "DELETE") {
      try {
        const user = await authenticate(req);
        if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
        const userId = user.id;

        const id = url.searchParams.get("id");
        if (!id) return new Response(JSON.stringify({ error: "Missing ID" }), { status: 400, headers });

        // Verify ownership
        const [conv] = await sql`SELECT * FROM conversations WHERE id = ${id} AND user_id = ${userId}`;
        if (!conv) return new Response(JSON.stringify({ error: "Not found or access denied" }), { status: 403, headers });

        await sql`DELETE FROM conversations WHERE id = ${id}`;
        return new Response(JSON.stringify({ message: "Deleted" }), { headers });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Delete failed" }), { status: 500, headers });
      }
    }

    if (url.pathname === "/api/conversations" && req.method === "PUT") {
      try {
        const user = await authenticate(req);
        if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
        const userId = user.id;

        const data = await req.json() as any;
        const { id, title } = data;
        if (!id || !title) return new Response(JSON.stringify({ error: "Missing ID or Title" }), { status: 400, headers });

        // Verify ownership
        const [conv] = await sql`SELECT * FROM conversations WHERE id = ${id} AND user_id = ${userId}`;
        if (!conv) return new Response(JSON.stringify({ error: "Not found or access denied" }), { status: 403, headers });

        await sql`UPDATE conversations SET title = ${title} WHERE id = ${id}`;
        return new Response(JSON.stringify({ message: "Updated" }), { headers });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Update failed" }), { status: 500, headers });
      }
    }

    if (url.pathname === "/api/conversations" && req.method === "POST") {
      try {
        const user = await authenticate(req);
        if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
        const userId = user.id;

        const data = await req.json() as any;
        const { title } = data;
        const [result] = await sql`INSERT INTO conversations (user_id, title) VALUES (${userId}, ${title || "New Chat"}) RETURNING id`;

        if (!result) throw new Error("Failed to insert conversation");

        return new Response(JSON.stringify({ id: result.id, title: title || "New Chat" }), { headers });
      } catch (e) {
        console.error("Failed to create conversation:", e);
        return new Response(JSON.stringify({ error: "Failed to create conversation" }), { status: 500, headers });
      }
    }

    // --- API: Messages (Get) ---
    if (url.pathname.startsWith("/api/messages") && req.method === "GET") {
      try {
        const user = await authenticate(req);
        if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
        const userId = user.id;

        const conversationId = url.searchParams.get("conversation_id");
        if (!conversationId) return new Response(JSON.stringify({ error: "Missing conversation_id" }), { status: 400, headers });

        // Verify ownership of the conversation
        const [conv] = await sql`SELECT * FROM conversations WHERE id = ${conversationId} AND user_id = ${userId}`;
        if (!conv) return new Response(JSON.stringify({ error: "Not found or access denied" }), { status: 403, headers });

        const msgs = await sql`SELECT * FROM messages WHERE conversation_id = ${conversationId} ORDER BY created_at ASC`;
        return new Response(JSON.stringify(msgs), { headers });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Failed to fetch messages" }), { status: 500, headers });
      }
    }

    // --- API: TTS (Multi-Provider) ---
    if (url.pathname === "/api/tts" && req.method === "POST") {
      try {
        const { text, provider = 'sarvam' } = await req.json() as { text: string, provider?: string };
        if (!text) return new Response(JSON.stringify({ error: "Text missing" }), { status: 400, headers });

        let audioBuffer: Buffer;

        // Detect if text contains Hindi (Devanagari script)
        const containsHindi = /[\u0900-\u097F]/.test(text);

        // Auto-select provider based on language if 'auto' mode
        // Defaulting to Sarvam for Hindi, but allowing auto-selection
        let effectiveProvider = provider;
        if (provider === 'auto') {
          effectiveProvider = containsHindi ? 'sarvam' : 'elevenlabs';
          console.log(`[TTS] Auto-detected language: ${containsHindi ? 'Hindi' : 'English'}, using ${effectiveProvider}`);
        }

        if (effectiveProvider === 'elevenlabs') {
          // ElevenLabs Logic - use multilingual_v2 for better language support
          if (!ELEVENLABS_API_KEY) throw new Error("ElevenLabs API Key missing");
          // "Sonu" - Multilingual Indian Male Voice (Available in library/premade)
          const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "pzxut4zZz4GImZNlqQ3H";
          const elevenUrl = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

          const response = await fetch(elevenUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'xi-api-key': ELEVENLABS_API_KEY
            },
            body: JSON.stringify({
              text: text,
              model_id: "eleven_multilingual_v2",  // Multilingual model helps with accent/naturalness
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
                speed: 1.1
              }
            })
          });

          if (!response.ok) {
            const err = await response.json();
            console.error("[TTS] ElevenLabs Error:", err);
            throw new Error(`ElevenLabs Error: ${JSON.stringify(err)}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          audioBuffer = Buffer.from(arrayBuffer);

        } else {
          // Sarvam AI Logic - for pure Hindi
          if (!SARVAM_API_KEY) throw new Error("Sarvam AI API Key missing");

          const sarvamUrl = "https://api.sarvam.ai/text-to-speech";
          const response = await fetch(sarvamUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'api-subscription-key': SARVAM_API_KEY
            },
            body: JSON.stringify({
              inputs: [text],
              target_language_code: "hi-IN",
              speaker: "ratan",
              pace: 1.0,
              model: "bulbul:v3",
              enable_preprocessing: true, // Explicitly enable smart normalization
              temperature: 0.6            // Default recommended for naturalness
            })
          });

          if (!response.ok) {
            const err = await response.json();
            console.error("[TTS] Sarvam Error:", err);
            throw new Error(`Sarvam Error: ${JSON.stringify(err)}`);
          }

          const data = await response.json() as { audios: string[] };
          if (data.audios && data.audios[0]) {
            audioBuffer = Buffer.from(data.audios[0], 'base64');
          } else {
            throw new Error("Sarvam returned no audio");
          }
        }

        return new Response(JSON.stringify({ audioContent: audioBuffer.toString('base64') }), {
          headers: { "Content-Type": "application/json", ...headers }
        });

      } catch (error: any) {
        console.error("TTS Error:", error);
        return new Response(JSON.stringify({ error: error.message || "TTS Failed" }), { status: 500, headers });
      }
    }

    // --- API: Chat with RAG (Updated) ---
    if (url.pathname === "/api/chat" && req.method === "POST") {
      try {
        const user = await authenticate(req);
        if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
        const userId = user.id;

        const body = await req.json() as { message: string, history: any[], conversation_id?: number, language?: string };
        const { message, history, conversation_id, language = 'en' } = body;

        // Persist User Message if conversation_id exists & belongs to user
        if (conversation_id) {
          try {
            // Verify ownership
            const [conv] = await sql`SELECT * FROM conversations WHERE id = ${conversation_id} AND user_id = ${userId}`;
            if (conv) {
              await sql`INSERT INTO messages (conversation_id, role, content) VALUES (${conversation_id}, 'user', ${message || ""})`;
            } else {
              console.warn(`[CHAT] Unauthorized access attempt for conversation ${conversation_id} by user ${userId}`);
            }
          } catch (e) { console.error("Failed to save user message", e); }
        }

        if (!API_KEY) {
          return new Response(JSON.stringify({ error: "API Key missing" }), { status: 500, headers });
        }

        // --- PRODUCTION HARDENING ---
        // Direct Context Injection is faster and more reliable than vector search for this size.
        const contextString = projectsContext || "No project data available.";

        // Language-specific instruction for TTS compatibility
        const languageInstruction = language === 'hi'
          ? `**भाषा:** आपको केवल शुद्ध हिंदी (देवनागरी लिपि) में उत्तर देना है। अंग्रेजी शब्दों का प्रयोग न करें। संख्याओं को हिंदी में लिखें (उदाहरण: 2026 को "दो हज़ार छब्बीस" लिखें)।`
          : `**Language:** Respond ONLY in English. Do not mix Hindi words. Write numbers naturally (e.g., "2026" as "twenty twenty-six" or "two thousand twenty-six").`;

        const systemInstruction = `
You are the AI Avatar for **${eventInfo.name || 'TechEx'}**.
Location: ${eventInfo.location}. Date: ${eventInfo.date}.
${eventInfo.description}

**STRICT RESPONSE GUIDELINES:**
1. **Punctuation:** Use frequent periods and commas for natural speech.
2. **Brevity:** Max 2-3 sentences.
3. **Navigation:** If asked for location, append [SHOW_MAP: <StallNumber>].
${languageInstruction}

**Knowledge Base:**
${contextString}
`;
        const model = genAI.getGenerativeModel({
          model: "gemini-2.0-flash",
          systemInstruction: systemInstruction,
        });

        // Use reduced history for context window
        // Standardize and filter history
        let recentHistory = (history || []).map((msg: any) => {
          const text = msg.content || msg.message || msg.text || "";
          return {
            role: (msg.role === 'user' || msg.type === 'user') ? 'user' : 'model',
            parts: [{ text: String(text) }]
          };
        }).filter(h => h.parts && h.parts.length > 0 && h.parts[0]?.text);

        // Gemini history MUST start with 'user'. Find first user message.
        const firstUserIdx = recentHistory.findIndex(h => h.role === 'user');
        if (firstUserIdx !== -1) {
          recentHistory = recentHistory.slice(firstUserIdx);
        } else {
          recentHistory = [];
        }

        // Limit window and ensure it still starts with 'user'
        recentHistory = recentHistory.slice(-6);
        if (recentHistory.length > 0 && recentHistory[0]?.role === 'model') {
          recentHistory = recentHistory.slice(1);
        }

        console.log(`[CHAT] Calling Gemini with message: "${(message || "").substring(0, 50)}..." and ${recentHistory.length} history items`);

        const chat = model.startChat({
          history: recentHistory,
          generationConfig: {
            maxOutputTokens: 250,
            temperature: 0.7,
          },
        });

        const result = await chat.sendMessage(message);
        const response = result.response.text();

        // Persist AI Message if conversation_id exists
        if (conversation_id) {
          try {
            await sql`INSERT INTO messages (conversation_id, role, content) VALUES (${conversation_id}, 'ai', ${response || ""})`;
          } catch (e) { console.error("Failed to save ai message", e); }
        }

        return new Response(JSON.stringify({ response }), { headers });

      } catch (error: any) {
        console.error("[CHAT] Gemini API Error:", error);
        let errorMsg = error.message || "Chat Failed";
        if (errorMsg.includes("typo in the url")) {
          errorMsg = "Network error: Could not reach Gemini API. Please check your internet connection.";
        }
        return new Response(JSON.stringify({ error: errorMsg }), { status: 500, headers });
      }
    }



    if (url.pathname === "/api/context") {
      return Response.json({ context: "Legacy endpoint" }, { headers });
    }

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
console.log(`Accessible on network at http://10.118.106.21:${server.port}`);