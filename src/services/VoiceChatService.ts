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
    private compactKB: string = "";

    public setProjectsData(projects: any[]) {
        this.projectsData = projects;
        // Full knowledge base as JSON for comprehensive context in system instruction
        this.compactKB = JSON.stringify(projects, null, 0);
    }

    public async initSession(
        ws: ServerWebSocket<WSContext>,
        config: {
            getProjectsContext: () => string;
            getEventInfo: () => any;
        },
        language: string = "hi",
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

        // Dynamic greeting based on language and user name
        const greeting = language === "hi"
            ? userMetadata?.name
                ? `When you start speaking, greet them warmly in Hindi with their name (e.g., "Namaste [Name]! Aapka swagat hai!").`
                : `When you start speaking, greet them warmly in Hindi (e.g., "Namaste! Aapka swagat hai!").`
            : language === "hinglish"
                ? userMetadata?.name
                    ? `When you start speaking, greet them warmly in Hinglish with their name (e.g., "Namaste [Name]! Kaise ho aap?").`
                    : `When you start speaking, greet them warmly in Hinglish (e.g., "Namaste! Kaise ho aap?").`
            : userMetadata?.name
                ? `When you start speaking, greet them warmly in English with their name (e.g., "Hello [Name]! Welcome to TechEx 2026! How can I help you?").`
                : `When you start speaking, greet them warmly in English (e.g., "Hello! Welcome to TechEx 2026! How can I help you?").`;

        const langInstruction =
            language === "hi"
                ? "Speak strictly in Hindi with a clear Indian Hindi accent. Your output must be localized for spoken Hindi."
                : language === "hinglish"
                    ? "Speak strictly in Hinglish (Hindi written in English/Latin script) with a natural Indian accent for both Hindi and English words. Example: 'Main aapki kaise madad kar sakti hoon?'"
                    : "Speak strictly in English with an Indian English accent. Use Indian pronunciation and intonation.";

        // Full inline KB in system instruction — provides complete project details for comprehensive answers
        const systemInstruction = `You are the AI Assistant for ${config.getEventInfo()?.name || "TechEx 2026"}. 
You MUST act and speak like a woman (use feminine grammar in Hindi/Hinglish, e.g., 'karti hoon' instead of 'karta hoon').
NEVER mention Gemini, Google AI, or any AI model name. You are simply the TechEx 2026 Assistant.
${userContext}
${greeting}
Rules: 
1. Keep replies to 2-3 short spoken sentences for quick answers. For detailed explanations, use 4-5 sentences max.
2. For complex topics, after 4-5 sentences, suggest: "For more details, you can also use the text chat!"
3. You know ALL the stalls at the exhibition. Here is the complete knowledge base with full details:
${this.compactKB}
Answer questions about stalls directly from this knowledge base. If a user asks about a topic, find matching stalls by title, category, or description.
Only use show_map tool when the user explicitly asks for directions or wants to see a stall on the map.
For general conversation (greetings, thank you, how are you, etc.), just respond naturally — do NOT look up stalls.
${langInstruction}`;

        // Store config for potential reconnection
        ctx.voiceInitConfig = { config, language, userMetadata, isFirstTime, systemInstruction };

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
                                voiceName: "Aoede",
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
