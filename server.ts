import { serve } from "bun";
import fs from "node:fs";
import path from "node:path";
import { Buffer } from "node:buffer";
import { GoogleGenAI } from "@google/genai";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";

// Credentials
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(process.cwd(), "google-credentials.json");
const DB_PATH = path.join(process.cwd(), "data", "db.json");
const API_KEY = process.env.VITE_GEMINI_API_KEY || "";
const ELEVENLABS_API_KEY = process.env.VITE_ELEVENLABS_API_KEY || "";
const SARVAM_API_KEY = process.env.VITE_SARVAM_API_KEY || "";

const ttsClient = new TextToSpeechClient();
const genAI = new GoogleGenAI({ apiKey: API_KEY });

// --- RAG: Vector Store Implementation ---
class LocalVectorStore {
  documents: any[] = [];
  embeddings: number[][] = [];

  constructor() { }

  similarity(vecA: number[], vecB: number[]) {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async addDocuments(docs: any[]) {
    this.documents = docs;
    console.log(`[RAG] Generating embeddings for ${docs.length} documents...`);

    for (const doc of docs) {
      const textToEmbed = `Title: ${doc.title}. Category: ${doc.category}. Description: ${doc.description}. Keywords: ${doc.team_name}`;
      try {
        const response = await genAI.models.embedContent({
          model: "text-embedding-004",
          contents: [{ parts: [{ text: textToEmbed }] }]
        });
        const embedding = response.embeddings?.[0]?.values || response.embedding?.values;
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
    }
    console.log(`[RAG] Indexing complete.`);
  }

  async search(query: string, topK: number = 3) {
    try {
      const response = await genAI.models.embedContent({
        model: "text-embedding-004",
        contents: [{ parts: [{ text: query }] }]
      });
      const queryVec = response.embeddings?.[0]?.values || response.embedding?.values;

      const scores = this.embeddings.map((emb, idx) => ({
        index: idx,
        score: this.similarity(queryVec, emb)
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

const initKnowledgeBase = async () => {
  if (!fs.existsSync(DB_PATH)) return;
  const rawData = fs.readFileSync(DB_PATH, "utf-8");
  const db = JSON.parse(rawData);
  eventInfo = db.events[0];
  const projects = db.projects || [];
  await vectorStore.addDocuments(projects);
};

initKnowledgeBase();

const server = serve({
  port: 3001,
  async fetch(req) {
    const url = new URL(req.url);

    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    // --- API: TTS (Multi-Provider) ---
    if (url.pathname === "/api/tts" && req.method === "POST") {
      try {
        const { text, provider = 'sarvam' } = await req.json();
        if (!text) return new Response(JSON.stringify({ error: "Text missing" }), { status: 400, headers });

        let audioBuffer: Buffer;

        if (provider === 'elevenlabs') {
          // ElevenLabs Logic
          if (!ELEVENLABS_API_KEY) throw new Error("ElevenLabs API Key missing");
          const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "Sxk6njaoa7XLsAFT7WcN";
          const elevenUrl = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

          const response = await fetch(elevenUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'xi-api-key': ELEVENLABS_API_KEY
            },
            body: JSON.stringify({
              text: text,
              model_id: "eleven_multilingual_v2",
              voice_settings: { stability: 0.5, similarity_boost: 0.75 }
            })
          });

          if (!response.ok) {
            const err = await response.json();
            throw new Error(`ElevenLabs Error: ${JSON.stringify(err)}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          audioBuffer = Buffer.from(arrayBuffer);

        } else if (provider === 'sarvam') {
            // Sarvam AI Logic
            if (!SARVAM_API_KEY) throw new Error("Sarvam API Key missing");

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
                    speaker: "amit",
                    pace: 0.95, // Optimized for clarity in kiosk environment
                    model: "bulbul:v3-beta"
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(`Sarvam Error: ${JSON.stringify(err)}`);
            }

            const data = await response.json();
            // Sarvam returns base64 in 'audios' array
            if (data.audios && data.audios[0]) {
                audioBuffer = Buffer.from(data.audios[0], 'base64');
            } else {
                throw new Error("Sarvam returned no audio");
            }

        } else {
          // Google Cloud Logic (Default)
          const request = {
            input: { text: text },
            voice: { languageCode: 'en-IN', name: 'en-IN-Neural2-B' },
            audioConfig: { audioEncoding: 'MP3' as const },
          };
          const [response] = await ttsClient.synthesizeSpeech(request);
          if (!response.audioContent) throw new Error("No audio content returned");
          audioBuffer = Buffer.from(response.audioContent);
        }

        return new Response(JSON.stringify({ audioContent: audioBuffer.toString('base64') }), {
          headers: { "Content-Type": "application/json", ...headers }
        });

      } catch (error: any) {
        console.error("TTS Error:", error);
        return new Response(JSON.stringify({ error: error.message || "TTS Failed" }), { status: 500, headers });
      }
    }

    // --- API: Chat with RAG ---
    if (url.pathname === "/api/chat" && req.method === "POST") {
      try {
        const body = await req.json();
        const { message, history } = body;

        if (!API_KEY) {
          return new Response(JSON.stringify({ error: "API Key missing" }), { status: 500, headers });
        }

        const relevantProjects = await vectorStore.search(message, 4);

        const contextString = relevantProjects.map(p =>
          `- Project: "${p.title}" (Stall ${p.stall_number})\n  Category: ${p.category}\n  Details: ${p.description}`
        ).join("\n\n");

        const systemInstruction = `

You are the AI Avatar for **${eventInfo.name || 'TechEx'}**.
Location: ${eventInfo.location}. Date: ${eventInfo.date}.
${eventInfo.description}

**ROLE:**
- Guide visitors to stalls.
- Explain projects clearly.
- Be concise (spoken output).

**RELEVANT KNOWLEDGE (From your database):**
${contextString}

**INSTRUCTIONS:**
- If the user asks about specific tech/projects, use the "RELEVANT KNOWLEDGE" above.
- If the knowledge above doesn't answer it, politely say you don't have info on that specific specific stall yet.
- Keep answers short (2 sentences max) unless asked to elaborate.
- DO NOT use markdown (*, #) in your output.
        `;

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
            systemInstruction: systemInstruction,
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