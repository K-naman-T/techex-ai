import type { ServerWebSocket } from "bun";
import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { WSContext } from "../../server";
import { ApiKeyManager } from "../lib/apiKeyManager";

const MAX_CONNECT_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const MAX_RECONNECT_ATTEMPTS = 2;

export class VoiceChatService {
    constructor(private apiKeyManager: ApiKeyManager) { }

    /**
     * Initializes a new Gemini Live session on a WebSocket request.
     * Includes contextWindowCompression, sessionResumption, GoAway handling, and retry logic.
     */
    private projectsData: any[] = [];
    private eventData: any = {};
    private compactKB: string = "";

    public setProjectsData(projects: any[]) {
        this.projectsData = projects;
    }

    public setEventData(event: any) {
        this.eventData = event;
        // Full knowledge base: event info (branding, themes, endorsements) + all projects
        this.compactKB = JSON.stringify({ event, projects: this.projectsData }, null, 0);
    }

    public async initSession(
        ws: ServerWebSocket<WSContext>,
        config: {
            getProjectsContext: () => string;
            getEventInfo: () => any;
        },
        userMetadata: any = {},
        isFirstTime: boolean = false
    ) {
        const ctx = ws.data;

        // Close existing connection if any
        if (ctx.geminiLiveSession) {
            try {
                ctx.geminiLiveSession.close();
            } catch (e) {
                console.warn("[VoiceChatService] Error closing previous session:", e);
            }
        }

        console.log(`[VoiceChatService] Connecting Live API for user: ${userMetadata?.name || 'Anonymous'}`);

        const userContext = userMetadata?.name
            ? `You are talking to ${userMetadata.name}. ${userMetadata.interests?.length > 0
                ? `They are interested in: ${userMetadata.interests.join(", ")}.`
                : ""
            }`
            : "";

        // Dynamic greeting — only on FIRST connection
        const greeting = isFirstTime
            ? userMetadata?.name
                ? `This is your FIRST interaction. Greet them warmly: "Hello ${userMetadata.name}! Welcome to TechEx 2026. How can I help you today?"`
                : `This is your FIRST interaction. Greet them warmly: "Hello! Welcome to TechEx 2026. How can I help you today?"`
            : "Do NOT greet. Respond directly to the user's input.";

        const langInstruction = `**[LANGUAGE & VOICE - CRITICAL RULES]**
1. **LANGUAGE: Mirror the user's language.**
   - If user speaks pure English → respond in pure English
   - If user speaks pure Hindi → respond in Hindi (you can naturally use common English words like ticket, stall, book, hall, project, etc.)
   - If user mixes Hindi + English words (Hinglish) → respond in Hinglish
   - Match whatever language mix the user uses — do NOT change it
   - NEVER respond in Hindi for pure English queries

2. **EXAMPLES - FOLLOW EXACTLY:**
   - User: "Where is stall A-01?" → Response: English ONLY
   - User: "What time does it open?" → Response: English ONLY
   - User: "Tell me about the event" → Response: English ONLY
   - User: "Ticket kaise book karna hai?" → Response: Hinglish OK
   - User: "Ye stall kahan hai?" → Response: Hindi OK (can say "stall", "A-01", etc.)

3. **VOICE & ACCENT - CRITICAL:**
   - ALWAYS speak with a strong Indian English accent, even when speaking pure English
   - Pronounce English words the way an educated Indian professional would — NOT with an American accent
   - Think of how a senior Indian IT professional or a news anchor from NDTV speaks English
   - No American twang, no rising inflections, no Western pronunciation
   - This applies to ALL responses — English, Hindi, and Hinglish
   - Tone: Friendly but professional for a business event`;

        // Full inline KB in system instruction — language directive FIRST for maximum compliance
        const systemInstruction = `${langInstruction}

You are the AI Assistant for ${config.getEventInfo()?.name || "TechEx 2026"}.
You are a female assistant. Speak with a natural, professional tone.
Your output towards the user should be gender neutral.
NEVER mention Gemini, Google AI, or any AI model name. You are simply the TechEx 2026 Assistant.
${userContext}
${greeting}
Rules:
1. Keep replies to 2-3 short spoken sentences for quick answers. For detailed explanations, use 4-5 sentences max.
2. For complex topics, after 4-5 sentences, suggest: "For more details, you can also use the text chat!"
3. You know ALL about the exhibition AND all the stalls. Here is the complete knowledge base with full details:
${this.compactKB}
The knowledge base contains: event information (founding vision, 15-year history, key themes, trainee development journey, process framework, past project highlights, leadership endorsements, trainee testimonials) AND all 35 stall/project details.
Answer questions about stalls from the projects data. Answer questions about TechEx history, vision, themes, process framework, leadership quotes, or trainee experiences from the event data.
Only use show_map tool when the user explicitly asks for directions or wants to see a stall on the map.
For general conversation (greetings, thank you, how are you, etc.), just respond naturally — do NOT look up stalls.

REMINDER: Be helpful, accurate, and concise.`;

        // Store config for potential reconnection
        ctx.voiceInitConfig = { config, userMetadata, isFirstTime, systemInstruction };

        await this.connectWithRetry(ws, systemInstruction, ctx.sessionResumeHandle);
    }

