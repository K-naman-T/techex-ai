import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("GEMINI_API_KEY not found in environment");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function run() {
    try {
        console.log("Creating cache...");
        const cache = await ai.caches.create({
            model: "gemini-2.5-flash",
            ttl: "3600s",
            config: {
                systemInstruction: "You are a very helpful assistant."
            }
        });
        console.log("Cache created:", cache.name);

        console.log("Testing connection...");
        const session = await ai.live.connect({
            model: "gemini-2.5-flash-native-audio-latest",
            config: {
                cachedContent: cache.name
            }
        });
        console.log("Session connected via cache.");
        session.close();

        await ai.caches.delete({ name: cache.name });
        console.log("Cache deleted.");
    } catch (err) {
        console.error("Error:", err);
    }
}

run();
