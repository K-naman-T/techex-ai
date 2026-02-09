import { GoogleGenerativeAI } from "@google/generative-ai";
import { TECHEX_DB } from "../db/mockData";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.warn("Missing VITE_GEMINI_API_KEY in environment variables.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// Construct Knowledge Context
const STALL_LIST = TECHEX_DB.stalls.map(s =>
  `- Stall ${s.stallNumber}: "${s.title}" by ${s.team}. (${s.description})
`).join("\n");

const FAQ_LIST = TECHEX_DB.faq.map(f =>
  `Q: ${f.question} A: ${f.answer}`
).join("\n");

const SYSTEM_PROMPT = `
You are the interactive AI Host for **Tata Steel TechEx 2026**.
Your goal is to assist visitors with quick, accurate information about the exhibition.

**EVENT DETAILS:**
- Name: ${TECHEX_DB.event.name}
- Location: ${TECHEX_DB.event.location}
- Timings: ${TECHEX_DB.event.timings}
- Description: ${TECHEX_DB.event.description}

**STALL DIRECTORY:**
${STALL_LIST}

**FAQ:**
${FAQ_LIST}

**STRICT RESPONSE GUIDELINES FOR TTS:**
1. **PUNCTUATION IS CRITICAL:** You MUST use periods (.), commas (,), and question marks (?) frequently. 
2. **Short Sentences:** Break long ideas into short, punchy sentences.
3. **Breathable Flow:** Write as if speaking. Use commas where a speaker would pause.
4. **No Markdown:** Do not use asterisks (*), bolding (**), or bullet points (-).
5. **Directness:** Answer directly and concisely (max 2-3 sentences).
5. **Personality:** Professional, innovative, and helpful. Use "we" when referring to Tata Steel.
6. **Navigation:** If the user asks for a LOCATION (e.g., "Where is X?", "Directions to Y"), YOU MUST append [SHOW_MAP: <StallNumber>] to the end of your response. Use the exact Stall Number from the directory (e.g., A-01, B-12). If no specific stall, use the Zone (e.g., Zone A).

  **Example:**
  User: "Where can I see robots?"
  You: "Head over to Stall D-402 to see the Snake Robot for Pipe Inspection. [SHOW_MAP: D-402]"
  `;

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  systemInstruction: SYSTEM_PROMPT
});

// Original non-streaming function (kept for compatibility)
export const getGeminiResponse = async (prompt) => {
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I'm having trouble accessing the event database right now. Please try again.";
  }
};

// Streaming function - calls Backend API which handles RAG + Persistence
export const getGeminiResponseStreaming = async (prompt, onSentence, onComplete, conversation_id = null, history = [], language = 'en') => {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer guest-token'
      },
      body: JSON.stringify({ message: prompt, history, conversation_id, language }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    const text = data.response;

    // Split into sentences for TTS
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    for (const sentence of sentences) {
      const clean = sentence.replace(/\[SHOW_MAP:.*?\]/g, '').trim();
      if (clean && onSentence) onSentence(clean);
    }

    if (onComplete) onComplete(text);
    return text;

  } catch (error) {
    console.error("API Error:", error);
    const errorMsg = error.message || "I'm having trouble connecting.";
    if (onComplete) onComplete(errorMsg);
    return errorMsg;
  }
};