    /**
     * Connects to Gemini Live with retry logic (exponential backoff for 429 / transient errors).
     */
    private async connectWithRetry(
        ws: ServerWebSocket<WSContext>,
        systemInstruction: string,
        resumeHandle?: string,
        attempt: number = 0
    ): Promise<void> {
        const ctx = ws.data;

        try {
            const apiKey = this.apiKeyManager.getNextKey();
            const ai = new GoogleGenAI({ apiKey });

            const session = await ai.live.connect({
                model: "gemini-2.5-flash-native-audio-preview-12-2025",
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: "Despina",
                            },
                        },
                    },
                    systemInstruction: {
                        parts: [{ text: systemInstruction }],
                    },
                    // Disable thinking for lower latency
                    thinkingConfig: { thinkingBudget: 0 },
                    // Only show_map tool — stall knowledge is inline in system instruction
                    tools: [
                        {
                            functionDeclarations: [
                                {
                                    name: "show_map",
                                    description: "Shows the indoor map highlighting a specific stall. Only call when user asks for directions or wants to see a stall location.",
                                    parameters: {
                                        type: Type.OBJECT,
                                        properties: {
                                            stallId: {
                                                type: Type.STRING,
                                                description: "The stall number (e.g., 'A-01', 'B-12').",
                                            },
                                        },
                                        required: ["stallId"],
                                    },
                                },
                            ],
                        },
                    ],
                    // Disable auto-VAD for noisy exhibition hall — push-to-talk controls turns
                    realtimeInputConfig: {
                        automaticActivityDetection: {
                            disabled: true,
                        },
                    },

                    // --- PRODUCTION HARDENING ---

                    // Extend session beyond 15 min by compressing older context at 10K tokens
                    contextWindowCompression: {
                        slidingWindow: {},
                        triggerTokens: "10000",
                    },

                    // Enable session resumption for seamless reconnection on GoAway/disconnect
                    sessionResumption: resumeHandle
                        ? { handle: resumeHandle }
                        : {},
                },
                callbacks: {
                    onmessage: (message: any) => {
                        // --- Session Resumption: capture latest handle ---
                        if (message.sessionResumptionUpdate) {
                            const update = message.sessionResumptionUpdate;
                            if (update.newHandle && update.resumable) {
                                ctx.sessionResumeHandle = update.newHandle;
                            }
                        }

                        // --- GoAway: server will disconnect soon, auto-reconnect ---
                        if (message.goAway) {
                            console.warn(`[VoiceChatService] ⚠️ GoAway received! Time left: ${message.goAway.timeLeft}. Will auto-reconnect.`);
                            ws.send(JSON.stringify({ type: "voice_reconnecting" }));

                            // Schedule reconnect before the connection drops
                            setTimeout(async () => {
                                try {
                                    if (ctx.geminiLiveSession === session) {
                                        try { session.close(); } catch (e) { }
                                        ctx.geminiLiveSession = undefined;
                                    }
                                    if (ctx.voiceInitConfig) {
                                        await this.connectWithRetry(
                                            ws,
                                            ctx.voiceInitConfig.systemInstruction,
                                            ctx.sessionResumeHandle
                                        );
                                    }
                                } catch (e) {
                                    console.error("[VoiceChatService] GoAway reconnect failed:", e);
                                    ws.send(JSON.stringify({ type: "error", message: "Voice session reconnection failed" }));
                                }
                            }, 500);
                        }

                        // Handle tool calls (only show_map now)
                        if (message.toolCall && message.toolCall.functionCalls) {
                            for (const call of message.toolCall.functionCalls) {
                                if (call.name === "show_map") {
                                    const stallId = call.args?.stallId;
                                    console.log(`[VoiceChatService] 🗺️ Map for stall: ${stallId}`);
                                    ws.send(JSON.stringify({ type: "show_map", stallId }));
                                    session.sendToolResponse({
                                        functionResponses: [{ name: call.name, id: call.id, response: { result: `Map shown.` } }]
                                    });
                                }
                            }
                        }

                        // Handle Audio Content natively
                        if (message.serverContent?.modelTurn?.parts) {
                            for (const part of message.serverContent.modelTurn.parts) {
                                // Check for Audio PCM base64
                                if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith("audio/pcm")) {
                                    const payload = JSON.stringify({
                                        type: "audio_out",
                                        data: part.inlineData.data,
                                    });
                                    const sent = ws.send(payload);
                                    if (sent === 0) {
                                        console.error("[VoiceChatService] ws.send dropped message (connection issue)");
                                    } else if (sent === -1) {
                                        console.warn("[VoiceChatService] ws.send hit backpressure queue");
                                    }
                                }
                            }
                        }

                        // Handle Turn Complete natively
                        if (message.serverContent?.turnComplete) {
                            ws.send(JSON.stringify({ type: "turn_complete" }));
                        }
                    },
                    onclose: (event: any) => {
                        const code = event?.code ?? event;
                        const reason = event?.reason || '';
                        console.log(`[VoiceChatService] Gemini disconnected. Code: ${code}, Reason: ${reason}`);
                        if (ctx.geminiLiveSession === session) {
                            ctx.geminiLiveSession = undefined;
                        }
                        // Auto-reconnect on unexpected disconnect (1011 = expected API timeout)
                        if (ctx.voiceInitConfig && ctx.sessionResumeHandle) {
                            const closeCode = event?.code || event;
                            if (closeCode === 1011 || closeCode === 1001) {
                                console.log(`[VoiceChatService] 🔄 Auto-reconnecting after close code ${closeCode}...`);
                                ctx.reconnectAttempts = (ctx.reconnectAttempts || 0) + 1;
                                if (ctx.reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
                                    ws.send(JSON.stringify({ type: "voice_reconnecting" }));
                                    setTimeout(async () => {
                                        try {
                                            await this.connectWithRetry(
                                                ws,
                                                ctx.voiceInitConfig!.systemInstruction,
                                                ctx.sessionResumeHandle
                                            );
                                        } catch (e) {
                                            console.error("[VoiceChatService] Auto-reconnect failed:", e);
                                            ws.send(JSON.stringify({ type: "error", message: "Voice reconnection failed" }));
                                        }
                                    }, 1000);
                                } else {
                                    console.warn("[VoiceChatService] Max reconnect attempts reached.");
                                    ws.send(JSON.stringify({ type: "error", message: "Voice session expired. Please restart." }));
                                }
                            }
                        }
                    },
                }
            });

            // Connection successful — reset reconnect counter
            ctx.reconnectAttempts = 0;

            // Bind to Context
            ctx.geminiLiveSession = session;

            ws.send(JSON.stringify({ type: "gemini_live_started" }));

            // NOTE: Do NOT send text-only sendClientContent to the native audio model.
            // It will reject it with 1007 "Cannot extract voices from a non-audio request".
            // The session is now open and waiting for microphone audio input from the client.

        } catch (e: any) {
            const isRetryable = e?.status === 429 || e?.status === 503 || e?.message?.includes("429") || e?.message?.includes("503");

            if (isRetryable && attempt < MAX_CONNECT_RETRIES - 1) {
                const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
                console.warn(`[VoiceChatService] ⚡ Retryable error (attempt ${attempt + 1}/${MAX_CONNECT_RETRIES}), retrying in ${Math.round(delay)}ms...`, e.message || e);
                await new Promise(r => setTimeout(r, delay));
                // Rotate to next key before retrying
                return this.connectWithRetry(ws, systemInstruction, resumeHandle, attempt + 1);
            }

            console.error("[VoiceChatService] Failed to establish Live API connection:", e);
            ws.send(JSON.stringify({ type: "error", message: "Failed to connect to AI Voice. Service may be busy — please try again." }));
        }
    }
}
