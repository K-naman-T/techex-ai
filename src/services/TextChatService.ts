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
            ? 'Respond strictly in Hindi written in English script (Hinglish).'
            : 'Respond strictly in English.';

        return `
**Knowledge Base:**
${this.config.getProjectsContext()}

You are the AI Assistant for **${this.config.getEventInfo()?.name || "TechEx"}**.
Location: ${this.config.getEventInfo()?.location || "Event Venue"}. Date: ${this.config.getEventInfo()?.date || "Today"}.
${this.config.getEventInfo()?.description || ""}

${userContext}

**STRICT RESPONSE GUIDELINES:**
1. Punctuation: Use frequent periods and commas for clarity.
2. Brevity: Max 2-3 sentences.
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

        console.log(`[TextChatService] 📩 User${userName ? ` (${userName})` : ''}: "${message}"`);

        const apiKey = this.apiKeyManager.getNextKey();
        const ai = new GoogleGenAI({ apiKey });

        let recentHistory = (history || []).map((h: any) => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: (h.content || '').substring(0, 200) }]
        })).slice(-4);

        recentHistory.push({ role: 'user', parts: [{ text: message }] });

        const systemInstruction = this.getSystemInstruction(userName, interests, language);

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    const resultStream = await ai.models.generateContentStream({
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
                    console.log(`[TextChatService] 🤖 Gemini: "${cleanFullText.substring(0, 200)}..."`);

                } catch (error: any) {
                    console.error("[TextChatService] Internal Error:", error);
                    controller.enqueue(`data: ${JSON.stringify({ type: "error", message: "Error generating response" })}\n\n`);
                } finally {
                    controller.close();
                }
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
