import { GoogleGenAI } from "@google/genai";
import { ApiKeyManager } from "../lib/apiKeyManager";

export class TextChatService {
    constructor(private apiKeyManager: ApiKeyManager, private config: any) { }

    /**
     * Generates the system instruction dynamically based on the user context and event info.
     */
    private getSystemInstruction(userName?: string, interests: string[] = []) {
        const userContext = userName
            ? `You are talking to ${userName}. ${interests.length > 0 ? `They are interested in: ${interests.join(', ')}.` : ''}`
            : '';

        // Dynamic greeting — only on first message (no prior history), not every turn
        // Dynamic greeting — only on first message (no prior history), not every turn
        const greeting = userName
            ? `On your VERY FIRST reply only (when there is no prior conversation history), greet them warmly with their name (e.g., "Namaste ${userName}! TechEx 2026 mein aapka swagat hai!" or "Hello ${userName}! Welcome to TechEx 2026!"). Match the greeting language to whatever the user wrote. For ALL subsequent messages, respond directly WITHOUT any greeting.`
            : `On your VERY FIRST reply only (when there is no prior conversation history), greet them warmly (e.g., "Namaste! TechEx 2026 mein aapka swagat hai!" or "Hello! Welcome to TechEx 2026!"). Match the greeting language to whatever the user wrote. For ALL subsequent messages, respond directly WITHOUT any greeting.`;
        const langInstruction = `**[LANGUAGE BEHAVIOR — ADAPTIVE]**
Automatically detect the language the user is writing in.
Respond in the EXACT SAME language and style as the user:
- If the user writes in English, respond in English.
- If the user writes in Hindi, respond in Hindi.
- If the user code-mixes Hindi and English (Hinglish), mirror their code-mixing style naturally.
- Match the user's formality level and language register.
- Never ask which language to use — just adapt naturally.

Examples of language mirroring:
User: "Exhibition kab khulega?" → You: "Exhibition subah 10 baje se shaam 6 baje tak khula rahega!"
User: "What are the entry timings?" → You: "The exhibition runs from 10 AM to 6 PM daily."
User: "Bro, koi interesting stalls hain kya?" → You: "Haan, bahut saare interesting stalls hain! AI-based projects se lekar robotics tak sab kuch hai."
User: "Tell me about stall A-01" → You: "Stall A-01 features an AI-powered quality inspection system for steel manufacturing."`;

        return `${langInstruction}

**Complete Knowledge Base (Event + Projects):**
${JSON.stringify({ event: this.config.getEventInfo(), projects: JSON.parse(this.config.getProjectsContext() || '[]') }, null, 0)}

The knowledge base contains: event information (founding vision, 15-year history, key themes, trainee development journey, process framework, past project highlights, leadership endorsements, trainee testimonials) AND all 35 stall/project details.
Answer questions about stalls from the projects data. Answer questions about TechEx history, vision, themes, process framework, leadership quotes, or trainee experiences from the event data.

You are the AI Assistant for **${this.config.getEventInfo()?.name || "TechEx 2026"}**.
You MUST act and speak like a woman (use feminine grammar in Hindi/Hinglish, e.g., 'karti hoon' instead of 'karta hoon').
Your output towards the user should be gender neutral — do not assume the user's gender.
NEVER mention Gemini, Google AI, or any AI model name. You are simply the TechEx 2026 Assistant.
Location: ${this.config.getEventInfo()?.location || "Event Venue"}. Date: ${this.config.getEventInfo()?.date || "Today"}.

${userContext}
${greeting}

**STRICT RESPONSE GUIDELINES:**
1. Punctuation: Use frequent periods and commas for clarity.
2. Brevity: Keep replies to 2-3 sentences for quick answers. For detailed explanations, use 4-5 sentences max. For complex topics, after 4-5 sentences, suggest: "For even more details, you can also try the voice assistant!"
3. Navigation: If asked for location, append [SHOW_MAP: <StallNumber>].
4. NO MARKDOWN: Respond in plain text only. Do not use bold, italics, or hashtags.

REMINDER: Mirror the user's language naturally. Never force a language they didn't use.
`;
    }

    /**
     * Processes the chat stream using SSE controller.
     */
    public async handleStream(req: Request): Promise<Response> {
        const body: any = await req.json();
        const { message, history, userMetadata = {} } = body;
        const { userName, interests = [] } = userMetadata;

        console.log(`[TextChatService] Incoming request${userName ? ` from ${userName}` : ''}`);

        const apiKey = this.apiKeyManager.getNextKey();
        const ai = new GoogleGenAI({ apiKey });

        let recentHistory = (history || []).map((h: any) => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: (h.content || '').substring(0, 200) }]
        })).slice(-4);

        recentHistory.push({ role: 'user', parts: [{ text: message }] });

        const systemInstruction = this.getSystemInstruction(userName, interests);

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
