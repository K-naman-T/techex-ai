import type { ServerWebSocket } from "bun";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI, Modality } from "@google/genai";

// --- Concurrency tracking ---
let activeGeminiSessions = 0;

// --- Singleton clients (avoid re-instantiation per request) ---
let _genAI: GoogleGenerativeAI | null = null;
let _liveAI: GoogleGenAI | null = null;

function getGenAI(apiKey: string): GoogleGenerativeAI {
  if (!_genAI) _genAI = new GoogleGenerativeAI(apiKey);
  return _genAI;
}

function getLiveAI(apiKey: string): GoogleGenAI {
  if (!_liveAI) _liveAI = new GoogleGenAI({ apiKey });
  return _liveAI;
}

// types
type WSContext = {
  userId: string;
  geminiLiveSession?: any;
};

export const handleWSMessage = async (
  ws: ServerWebSocket<WSContext>,
  message: string | Buffer,
  config: {
    geminiKey: string;
    projectsContext: string;
    eventInfo: any;
  }
) => {
  const ctx = ws.data;

  try {
    const msg = JSON.parse(message.toString());

    switch (msg.type) {
      case "chat":
        await handleChatStream(ws, msg, config);
        break;

      // ========== GEMINI LIVE API (Voice) ==========
      case "start_gemini_live":
        await initGeminiLive(ws, config, msg.language || "hi", msg.userMetadata);
        break;

      case "gemini_audio_in":
        if (ctx.geminiLiveSession) {
          try {
            ctx.geminiLiveSession.sendRealtimeInput({
              media: {
                data: msg.data, // already base64
                mimeType: "audio/pcm;rate=16000",
              },
            });
          } catch (e: any) {
            console.error("[Gemini Live] sendRealtimeInput error:", e.message || e);
          }
        } else {
          console.warn("[Gemini Live] No active session for audio_in");
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
};

// ========================================================================
// GEMINI LIVE API (Unified Audio-in Audio-out)
// ========================================================================
async function initGeminiLive(
  ws: ServerWebSocket<WSContext>,
  config: any,
  language: string,
  userMetadata?: { name: string; interests: string[] }
) {
  const ctx = ws.data;

  // Close any existing session first
  if (ctx.geminiLiveSession) {
    try {
      activeGeminiSessions = Math.max(0, activeGeminiSessions - 1);
      ctx.geminiLiveSession.close();
    } catch (e) { }
    ctx.geminiLiveSession = undefined;
  }

  const ai = getLiveAI(config.geminiKey);

  const languageInstruction = language === 'hinglish'
    ? `Respond in Hinglish (Hindi-English code-mixing). Use Hindi as the base language with Devanagari script, but freely use common English words and phrases that are naturally used in everyday Hindi conversations (e.g., "phone", "okay", "sorry", "thanks", "meeting", "project"). Do NOT respond in pure Hindi or pure English. Use feminine verb forms (मैं आपकी मदद करूँगी, मैं बताती हूँ). Stick to this language unless the user explicitly asks to switch.`
    : language === 'hi'
      ? `आपको हिंदी (देवनागरी लिपि) में बोलना है। स्त्रीलिंग क्रिया रूपों का प्रयोग करें (मैं आपकी मदद करूँगी, मैं बताती हूँ)। जब तक user न कहे तब तक यही भाषा में बोलें।`
      : `Respond ONLY in English. Use feminine phrasing where appropriate. Stick to English unless the user explicitly asks to switch languages.`;

  // COST: Knowledge base placed FIRST to trigger implicit caching (75% discount)
  // PERSONALIZATION: Greet user by name and mention interests
  const greeting = userMetadata?.name
    ? `Hello ${userMetadata.name}! Welcome to TechEx 2026. I see you're interested in ${userMetadata.interests.join(", ")}. Let's explore the exhibits together!`
    : "Hello! Welcome to TechEx 2026. How can I help you today?";

  const systemInstruction = `
Knowledge Base:
${config.projectsContext}

You are the AI Assistant for ${config.eventInfo?.name || "TechEx"}.
Location: ${config.eventInfo?.location || "Event Venue"}. Date: ${config.eventInfo?.date || "Today"}.
${config.eventInfo?.description || ""}

${userMetadata?.name ? `User: ${userMetadata.name}. Interests: ${userMetadata.interests.join(", ")}.` : ""}

You have a warm, friendly, and helpful female persona. Use feminine language markers appropriate to the response language.
STRICT RESPONSE GUIDELINES:
1. Start with this greeting: "${greeting}"
2. Respond in PLAIN TEXT ONLY.
3. NO MARKDOWN. NO BOLD. NO ITALICS. NO HEADERS.
4. Keep it brief: 2-3 sentences max.
5. When giving directions to a stall or project, you MUST append [SHOW_MAP: <StallNumber>] at the end of your response. Example: "The drone project is at Stall A-01 in Zone A [SHOW_MAP: A-01]". Always include the stall number.
${languageInstruction}
Stick to the language specified above unless the user explicitly asks you to switch languages.
`;

  const model = "gemini-2.5-flash-native-audio-preview-12-2025"; // Flagship Live API model as requested
  const liveConfig = {
    responseModalities: [Modality.AUDIO],
    systemInstruction: systemInstruction,
    speechConfig: {
      voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
    },
    realtimeInputConfig: {
      automaticActivityDetection: {
        startOfSpeechSensitivity: "START_SENSITIVITY_HIGH",
        endOfSpeechSensitivity: "END_SENSITIVITY_HIGH",
      },
      activityHandling: "START_OF_ACTIVITY_INTERRUPTS",
      turnCoverage: "TURN_INCLUDES_ALL_INPUT",
    },
    maxOutputTokens: 256,
    thinkingConfig: {
      thinkingBudget: 0,
    },
  };

  console.log("[Gemini Live] Connecting to session with model:", model);


  let fullText = ''; // Accumulate text across chunks for [SHOW_MAP] parsing

  try {
    const session = await ai.live.connect({
      model: model,
      config: liveConfig,
      callbacks: {
        onopen: () => {
          activeGeminiSessions++;
          console.log(`[Gemini Live] WebSocket connected. Active sessions: ${activeGeminiSessions}`);
          ws.send(JSON.stringify({ type: "gemini_live_ready" }));
        },
        onmessage: (message: any) => {
          // console.log("[RAW]", JSON.stringify(message).substring(0, 300)); // Debug log disabled

          if (message.setupComplete) {
            console.log("[Gemini Live] Setup complete, session ID:", message.setupComplete?.sessionId || "N/A");

            // Send an initial hidden text prompt to trigger the AI to actually speak its greeting 
            try {
              session.sendClientContent({
                turnComplete: true,
                turns: [{
                  role: "user",
                  parts: [{ text: "Hello! Please greet me now according to your system instructions." }]
                }]
              });
            } catch (err: any) {
              console.error("[Gemini Live] Error sending initial trigger:", err.message);
            }
            return;
          }

          if (message.serverContent?.interrupted) {
            ws.send(JSON.stringify({ type: "gemini_live_interrupted" }));
            return;
          }

          if (message.serverContent?.modelTurn?.parts) {
            for (const part of message.serverContent.modelTurn.parts) {
              // 1. Skip explicit "thought" parts if the API provides them
              if (part.thought) continue;

              if (part.inlineData?.data) {
                ws.send(JSON.stringify({
                  type: "audio_out",
                  data: part.inlineData.data,
                }));
              }
              if (part.text) {
                // 2. Aggressive filter for any leftover thinking/markdown tags
                const cleanText = part.text
                  .replace(/<thought>[\s\S]*?<\/thought>/gi, '') // Standard tags
                  .replace(/\*\*.*?\*\*/g, '') // Bold
                  .replace(/##.*?\n/g, '') // Headers
                  .trim();

                if (cleanText) {
                  fullText += cleanText;
                  // Strip [SHOW_MAP:...] before sending to client display
                  const displayText = cleanText.replace(/\[SHOW_MAP:\s*[A-Za-z0-9-]+\]/g, '').trim();
                  if (displayText) {
                    ws.send(JSON.stringify({
                      type: "chat_delta",
                      text: displayText,
                    }));
                  }
                }
              }
            }
          }

          if (message.serverContent?.turnComplete) {
            // Parse accumulated text for [SHOW_MAP] tags
            const mapMatches = fullText.match(/\[SHOW_MAP:\s*([A-Za-z0-9-]+)\]/g);
            if (mapMatches && mapMatches.length > 0) {
              const lastMatch = mapMatches[mapMatches.length - 1];
              const stallId = lastMatch.match(/\[SHOW_MAP:\s*([A-Za-z0-9-]+)\]/)?.[1];
              if (stallId) {
                ws.send(JSON.stringify({ type: 'show_map', stallId }));
              }
            }
            fullText = ''; // Reset for next turn
            ws.send(JSON.stringify({ type: "gemini_live_turn_complete" }));
          }
        },
        onerror: (e: any) => {
          console.error("[Gemini Live] Error:", e.message || e);
          ws.send(JSON.stringify({ type: "error", message: `Gemini Live error: ${e.message || e}` }));
        },
        onclose: (e: any) => {
          activeGeminiSessions = Math.max(0, activeGeminiSessions - 1);
          console.log(`[Gemini Live] Session closed. Active sessions: ${activeGeminiSessions}. Code:`, e?.code, "Reason:", e?.reason || "unknown");
          ctx.geminiLiveSession = undefined;
        },
      },
    });

    ctx.geminiLiveSession = session;
  } catch (e: any) {
    console.error("[Gemini Live] Failed to connect:", e);
    ws.send(JSON.stringify({ type: "error", message: `Gemini Live init error: ${e.message}` }));
  }
}

// ========================================================================
// Text Chat (Gemini Flash — text only, no TTS)
// ========================================================================
async function handleChatStream(ws: ServerWebSocket<WSContext>, msg: any, config: any) {
  const { message, history, language = 'en', userMetadata = {} } = msg;
  const { userName, interests = [] } = userMetadata;

  console.log(`[Chat] 📩 User${userName ? ` (${userName})` : ''}: "${message}"`);

  const genAI = getGenAI(config.geminiKey);
  const languageInstruction = language === 'hinglish'
    ? `**भाषा:** Hinglish (Hindi-English code-mixing) में जवाब दें। Hindi base language रखें Devanagari script में, लेकिन common English words freely use करें। Do NOT respond in pure Hindi or pure English. स्त्रीलिंग क्रिया रूपों का प्रयोग करें (मैं आपकी मदद करूँगी, मैं बताती हूँ)।`
    : language === 'hi'
      ? `**भाषा:** आपको केवल हिंदी (देवनागरी लिपि) में उत्तर देना है। स्त्रीलिंग क्रिया रूपों का प्रयोग करें (मैं आपकी मदद करूँगी, मैं बताती हूँ)। संख्याओं को हिंदी में लिखें।`
      : `**Language:** Respond ONLY in English. Use feminine phrasing where appropriate. Write numbers naturally.`;

  const userContext = userName
    ? `You are talking to ${userName}. ${interests.length > 0 ? `They are interested in: ${interests.join(', ')}.` : ''}`
    : '';

  // COST: Knowledge base placed FIRST to trigger implicit caching (75% discount)
  const systemInstruction = `
**Knowledge Base:**
${config.projectsContext}

You are the AI Assistant for **${config.eventInfo?.name || "TechEx"}**.
Location: ${config.eventInfo?.location || "Event Venue"}. Date: ${config.eventInfo?.date || "Today"}.
${config.eventInfo?.description || ""}

${userContext}

**STRICT RESPONSE GUIDELINES:**
1. Punctuation: Use frequent periods and commas for clarity.
2. Brevity: Max 2-3 sentences.
3. Navigation: If asked for location, append [SHOW_MAP: <StallNumber>].
4. NO MARKDOWN: Respond in plain text only. Do not use bold, italics, or hashtags.
${languageInstruction}
`;

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash", // Use stable model for text chat
    systemInstruction: systemInstruction,
  });

  // COST: Truncate history — last 4 messages, 200 chars each
  let recentHistory = (history || []).map((h: any) => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: (h.content || '').substring(0, 200) }]
  })).slice(-4);

  const chat = model.startChat({ history: recentHistory });
  const result = await chat.sendMessageStream(message);

  let fullText = "";
  for await (const chunk of result.stream) {
    const delta = chunk.text();
    if (delta) {
      // Filter out any thinking/markdown artifacts
      const cleanDelta = delta
        .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
        .replace(/\*\*.*?\*\*/g, '')
        .replace(/##.*?\n/g, '')
        .trim();

      if (cleanDelta) {
        fullText += cleanDelta;
        // Strip [SHOW_MAP:...] before sending to client display
        const displayDelta = cleanDelta.replace(/\[SHOW_MAP:\s*[A-Za-z0-9-]+\]/g, '').trim();
        if (displayDelta) {
          ws.send(JSON.stringify({ type: "chat_delta", text: displayDelta }));
        }
      }
    }
  }
  // Parse accumulated text for [SHOW_MAP] tags
  const mapMatches = fullText.match(/\[SHOW_MAP:\s*([A-Za-z0-9-]+)\]/g);
  if (mapMatches && mapMatches.length > 0) {
    const lastMatch = mapMatches[mapMatches.length - 1];
    const stallId = lastMatch.match(/\[SHOW_MAP:\s*([A-Za-z0-9-]+)\]/)?.[1];
    if (stallId) {
      ws.send(JSON.stringify({ type: 'show_map', stallId }));
    }
  }

  const cleanFullText = fullText.replace(/\[SHOW_MAP:\s*[A-Za-z0-9-]+\]/g, '').trim();
  console.log(`[Chat] \uD83E\uDD16 Gemini: "${cleanFullText.substring(0, 200)}${cleanFullText.length > 200 ? '...' : ''}"`);
  ws.send(JSON.stringify({ type: "chat_complete", text: cleanFullText }));
}
