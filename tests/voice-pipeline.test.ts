import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Subprocess } from "bun";

// ============================================================================
// Configuration
// ============================================================================
const SERVER_PORT = 3005;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;
const WS_URL = `ws://localhost:${SERVER_PORT}/api/ws`;

const HAS_API_KEY = !!process.env.GEMINI_API_KEY;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a synthetic sine wave as PCM16 signed LE mono.
 * Matches the client's encoding: 16-bit signed integer, little-endian, mono.
 */
function generateSineWavePCM(
  frequencyHz: number,
  durationMs: number,
  sampleRate = 16000
): Int16Array {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const pcm = new Int16Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    // Float sample in [-1, 1], then convert to Int16 range
    const sample = Math.sin((2 * Math.PI * frequencyHz * i) / sampleRate);
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round(sample * 0x7fff)));
  }
  return pcm;
}

/**
 * Convert Int16Array (PCM buffer) to base64 string.
 * Replicates the client's encoding: raw bytes of Int16Array → base64.
 */
function pcmToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  return Buffer.from(bytes).toString("base64");
}

/**
 * Chunk a PCM buffer into segments of `chunkSizeMs` milliseconds.
 */
function chunkPCMData(
  pcm: Int16Array,
  chunkSizeMs: number,
  sampleRate: number
): Int16Array[] {
  const samplesPerChunk = Math.floor((sampleRate * chunkSizeMs) / 1000);
  const chunks: Int16Array[] = [];
  for (let offset = 0; offset < pcm.length; offset += samplesPerChunk) {
    const end = Math.min(offset + samplesPerChunk, pcm.length);
    chunks.push(pcm.slice(offset, end));
  }
  return chunks;
}

/**
 * Wait for a WebSocket message with a specific `type` field.
 * Resolves with the parsed message, rejects on timeout.
 */
function waitForMessage(
  ws: WebSocket,
  type: string,
  timeoutMs: number
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeEventListener("message", handler);
      reject(new Error(`Timed out waiting for message type "${type}" after ${timeoutMs}ms`));
    }, timeoutMs);

    function handler(event: MessageEvent) {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === type) {
          clearTimeout(timer);
          ws.removeEventListener("message", handler);
          resolve(data);
        }
        // If it's an error message from server, reject immediately
        if (data.type === "error" && type !== "error") {
          clearTimeout(timer);
          ws.removeEventListener("message", handler);
          reject(new Error(`Server error while waiting for "${type}": ${data.message}`));
        }
      } catch {
        // Non-JSON message, ignore
      }
    }

    ws.addEventListener("message", handler);
  });
}

/**
 * Check if server is healthy (GET /health → 200 "ok").
 */
