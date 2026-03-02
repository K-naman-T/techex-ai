import { GoogleGenAI } from "@google/genai";
import { ApiKeyManager } from "../lib/apiKeyManager";

export class TextChatService {
    constructor(private apiKeyManager: ApiKeyManager, private config: any) { }

    /**
     * Generates the system instruction dynamically based on the user context and event info.
     */
    private getSystemInstruction(userName?: string, interests: string[] = [], language: string = 'en') {
        const userContext = userName
            ? `You are talking to ${userName}. ${interests.length > 0 ? `They are interested in: ${interests.join(', ')}.` : ''}`
            : '';

        const langInstruction = language === 'hi'
            ? 'Respond strictly in Hindi with a clear Indian Hindi accent.'
            : language === 'hinglish'
                ? 'Respond strictly in Hinglish (Hindi written in English script) with a natural Indian accent for both Hindi and English words.'
                : 'Respond strictly in English with an Indian English accent. Use Indian pronunciation and intonation.';

        return `
**Knowledge Base:**
${this.config.getProjectsContext()}

You are the AI Assistant for **${this.config.getEventInfo()?.name || "TechEx 2026"}**.
NEVER mention Gemini, Google AI, or any AI model name. You are simply the TechEx 2026 Assistant.
Location: ${this.config.getEventInfo()?.location || "Event Venue"}. Date: ${this.config.getEventInfo()?.date || "Today"}.
${this.config.getEventInfo()?.description || ""}

${userContext}

**STRICT RESPONSE GUIDELINES:**
1. Punctuation: Use frequent periods and commas for clarity.
2. Brevity: Keep replies to 2-3 sentences for quick answers. For detailed explanations, use 4-5 sentences max. For complex topics, after 4-5 sentences, suggest: "For even more details, you can also try the voice assistant!"
3. Navigation: If asked for location, append [SHOW_MAP: <StallNumber>].
4. NO MARKDOWN: Respond in plain text only. Do not use bold, italics, or hashtags.
${langInstruction}
`;
    }

    /**
     * Processes the chat stream using SSE controller.
     */
    public async handleStream(req: Request): Promise<Response> {
        const body: any = await req.json();
        const { message, history, language = 'en', userMetadata = {} } = body;
        const { userName, interests = [] } = userMetadata;

        console.log(`[TextChatService] Incoming request${userName ? ` from ${userName}` : ''}`);

        const apiKey = this.apiKeyManager.getNextKey();
        const ai = new GoogleGenAI({ apiKey });

        let recentHistory = (history || []).map((h: any) => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: (h.content || '').substring(0, 200) }]
        })).slice(-4);

        recentHistory.push({ role: 'user', parts: [{ text: message }] });

        const systemInstruction = this.getSystemInstruction(userName, interests, language);

        // Capture apiKeyManager for retry inside ReadableStream
        const apiKeyMgr = this.apiKeyManager;

        const stream = new ReadableStream({
            async start(controller) {
                const MAX_RETRIES = 3;
                const BASE_DELAY_MS = 1000;
                let currentAi = ai;

                for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                    try {
                        const resultStream = await currentAi.models.generateContentStream({
                            model: "gemini-2.5-flash",
                            contents: recentHistory,
                            config: {
                                systemInstruction: systemInstruction,
                            }
                        });

                        let fullText = "";
                        for await (const chunk of resultStream) {
                            const delta = chunk.text;
                            if (delta) {
                                const cleanDelta = delta.replace(/[\*\#]/g, ''); // Strip markdown
                                fullText += cleanDelta;

                                // Send delta to client
                                const displayDelta = cleanDelta.replace(/\[SHOW_MAP:\s*(.*?)\]/g, "");
                                if (displayDelta) {
                                    controller.enqueue(`data: ${JSON.stringify({ type: "chat_delta", text: displayDelta })}\n\n`);
                                }
                            }
                        }

                        // Handle Map Tags at the end
                        const mapRegex = /\[SHOW_MAP:\s*(.*?)\]/g;
                        let match;
                        while ((match = mapRegex.exec(fullText)) !== null) {
                            if (match[1]) {
                                controller.enqueue(`data: ${JSON.stringify({ type: "show_map", stallId: match[1].trim() })}\n\n`);
                            }
                        }

                        const cleanFullText = fullText.replace(/\[SHOW_MAP:\s*(.*?)\]/g, "");
                        console.log(`[TextChatService] Response complete (${cleanFullText.length} chars)`);

                        // Success — exit retry loop
                        controller.close();
                        return;

                    } catch (error: any) {
                        const isRetryable = error?.status === 429 || error?.status === 503 ||
                            error?.message?.includes("429") || error?.message?.includes("503");

                        if (isRetryable && attempt < MAX_RETRIES - 1) {
                            const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
                            console.warn(`[TextChatService] ⚡ Retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay)}ms...`, error.message || error);
                            await new Promise(r => setTimeout(r, delay));
                            // Rotate to next key
                            const nextKey = apiKeyMgr.getNextKey();
                            currentAi = new GoogleGenAI({ apiKey: nextKey });
                            continue;
                        }

                        console.error("[TextChatService] Internal Error:", error);
                        controller.enqueue(`data: ${JSON.stringify({ type: "error", message: "Service busy — please try again in a moment." })}\n\n`);
                        controller.close();
                        return;
                    }
                }

                // Should not reach here, but close cleanly
                controller.close();
            }
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            }
        });
    }
}
