import { GoogleGenAI, Modality, Type } from "@google/genai";

async function testLiveConnection() {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY_3 });
    console.log("Connecting...");
    try {
        const session = await ai.live.connect({
            model: "gemini-2.0-flash-exp",
            config: {
                systemInstruction: {
                    parts: [{ text: "Hello, you are a test." }],
                }
            },
            callbacks: {
                onmessage: (msg) => console.log("Message:", JSON.stringify(msg)),
                onclose: (e) => console.log("Closed:", e),
            }
        });
        console.log("Connected successfully!");

        session.sendClientContent({
            turns: [
                {
                    role: "user",
                    parts: [{ text: "Hello! Begin." }],
                },
            ],
            turnComplete: true,
        });

        await new Promise(r => setTimeout(r, 5000));
        session.close();
    } catch (e) {
        console.error("Connection failed:", e);
    }
}

testLiveConnection();