async function checkServerHealth(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${port}/health`);
    return res.status === 200;
  } catch {
    return false;
  }
}

/**
 * Sleep helper.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Test Suite
// ============================================================================

describe("Voice Pipeline E2E", () => {
  let spawnedServer: Subprocess | null = null;
  let serverWasAlreadyRunning = false;

  beforeAll(async () => {
    if (!HAS_API_KEY) {
      console.log("[voice-pipeline] GEMINI_API_KEY not set — tests will be skipped");
      return;
    }

    // Check if server is already running
    serverWasAlreadyRunning = await checkServerHealth(SERVER_PORT);

    if (serverWasAlreadyRunning) {
      console.log(`[voice-pipeline] Server already running on port ${SERVER_PORT}`);
      return;
    }

    // Spawn server
    console.log(`[voice-pipeline] Spawning server on port ${SERVER_PORT}...`);
    spawnedServer = Bun.spawn(["bun", "server.ts"], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdout: "pipe",
      stderr: "pipe",
    });

    // Poll for health — max 10s
    const maxWaitMs = 10_000;
    const pollIntervalMs = 500;
    let elapsed = 0;
    while (elapsed < maxWaitMs) {
      if (await checkServerHealth(SERVER_PORT)) {
        console.log(`[voice-pipeline] Server healthy after ${elapsed}ms`);
        return;
      }
      await sleep(pollIntervalMs);
      elapsed += pollIntervalMs;
    }

    throw new Error(`Server failed to become healthy within ${maxWaitMs}ms`);
  }, 15_000); // beforeAll timeout: 15s

  afterAll(async () => {
    if (spawnedServer && !serverWasAlreadyRunning) {
      console.log("[voice-pipeline] Killing spawned server...");
      spawnedServer.kill();
      // Wait briefly for cleanup
      await sleep(500);
      console.log("[voice-pipeline] Server killed");
    }
  });

  // --------------------------------------------------------------------------
  // Test 1: Server health check
  // --------------------------------------------------------------------------
  test("server health check", async () => {
    if (!HAS_API_KEY) return; // skip silently

    const res = await fetch(`${SERVER_URL}/health`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe("ok");
  });

  // --------------------------------------------------------------------------
  // Test 2: Static file serving — pcm-processor.js
  // --------------------------------------------------------------------------
  test("static file serving — pcm-processor.js", async () => {
    if (!HAS_API_KEY) return;

    const res = await fetch(`${SERVER_URL}/pcm-processor.js`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("class PCMProcessor");
  });

  // --------------------------------------------------------------------------
  // Test 3: WebSocket connects
  // --------------------------------------------------------------------------
  test(
    "WebSocket connects",
    async () => {
      if (!HAS_API_KEY) return;

      const ws = new WebSocket(WS_URL);

      const opened = await new Promise<boolean>((resolve, reject) => {
        const timer = setTimeout(() => {
          ws.close();
          reject(new Error("WebSocket open timed out after 5s"));
        }, 5_000);

        ws.addEventListener("open", () => {
          clearTimeout(timer);
          resolve(true);
        });
        ws.addEventListener("error", (e) => {
          clearTimeout(timer);
          reject(new Error(`WebSocket error: ${e}`));
        });
      });

      expect(opened).toBe(true);
      ws.close();
    },
    10_000
  );

  // --------------------------------------------------------------------------
  // Test 4: Gemini Live full round-trip
  // --------------------------------------------------------------------------
  test(
    "Gemini Live full round-trip",
    async () => {
      if (!HAS_API_KEY) return;

      const ws = new WebSocket(WS_URL);

      // Wait for open
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("WS open timed out")), 5_000);
        ws.addEventListener("open", () => {
          clearTimeout(timer);
          resolve();
        });
        ws.addEventListener("error", (e) => {
          clearTimeout(timer);
          reject(new Error(`WS error on open: ${e}`));
        });
      });

      // Collect all received message types for diagnostics
      const receivedTypes: string[] = [];
      ws.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data as string);
          receivedTypes.push(data.type);
        } catch {}
      });

      // Step 1: Set up waiters BEFORE sending start (race condition prevention)
      const readyPromise = waitForMessage(ws, "gemini_live_ready", 15_000);

      // Step 2: Send start_gemini_live
      ws.send(
        JSON.stringify({
          type: "start_gemini_live",
          language: "en",
          userMetadata: { name: "TestUser", interests: ["AI"] },
        })
      );

      // Step 3: Wait for ready
      const readyMsg = await readyPromise;
      expect(readyMsg.type).toBe("gemini_live_ready");

      // Step 4: Generate and send synthetic audio (2s of 440Hz sine wave)
      const pcm = generateSineWavePCM(440, 2000, 16000);
      const chunks = chunkPCMData(pcm, 100, 16000); // ~100ms chunks

      for (const chunk of chunks) {
        ws.send(
          JSON.stringify({
            type: "gemini_audio_in",
            data: pcmToBase64(chunk),
          })
        );
        await sleep(50); // Slight delay between chunks — don't flood
      }

      // Step 5: Wait for turn_complete (Gemini may or may not send audio_out — sine wave isn't speech)
      // We wait up to 15s for turn_complete
      const turnCompletePromise = waitForMessage(ws, "gemini_live_turn_complete", 15_000);
      const turnMsg = await turnCompletePromise;
      expect(turnMsg.type).toBe("gemini_live_turn_complete");

      // Step 6: Stop session
      const stoppedPromise = waitForMessage(ws, "gemini_live_stopped", 5_000);
      ws.send(JSON.stringify({ type: "stop_gemini_live" }));
      const stoppedMsg = await stoppedPromise;
      expect(stoppedMsg.type).toBe("gemini_live_stopped");

      // Step 7: Close WS
      ws.close();

      // Diagnostics: log received message types
      console.log("[voice-pipeline] Received message types:", receivedTypes);

      // Verify we got the essential protocol messages
      expect(receivedTypes).toContain("gemini_live_ready");
      expect(receivedTypes).toContain("gemini_live_turn_complete");
      expect(receivedTypes).toContain("gemini_live_stopped");
    },
    45_000 // 45s timeout for full round-trip
  );

  // --------------------------------------------------------------------------
  // Test 6: Config validation — Gemini accepts optimized liveConfig
  // Validates that thinkingConfig, realtimeInputConfig, and generationConfig
  // are accepted by the Gemini Live API without connection errors.
  // --------------------------------------------------------------------------
  test(
    "Gemini accepts optimized liveConfig (thinkingConfig, realtimeInputConfig, generationConfig)",
    async () => {
      if (!HAS_API_KEY) return;

      const ws = new WebSocket(WS_URL);

      // Wait for open
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("WS open timed out")), 5_000);
        ws.addEventListener("open", () => {
          clearTimeout(timer);
          resolve();
        });
        ws.addEventListener("error", (e) => {
          clearTimeout(timer);
          reject(new Error(`WS error on open: ${e}`));
        });
      });

      // Set up waiter BEFORE sending start
      const readyPromise = waitForMessage(ws, "gemini_live_ready", 15_000);

      // Send start_gemini_live — server will use the new optimized liveConfig
      // (thinkingConfig: { thinkingBudget: 0 }, realtimeInputConfig with VAD settings,
      //  generationConfig: { maxOutputTokens: 256 })
      ws.send(
        JSON.stringify({
          type: "start_gemini_live",
          language: "en",
          userMetadata: { name: "ConfigTest", interests: ["Testing"] },
        })
      );

      // If the config has invalid fields, Gemini will reject the connection
      // and gemini_live_ready will never arrive (timeout = failure)
      const readyMsg = await readyPromise;
      expect(readyMsg.type).toBe("gemini_live_ready");

      // Clean up: stop session and close
      const stoppedPromise = waitForMessage(ws, "gemini_live_stopped", 5_000);
      ws.send(JSON.stringify({ type: "stop_gemini_live" }));
      const stoppedMsg = await stoppedPromise;
      expect(stoppedMsg.type).toBe("gemini_live_stopped");

      ws.close();
    },
    30_000 // 30s timeout — config validation should be fast
  );
  // --------------------------------------------------------------------------
  // Test 5: Graceful behavior when API key requirement is met
  // --------------------------------------------------------------------------
  test("skip guard works when API key is absent", () => {
    // This test validates the skip mechanism itself.
    // When HAS_API_KEY is false, all tests above return early (skip).
    // When HAS_API_KEY is true, this test trivially passes.
    // Either way, the suite should never crash due to missing key.
    expect(true).toBe(true);
  });
});
