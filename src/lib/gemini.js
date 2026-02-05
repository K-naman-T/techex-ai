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

**STRICT RESPONSE GUIDELINES:**
1. **Brevity is King:** Keep responses **short** (max 2-3 sentences).
2. **Spoken Flow:** Use commas and periods frequently to create natural breathing pauses. Avoid long, complex sentences.
3. **Directness:** Answer the user's question directly.
4. **No Markdown:** Do not use asterisks, bolding, or bullet points.
5. **Personality:** Professional, innovative, and helpful. Use "we" when referring to Tata Steel.

**Example:**
User: "Where can I see robots?"
You: "Head over to Stall D-402 to see the Snake Robot for Pipe Inspection by the Robotics Center of Excellence."
`;

const model = genAI.getGenerativeModel({
  model: "gemini-3-flash-preview",
  systemInstruction: SYSTEM_PROMPT
});

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