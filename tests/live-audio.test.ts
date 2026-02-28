import { describe, test, expect } from "bun:test";
import { GoogleGenAI, Modality } from "@google/genai";
import * as fs from "fs";
import * as path from "path";

describe("Gemini Live Audio Round-Trip", () => {
    test("Should connect, send PCM audio (manual turns), and receive audio response", async () => {
        const apiKey = process.env.GEMINI_KEY_3 || process.env.GEMINI_KEY_1;
        expect(apiKey).toBeTruthy();

        // Read the test WAV file and strip the 44-byte header to get raw PCM
        const wavPath = path.join(process.cwd(), "question.wav");
        expect(fs.existsSync(wavPath)).toBe(true);

        const wavBuffer = fs.readFileSync(wavPath);
        const pcmBuffer = wavBuffer.subarray(44); // Raw 16-bit PCM, 16kHz, Mono

        const ai = new GoogleGenAI({ apiKey });

        let receivedAudioChunks = 0;
        let turnCompleted = false;
        let closeCode = -1;
        let interrupted = false;

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
                    parts: [{ text: "You are a test AI. Respond briefly." }],
                },
                // Disable automatic VAD — we control turns manually
                realtimeInputConfig: {
                    automaticActivityDetection: {
                        disabled: true,
                    },
                },
            },
            callbacks: {
                onmessage: (msg: any) => {
                    const msgStr = JSON.stringify(msg);
                    if (msgStr.length > 300) {
                        console.log("[Test] Msg:", msgStr.substring(0, 300) + "...");
                    } else {
                        console.log("[Test] Msg:", msgStr);
                    }

                    if (msg.serverContent?.modelTurn?.parts) {
                        for (const part of msg.serverContent.modelTurn.parts) {
                            if (part.inlineData?.data) {
                                receivedAudioChunks++;
                            }
                        }
                    }
                    if (msg.serverContent?.interrupted) {
                        interrupted = true;
                    }
                    if (msg.serverContent?.turnComplete) {
                        turnCompleted = true;
                    }
                },
                onclose: (e: any) => {
                    closeCode = e.code ?? -1;
                    console.log(`[Test] Closed: code=${closeCode}, reason=${e.reason}`);
                },
            },
        });

        console.log("[Test] Connected. Signaling activityStart...");

        // 1. Signal start of user activity (replaces VAD "start talking" detection)
        session.sendRealtimeInput({
            activityStart: {},
        });

        // 2. Send all audio
        session.sendRealtimeInput({
            audio: {
                mimeType: "audio/pcm;rate=16000",
                data: pcmBuffer.toString("base64"),
            },
        });

        // 3. Signal end of user activity (replaces VAD "stop talking" detection)
        session.sendRealtimeInput({
            activityEnd: {},
        });

        console.log("[Test] Audio sent with manual turn signals. Waiting for response...");

        // Wait up to 15 seconds for the response
        const startTime = Date.now();
        while (!turnCompleted && Date.now() - startTime < 15000) {
            await new Promise((r) => setTimeout(r, 200));
        }

        try { session.close(); } catch (e) { }

        console.log(`[Test] Result: chunks=${receivedAudioChunks}, turn=${turnCompleted}, interrupted=${interrupted}, close=${closeCode}`);

        expect(closeCode).not.toBe(1007);
        expect(interrupted).toBe(false);
        expect(turnCompleted).toBe(true);
        expect(receivedAudioChunks).toBeGreaterThan(0);
    }, 30000);
});
