import { GoogleGenAI, Modality } from "@google/genai";
import * as fs from "fs";
import * as path from "path";

async function captureResponseAudio() {
    const apiKey = process.env.GEMINI_KEY_3 || process.env.GEMINI_KEY_1;
    if (!apiKey) throw new Error("No API key found");

    const wavPath = path.join(process.cwd(), "question.wav");
    const wavBuffer = fs.readFileSync(wavPath);
    const pcmBuffer = wavBuffer.subarray(44);

    const ai = new GoogleGenAI({ apiKey });

    const audioChunks: Buffer[] = [];
    let turnCompleted = false;

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
                parts: [{ text: "You are a friendly AI. Respond briefly to whatever the user says." }],
            },
            realtimeInputConfig: {
                automaticActivityDetection: {
                    disabled: true,
                },
            },
        },
        callbacks: {
            onmessage: (msg: any) => {
                if (msg.serverContent?.modelTurn?.parts) {
                    for (const part of msg.serverContent.modelTurn.parts) {
                        if (part.inlineData?.data) {
                            audioChunks.push(Buffer.from(part.inlineData.data, "base64"));
                        }
                    }
                }
                if (msg.serverContent?.turnComplete) {
                    turnCompleted = true;
                }
            },
            onclose: (e: any) => console.log(`Closed: code=${e.code}`),
        },
    });

    console.log("Connected. Sending audio...");

    session.sendRealtimeInput({ activityStart: {} });
    session.sendRealtimeInput({
        audio: { mimeType: "audio/pcm;rate=16000", data: pcmBuffer.toString("base64") },
    });
    session.sendRealtimeInput({ activityEnd: {} });

    console.log("Waiting for response...");
    const start = Date.now();
    while (!turnCompleted && Date.now() - start < 15000) {
        await new Promise((r) => setTimeout(r, 200));
    }
    try { session.close(); } catch (e) { }

    // Combine all audio chunks into one PCM buffer
    const responsePcm = Buffer.concat(audioChunks);
    console.log(`Received ${audioChunks.length} chunks, ${responsePcm.length} bytes total.`);

    // Write WAV header + PCM data (24kHz, 16-bit, Mono - Gemini Live output format)
    const sampleRate = 24000;
    const bitsPerSample = 16;
    const channels = 1;
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    const blockAlign = channels * (bitsPerSample / 8);
    const dataSize = responsePcm.length;
    const headerSize = 44;

    const wavHeader = Buffer.alloc(headerSize);
    wavHeader.write("RIFF", 0);
    wavHeader.writeUInt32LE(dataSize + headerSize - 8, 4);
    wavHeader.write("WAVE", 8);
    wavHeader.write("fmt ", 12);
    wavHeader.writeUInt32LE(16, 16);           // fmt chunk size
    wavHeader.writeUInt16LE(1, 20);            // PCM format
    wavHeader.writeUInt16LE(channels, 22);
    wavHeader.writeUInt32LE(sampleRate, 24);
    wavHeader.writeUInt32LE(byteRate, 28);
    wavHeader.writeUInt16LE(blockAlign, 32);
    wavHeader.writeUInt16LE(bitsPerSample, 34);
    wavHeader.write("data", 36);
    wavHeader.writeUInt32LE(dataSize, 40);

    const outPath = path.join(process.cwd(), "response.wav");
    fs.writeFileSync(outPath, Buffer.concat([wavHeader, responsePcm]));
    console.log(`Saved to: ${outPath}`);
}

captureResponseAudio();
