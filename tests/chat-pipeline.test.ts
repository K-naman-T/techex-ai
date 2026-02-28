import { expect, test, describe } from "bun:test";

describe("Text Chat Pipeline", () => {
  test("Should connect to HTTP SSE and receive chat response", async () => {
    // 1. Send POST request to /api/chat
    const response = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Hello, where is the drone project?",
        language: "en",
        userMetadata: {
          userName: "TestUser",
          interests: ["Robotics"]
        },
        history: []
      })
    });

    expect(response.ok).toBe(true);
    expect(response.body).toBeDefined();

    const reader = response.body!.getReader();
    const decoder = new TextDecoder('utf-8');

    let chatDeltaReceived = false;
    let receivedText = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '');
            try {
              const msg = JSON.parse(dataStr);
              if (msg.type === "chat_delta") {
                chatDeltaReceived = true;
                receivedText += msg.text;
                console.log(`[Test] Received delta: ${msg.text}`);
              } else if (msg.type === "show_map") {
                console.log(`[Test] Show map triggered for stall: ${msg.stallId}`);
              } else if (msg.type === "error") {
                throw new Error(`Server returned error: ${msg.message}`);
              }
            } catch (e) {
              console.warn("Failed to parse SSE JSON:", e, dataStr);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    expect(chatDeltaReceived).toBe(true);
    expect(receivedText.length).toBeGreaterThan(5);
  }, 15000); // 15 second timeout for API call
});

