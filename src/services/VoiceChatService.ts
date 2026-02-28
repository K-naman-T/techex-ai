import type { ServerWebSocket } from "bun";
import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { WSContext } from "../../server";
import { ApiKeyManager } from "../lib/apiKeyManager";

export class VoiceChatService {
    constructor(private apiKeyManager: ApiKeyManager) { }

    /**
     * Initializes a new Gemini Live session on a WebSocket request.
     */
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

        console.log(`[VoiceChatService] Connecting Live API for user: ${userMetadata?.userName || 'Anonymous'}`);

        const userContext = userMetadata?.userName
            ? `You are talking to ${userMetadata.userName}. ${userMetadata.interests?.length > 0
                ? `They are interested in: ${userMetadata.interests.join(", ")}.`
                : ""
            }`
            : "";

        const langInstruction =
            language === "hi"
                ? "Speak strictly in Hindi. Your output must be localized for spoken Hindi."
                : "Speak strictly in English.";

        // Assemble unified system instruction
        const systemInstruction = `
Your name is TechEx AI Assistant. You are the AI Assistant for **${config.getEventInfo()?.name || "TechEx"}**.
Location: ${config.getEventInfo()?.location || "Event Venue"}. Date: ${config.getEventInfo()?.date || "Today"}.
${config.getEventInfo()?.description || ""}

${userContext}

**Knowledge Base:**
${config.getProjectsContext()}

**STRICT VOICE GUIDELINES:**
1. Keep answers to 1-2 short sentences. Let the user speak.
2. If asked where a stall is, explicitly call the \`show_map\` tool with the stall number.
3. ${langInstruction}
`;

        try {
            // Provide a round-robin key and create a localized client for this specific session
            const apiKey = this.apiKeyManager.getNextKey();
            const ai = new GoogleGenAI({ apiKey });

            // Create pristine connection
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
                    // Natively support tool calling for navigating
                    tools: [
                        {
                            functionDeclarations: [
                                {
                                    name: "show_map",
                                    description: "Shows the user the indoor map of a specific stall or booth.",
                                    parameters: {
                                        type: Type.OBJECT,
                                        properties: {
                                            stallId: {
                                                type: Type.STRING,
                                                description: "The ID or number of the stall (e.g., '101', 'A-22').",
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
                },
                callbacks: {
                    onmessage: (message: any) => {
                        // Handle Map Function calls natively
                        if (message.toolCall && message.toolCall.functionCalls) {
                            for (const call of message.toolCall.functionCalls) {
                                if (call.name === "show_map") {
                                    const stallId = call.args?.stallId;
                                    console.log(`[VoiceChatService] \uD83D\uDDFA\uFE0F AI triggered map for stall: ${stallId}`);
                                    ws.send(JSON.stringify({ type: "show_map", stallId }));

                                    // Gemini expects a result block back
                                    session.sendToolResponse({
                                        functionResponses: [{
                                            id: call.id,
                                            response: { result: `Map for stall ${stallId} shown to user.` }
                                        }]
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
                        console.log("[VoiceChatService] Gemini disconnected.", event);
                        if (ctx.geminiLiveSession === session) {
                            ctx.geminiLiveSession = undefined;
                        }
                    },
                }
            });

            // Bind to Context
            ctx.geminiLiveSession = session;

            ws.send(JSON.stringify({ type: "gemini_live_started" }));

            // NOTE: Do NOT send text-only sendClientContent to the native audio model.
            // It will reject it with 1007 "Cannot extract voices from a non-audio request".
            // The session is now open and waiting for microphone audio input from the client.

        } catch (e: any) {
            console.error("[VoiceChatService] Failed to establish Live API connection:", e);
            ws.send(JSON.stringify({ type: "error", message: "Failed to connect to AI Voice" }));
        }
    }
}
