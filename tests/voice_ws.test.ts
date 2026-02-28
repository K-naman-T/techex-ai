import { describe, it, expect, beforeAll, afterAll } from "bun:test";

const WS_URL = "ws://localhost:3005/api/ws";

describe("VoiceChatService WebSocket E2E", () => {
    it("should connect, start Gemini Live, and exchange messages", async () => {
        // 1. Establish the connection
        const ws = new WebSocket(WS_URL);

        // We use a Promise to track the entire test lifecycle asynchronously
        await new Promise<void>((resolve, reject) => {
            // Timeout the test if it hangs for more than 15 seconds
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error("Test timed out waiting for AI response."));
            }, 15000);

            let isSessionStarted = false;

            ws.onopen = () => {
                console.log("[\u2705 WS Test] Connected to server.");

                // 2. Initiate the Gemini Live Session
                ws.send(JSON.stringify({
                    type: "start_gemini_live",
                    language: "en",
                    userMetadata: { userName: "Bun Test Runner" }
                }));
            };

            ws.onmessage = (event) => {
                const msg = JSON.parse(event.data.toString());
                console.log("[\u2B05\uFE0F WS Test] Received:", msg.type);

                if (msg.type === "gemini_live_started") {
                    isSessionStarted = true;
                    console.log("[\u2705 WS Test] Session started successfully.");

                    // 3. Send a dummy audio chunk (Normally this is valid base64 PCM16)
                    // We will send a tiny arbitrary base64 string just to trigger the pipeline
                    const dummyAudioBase64 = Buffer.from(new Int16Array(1024).buffer).toString("base64");

                    ws.send(JSON.stringify({
                        type: "gemini_audio_in",
                        data: dummyAudioBase64
                    }));
                    console.log("[\u27A1\uFE0F WS Test] Sent dummy audio chunk.");
                }

                // 4. Verify we receive audio output or turn completion back
                if (msg.type === "audio_out") {
                    console.log("[\u2705 WS Test] Received AI audio response!");
                    expect(msg.data).toBeDefined();

                    clearTimeout(timeout);
                    ws.close();
                    resolve();
                }

                if (msg.type === "error") {
                    clearTimeout(timeout);
                    ws.close();
                    reject(new Error("Server sent an error: " + msg.message));
                }
            };

            ws.onerror = (error) => {
                clearTimeout(timeout);
                reject(error);
            };

            ws.onclose = (event) => {
                if (!isSessionStarted) {
                    clearTimeout(timeout);
                    reject(new Error("WebSocket closed before session started. Code: " + event.code));
                }
            };
        });
    });
});
