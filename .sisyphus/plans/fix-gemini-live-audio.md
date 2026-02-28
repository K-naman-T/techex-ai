# Fix Gemini Live API Audio Playback — TechEx AI

## TL;DR

> **Quick Summary**: Fix 5 bugs preventing Gemini Live API audio from playing in the browser. The root cause is `sendRealtimeInput()` being called with the wrong parameter shape (array instead of object), so Gemini never receives user audio. Secondary bugs include a dangerously low `maxOutputTokens`, potentially invalid model name, AudioContext sample rate mismatch, and non-gapless playback.
> 
> **Deliverables**:
> - Fixed `sendRealtimeInput` call format in `wsHandler.ts`
> - Removed truncation-causing `maxOutputTokens: 150` from live config
> - Updated model name to verified valid name
> - Fixed AudioContext sample rate for correct 24kHz playback
> - Implemented gapless audio playback with scheduled start times
> - Migrated mic capture from ScriptProcessorNode to AudioWorklet (lower latency)
> 
> **Estimated Effort**: Short-Medium (5 surgical bug fixes + AudioWorklet migration across 2 files + 1 new file, ~60 lines changed)
> **Parallel Execution**: YES — 3 waves (server fixes → client fixes + AudioWorklet → verify)
> **Critical Path**: Task 1 (root cause) → Task 3 + Task 5 (client) → Task 4 (verify) → F1-F4 (review)

---

## Context

### Original Request
User's Gemini Live voice integration connects successfully and reaches `turn_complete`, but no audio is played in the browser. User requested thorough analysis and fix of all bugs.

### Interview Summary
**Key Discussions**:
- All voice is handled via Gemini's native audio-in/audio-out (not ElevenLabs/Sarvam for TTS/STT)
- Cross-referenced against 8+ GitHub repos, official Google `live-api-web-console`, `@google/genai` SDK source, Context7 docs
- 5 bugs identified with exact line references and verified correct fixes

**Research Findings**:
- `sendRealtimeInput` expects `{ media: { data, mimeType } }` — SDK source confirmed at `index.mjs:15809` → `liveSendRealtimeInputParametersToMldev` extracts `params.media`, `params.audio`, etc. Passing an array makes all undefined → sends empty `{ realtimeInput: {} }`
- SDK routes top-level `temperature`/`maxOutputTokens` into `setup.generationConfig` automatically (confirmed: `index.mjs:10997-11013`), so placement is fine but `maxOutputTokens: 150` ≈ 1-2 seconds of audio — truncates virtually every response
- Gemini Live outputs 24kHz 16-bit PCM mono little-endian
- `responseModalities: [Modality.AUDIO]` only — including TEXT breaks connections (GitHub issue #1212)
- Official Google `AudioStreamer` uses `nextStartTime` scheduling for gapless playback

### Metis Review
**Identified Gaps** (addressed):
- Bug #3 reclassified: placement is fine (SDK handles it), actual issue is dangerously low `maxOutputTokens: 150` value → removed entirely
- Duplicate project directory risk (`OneDrive\Desktop\techex-ai` vs `techex-ai-local`) → all tasks use absolute paths
- Model name may actually be working as alias (session connects) → fix conservatively but don't panic if model change breaks connection
- `sendClientContent` greeting trigger format needs to stay untouched (appears to work)

---

## Work Objectives

### Core Objective
Fix all bugs preventing Gemini Live API audio playback and migrate mic capture to AudioWorklet for lower latency, so users can have smooth voice conversations with the TechEx AI assistant.

### Concrete Deliverables
- `C:\Users\naman\techex-ai-local\src\lib\wsHandler.ts` — 3 bugs fixed (sendRealtimeInput format, model name, maxOutputTokens removal)
- `C:\Users\naman\techex-ai-local\src\hooks\useWSVoice.js` — 2 bugs fixed (AudioContext sample rate, gapless playback) + AudioWorklet migration (replace ScriptProcessorNode with AudioWorkletNode)
- `C:\Users\naman\techex-ai-local\public\pcm-processor.js` — NEW: AudioWorklet processor file for mic capture

### Definition of Done
- [ ] `sendRealtimeInput` uses `{ media: { data, mimeType } }` format (grep verification)
- [ ] No `maxOutputTokens: 150` in liveConfig (grep verification)
- [ ] Model name is a verified valid Gemini Live model (grep verification)
- [ ] AudioContext constructor has no `sampleRate: 16000` option (grep verification)
- [ ] Audio playback uses `nextStartTime` scheduling (grep verification)
- [ ] Mic capture uses `AudioWorkletNode` instead of `ScriptProcessorNode` (grep verification)
- [ ] `public/pcm-processor.js` exists and registers `pcm-processor` worklet
- [ ] `bun run build` succeeds with no errors
- [ ] Server starts without errors (`bun run start`)

### Must Have
- Fix `sendRealtimeInput` parameter shape (root cause of silence)
- Remove `maxOutputTokens: 150` (truncates audio to ~1-2 seconds)
- Fix AudioContext sample rate mismatch (24kHz output into 16kHz context)
- Update model name to verified valid name
- Implement gapless playback scheduling
- Migrate mic capture from ScriptProcessorNode to AudioWorklet (lower latency, main-thread unblocking)

### Must NOT Have (Guardrails)
- ❌ DO NOT touch `sendClientContent` (greeting trigger) — it works
- ❌ DO NOT touch `handleChatStream()` or text-chat code (wsHandler.ts lines 240-308)
- ❌ DO NOT modify `server.ts`, `App.jsx`, `.env`, or any file other than the two targets + new `public/pcm-processor.js`
- ❌ DO NOT refactor `ScriptProcessorNode` to `AudioWorkletNode` in any file OTHER than `useWSVoice.js` and the new `public/pcm-processor.js`
- ❌ DO NOT add error handling, retry logic, reconnection logic, or defensive hardening
- ❌ DO NOT add JSDoc comments, TypeScript interfaces, or documentation
- ❌ DO NOT create helper functions, utility files, or abstractions — inline changes only
- ❌ DO NOT add type assertions, type guards, or TypeScript strictness improvements
- ❌ DO NOT change `systemInstruction`, `speechConfig`, `voiceName`, or any prompt text
- ❌ DO NOT "improve" the VAD logic or WebSocket handling (VAD silence-detection stays on main thread via port.onmessage, NOT moved into the worklet processor)
- ❌ DO NOT edit files in `C:\Users\naman\OneDrive\Desktop\techex-ai\` (wrong copy!)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (only `tests/knowledge.test.ts`, no jest/vitest config)
- **Automated tests**: None — these are audio streaming fixes requiring real browser + server
- **Framework**: N/A

### QA Policy
Every task includes agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Server-side**: Use Bash — grep for correct patterns, run build, check server startup logs
- **Client-side**: Use Playwright — connect to app, open console, verify no errors, check WebSocket traffic

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — server-side fixes in wsHandler.ts):
├── Task 1: Fix sendRealtimeInput format + remove maxOutputTokens [quick] (CRITICAL ROOT CAUSE)
├── Task 2: Fix model name [quick]

Wave 2 (After Wave 1 — client-side fixes in useWSVoice.js, PARALLEL):
├── Task 3: Fix AudioContext sample rate + implement gapless playback [unspecified-high]
├── Task 5: Migrate mic capture from ScriptProcessorNode to AudioWorklet [unspecified-high]

Wave 3 (After Wave 2 — verification):
├── Task 4: Build verification + server startup check [quick]

Wave FINAL (After ALL tasks — independent review):
├── Task F1: Plan compliance audit [oracle]
├── Task F2: Code quality review [unspecified-high]
├── Task F3: Real manual QA [unspecified-high]
├── Task F4: Scope fidelity check [deep]

Critical Path: Task 1 → Task 3 + Task 5 → Task 4 → F1-F4
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 3, 5, 4 | 1 |
| 2 | — | 4 | 1 |
| 3 | 1 | 4 | 2 |
| 5 | 1 | 4 | 2 |
| 4 | 1, 2, 3, 5 | F1-F4 | 3 |
| F1-F4 | 4 | — | FINAL |

### Agent Dispatch Summary

- **Wave 1**: 2 tasks — T1 → `quick`, T2 → `quick`
- **Wave 2**: 2 tasks (parallel) — T3 → `unspecified-high`, T5 → `unspecified-high`
- **Wave 3**: 1 task — T4 → `quick`
- **Wave FINAL**: 4 tasks — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

> Implementation tasks follow. EVERY task has QA scenarios. A task WITHOUT QA scenarios is INCOMPLETE.


- [ ] 1. Fix `sendRealtimeInput` parameter format + remove `maxOutputTokens` (ROOT CAUSE)

  **What to do**:
  - In `C:\Users\naman\techex-ai-local\src\lib\wsHandler.ts`, find the `sendRealtimeInput` call (currently at line 55-58)
  - Change from: `ctx.geminiLiveSession.sendRealtimeInput([{ data: msg.data, mimeType: "audio/pcm;rate=16000" }])`
  - Change to: `ctx.geminiLiveSession.sendRealtimeInput({ media: { data: msg.data, mimeType: "audio/pcm;rate=16000" } })`
  - The SDK's `liveSendRealtimeInputParametersToMldev` extracts `params.media` — passing an array makes `params.media` undefined, sending an empty `{ realtimeInput: {} }` over the wire
  - Also remove `temperature: 0.5,` and `maxOutputTokens: 150,` from the `liveConfig` object (currently at lines 143-144). The SDK routes these to `setup.generationConfig` automatically, but 150 audio tokens ≈ 1-2 seconds of speech — it truncates every response. Remove both lines entirely; let the API use defaults
  - Remove the comment on line 142 (`// Parameters moved out of generationConfig...`) since those lines are being deleted

  **Must NOT do**:
  - DO NOT touch `sendClientContent` (the greeting trigger at lines 167-173) — it works
  - DO NOT change `responseModalities`, `speechConfig`, or `systemInstruction`
  - DO NOT add error handling or retry logic
  - DO NOT modify any code below line 145 in the liveConfig or above line 55

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - Reason: Single-file, 3 surgical line edits — change one function call shape, delete 3 lines
  - **Skills**: `[]`
  - No special skills needed — straightforward text edits in TypeScript

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 2 — both edit wsHandler.ts but different sections)
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 3, Task 4
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References** (existing code to follow):
  - `C:\Users\naman\techex-ai-local\src\lib\wsHandler.ts:55-58` — Current broken `sendRealtimeInput` call to replace
  - `C:\Users\naman\techex-ai-local\src\lib\wsHandler.ts:136-145` — Current `liveConfig` object — remove lines 142-144 (comment + temperature + maxOutputTokens)

  **API/Type References** (contracts to implement against):
  - SDK source at `node_modules/@google/genai/dist/index.mjs:15809` — `sendRealtimeInput(params)` passes to `liveSendRealtimeInputParametersToMldev` which extracts `params.media`
  - SDK source at `node_modules/@google/genai/dist/index.mjs:11262-11276` — `liveSendRealtimeInputParametersToMldev` mapping: `getValueByPath(fromObject, ['media'])` → `setValueByPath(parentObject, ['realtimeInput', 'mediaChunks'], [toMediaChunk])`

  **External References**:
  - Official Google `live-api-web-console`: `session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' } })`
  - GitHub issue js-genai#1212: Including `Modality.TEXT` in `responseModalities` breaks connections — keep `[Modality.AUDIO]` only

  **WHY Each Reference Matters**:
  - The wsHandler.ts:55-58 reference shows the exact code to replace — executor must match the surrounding try/catch structure
  - The SDK source confirms the correct parameter shape — `{ media: { data, mimeType } }` not an array
  - The liveConfig lines show what to delete — remove the comment on 142 and the two config values on 143-144

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: sendRealtimeInput uses correct object format
    Tool: Bash (grep)
    Preconditions: Task 1 edits applied to wsHandler.ts
    Steps:
      1. Run: grep -n "sendRealtimeInput" "C:\Users\naman\techex-ai-local\src\lib\wsHandler.ts"
      2. Assert output contains "{ media:" (object format)
      3. Assert output does NOT contain "sendRealtimeInput([" (array format)
    Expected Result: Single match showing `sendRealtimeInput({ media: { data: msg.data, mimeType: "audio/pcm;rate=16000" } })`
    Failure Indicators: Line still contains `[{` (array) or `media` key is missing
    Evidence: .sisyphus/evidence/task-1-sendrealtimeinput-format.txt

  Scenario: maxOutputTokens and temperature removed from liveConfig
    Tool: Bash (grep)
    Preconditions: Task 1 edits applied
    Steps:
      1. Run: grep -n "maxOutputTokens\|temperature" "C:\Users\naman\techex-ai-local\src\lib\wsHandler.ts"
      2. Assert: no matches found in the liveConfig section (lines ~136-145)
    Expected Result: grep returns empty (exit code 1) or matches only exist in handleChatStream section (line 240+)
    Failure Indicators: `maxOutputTokens: 150` or `temperature: 0.5` still present in liveConfig
    Evidence: .sisyphus/evidence/task-1-maxoutputtokens-removed.txt

  Scenario: liveConfig structure is still valid (no syntax errors)
    Tool: Bash
    Preconditions: Task 1 edits applied
    Steps:
      1. Run: bun run build
      2. Assert: build completes with exit code 0
    Expected Result: No TypeScript or syntax errors
    Failure Indicators: Build fails with syntax error in wsHandler.ts
    Evidence: .sisyphus/evidence/task-1-build-check.txt
  ```

  **Evidence to Capture**:
  - [ ] task-1-sendrealtimeinput-format.txt — grep output showing correct format
  - [ ] task-1-maxoutputtokens-removed.txt — grep output confirming removal
  - [ ] task-1-build-check.txt — build output showing success

  **Commit**: YES (group with Tasks 2, 3)
  - Message: `fix(voice): fix Gemini Live audio — correct sendRealtimeInput format, model name, sample rate, and playback`
  - Files: `src/lib/wsHandler.ts`, `src/hooks/useWSVoice.js`
  - Pre-commit: `bun run build`

- [ ] 2. Fix model name to verified valid Gemini Live model

  **What to do**:
  - In `C:\Users\naman\techex-ai-local\src\lib\wsHandler.ts`, find the model constant (currently at line 135):
    ```ts
    const model = "gemini-2.5-flash-native-audio-latest";
    ```
  - Change to:
    ```ts
    const model = "gemini-2.5-flash-native-audio-preview-12-2025";
    ```
  - The `-latest` suffix does not appear in any official documentation or SDK examples
  - The SDK source (`index.mjs:15853-15856`) shows `gemini-live-2.5-flash-preview` as an example MLDev model
  - `gemini-2.5-flash-native-audio-preview-12-2025` is confirmed in official Google AI docs
  - **IMPORTANT NOTE**: The session currently connects successfully, which suggests `-latest` may be resolving as an alias. If the renamed model causes connection failures, the executor should try `gemini-live-2.5-flash-preview` as a fallback

  **Must NOT do**:
  - DO NOT change any other line in wsHandler.ts besides the model string
  - DO NOT add model validation logic or fallback code

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - Reason: Single line change — replace one string literal
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 1 — different line in same file, but note: if both tasks edit wsHandler.ts simultaneously, use `ast_grep_search` to find exact pattern before editing to avoid line-number drift)
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 4
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `C:\Users\naman\techex-ai-local\src\lib\wsHandler.ts:135` — Current model name string to replace

  **External References**:
  - Official Google AI docs: `gemini-2.5-flash-native-audio-preview-12-2025` as valid model name
  - SDK source `index.mjs:15853-15856`: `gemini-live-2.5-flash-preview` as MLDev example

  **WHY Each Reference Matters**:
  - Line 135 is the exact location to edit — a single string replacement
  - Official docs confirm the correct model name to use

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Model name is updated to verified valid name
    Tool: Bash (grep)
    Preconditions: Task 2 edit applied
    Steps:
      1. Run: grep -n "gemini-2.5-flash" "C:\Users\naman\techex-ai-local\src\lib\wsHandler.ts"
      2. Assert: output shows "gemini-2.5-flash-native-audio-preview-12-2025"
      3. Assert: output does NOT show "-latest"
    Expected Result: Line shows `const model = "gemini-2.5-flash-native-audio-preview-12-2025"`
    Failure Indicators: `-latest` still present
    Evidence: .sisyphus/evidence/task-2-model-name.txt

  Scenario: No other changes to wsHandler.ts model/config section
    Tool: Bash (grep)
    Preconditions: Task 2 edit applied
    Steps:
      1. Run: grep -n "const model" "C:\Users\naman\techex-ai-local\src\lib\wsHandler.ts"
      2. Assert: exactly one match in the initGeminiLive function
    Expected Result: Single line with correct model name
    Failure Indicators: Multiple model definitions or additional model validation code
    Evidence: .sisyphus/evidence/task-2-model-single.txt
  ```

  **Evidence to Capture**:
  - [ ] task-2-model-name.txt — grep output showing correct model name
  - [ ] task-2-model-single.txt — grep confirming no extra model logic added

  **Commit**: YES (grouped with Task 1, 3)

- [ ] 3. Fix AudioContext sample rate + implement gapless playback

  **What to do**:

  **Part A — Fix AudioContext sample rate (Bug #4):**
  - In `C:\Users\naman\techex-ai-local\src\hooks\useWSVoice.js`, find the AudioContext creation (currently at line 46):
    ```js
    const ctx = new AudioContextClass({ sampleRate: 16000 });
    ```
  - Change to:
    ```js
    const ctx = new AudioContextClass();
    ```
  - Remove the `{ sampleRate: 16000 }` option entirely — let the browser choose its native sample rate (typically 44100 or 48000)
  - The `createBuffer(1, float32.length, 24000)` call in `handleIncomingRawPCM` (line 124) already specifies 24kHz — the browser handles resampling automatically
  - Do NOT change `sampleRate: 16000` in `getUserMedia` constraints (line 217) — that's for mic input capture, which is correct at 16kHz

  **Part B — Implement gapless audio playback (Bug #5):**
  - Replace the current `playNextInQueue` function (lines 72-94) and related playback logic with a `nextStartTime` scheduling pattern
  - Current broken pattern:
    ```js
    source.onended = () => {
      activeSourceRef.current = null;
      playNextInQueue();
    };
    source.start(0);
    ```
  - New pattern (based on official Google `AudioStreamer`):
    ```js
    // Add a ref for tracking next scheduled start time
    const nextStartTimeRef = useRef(0);
    ```
  - In `handleIncomingRawPCM`, replace the queue-and-play logic (lines 127-130) with:
    ```js
    // Schedule playback at the next available time slot
    const ctx = audioContextRef.current;
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(analyserRef.current);

    const now = ctx.currentTime;
    const startTime = Math.max(now, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + audioBuffer.duration;

    setIsSpeaking(true);
    source.onended = () => {
      // Only set speaking to false if no more audio is scheduled
      if (ctx.currentTime >= nextStartTimeRef.current - 0.05) {
        setIsSpeaking(false);
      }
    };
    ```
  - Remove `audioQueueRef`, `isPlayingRef`, and the old `playNextInQueue` function entirely
  - Update `stopSpeaking` to reset `nextStartTimeRef.current = 0` instead of clearing queue
  - Update `handleIncomingRawPCM` to no longer reference `audioQueueRef`, `isPlayingRef`, or `playNextInQueue`

  **Must NOT do**:
  - DO NOT touch `startMicStream` mic capture logic — that's Task 5's scope (AudioWorklet migration)
  - DO NOT modify mic capture logic (`startMicStream`) — that's Task 5's responsibility
  - DO NOT change `getUserMedia` constraints (keep `sampleRate: 16000` for mic input)
  - DO NOT add new npm dependencies
  - DO NOT refactor the WebSocket message handling

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - Reason: Multi-part change touching audio playback architecture — needs careful understanding of Web Audio API scheduling and React ref lifecycle
  - **Skills**: `[]`
  - No special skills needed — changes are in vanilla JS with React hooks
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not needed for implementation, only for final QA
    - `frontend-ui-ux`: No UI/visual changes

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential after Wave 1)
  - **Blocks**: Task 4
  - **Blocked By**: Task 1 (must verify server-side root cause is fixed first)

  **References**:

  **Pattern References** (existing code to follow):
  - `C:\Users\naman\techex-ai-local\src\hooks\useWSVoice.js:43-58` — `initAudio` function with AudioContext creation (line 46 is the target)
  - `C:\Users\naman\techex-ai-local\src\hooks\useWSVoice.js:62-70` — `stopSpeaking` function (needs update to reset nextStartTimeRef)
  - `C:\Users\naman\techex-ai-local\src\hooks\useWSVoice.js:72-94` — Current `playNextInQueue` function (to be replaced entirely)
  - `C:\Users\naman\techex-ai-local\src\hooks\useWSVoice.js:98-131` — `handleIncomingRawPCM` function (lines 127-130 need new scheduling logic)
  - `C:\Users\naman\techex-ai-local\src\hooks\useWSVoice.js:30-34` — Refs for playback queue (some to be replaced with nextStartTimeRef)

  **External References**:
  - Official Google `live-api-web-console` `audio-streamer.ts`: Uses `this.audioCtx.createBufferSource()` + `source.start(this.nextStartTime)` + `this.nextStartTime += source.buffer.duration` pattern
  - Web Audio API spec: `AudioContext()` constructor with no options uses hardware native sample rate; `createBuffer(channels, length, sampleRate)` creates buffer at specified rate — browser resamples to context rate on playback

  **WHY Each Reference Matters**:
  - Lines 43-58 show the AudioContext creation to modify — change only line 46, keep the rest
  - Lines 72-94 are the entire function to replace — understand the `isSpeaking` state management
  - Lines 98-131 show where the new scheduling code goes — replace lines 127-130 with scheduled start
  - Lines 30-34 show refs to clean up — remove `audioQueueRef` and `isPlayingRef`, add `nextStartTimeRef`
  - The Google AudioStreamer shows the exact scheduling pattern to implement

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: AudioContext created with default sample rate (no 16kHz override)
    Tool: Bash (grep)
    Preconditions: Task 3 Part A applied
    Steps:
      1. Run: grep -n "new AudioContextClass" "C:\Users\naman\techex-ai-local\src\hooks\useWSVoice.js"
      2. Assert: line shows `new AudioContextClass()` with no arguments or empty parens
      3. Run: grep -n "sampleRate: 16000" "C:\Users\naman\techex-ai-local\src\hooks\useWSVoice.js"
      4. Assert: only match is in `getUserMedia` constraints (line ~217), NOT in AudioContext
    Expected Result: AudioContext constructor has no sampleRate option; getUserMedia still has sampleRate: 16000
    Failure Indicators: `sampleRate: 16000` still present in AudioContext constructor
    Evidence: .sisyphus/evidence/task-3-samplerate-fix.txt

  Scenario: Gapless playback uses nextStartTime scheduling
    Tool: Bash (grep)
    Preconditions: Task 3 Part B applied
    Steps:
      1. Run: grep -n "nextStartTime" "C:\Users\naman\techex-ai-local\src\hooks\useWSVoice.js"
      2. Assert: matches found showing `nextStartTimeRef` usage with `source.start(startTime)` pattern
      3. Run: grep -n "playNextInQueue" "C:\Users\naman\techex-ai-local\src\hooks\useWSVoice.js"
      4. Assert: no matches (function removed)
    Expected Result: `nextStartTimeRef` present, `playNextInQueue` absent
    Failure Indicators: `playNextInQueue` still exists, or `nextStartTime` pattern missing
    Evidence: .sisyphus/evidence/task-3-gapless-playback.txt

  Scenario: Old queue refs removed, no dangling references
    Tool: Bash (grep)
    Preconditions: Task 3 Part B applied
    Steps:
      1. Run: grep -n "audioQueueRef\|isPlayingRef" "C:\Users\naman\techex-ai-local\src\hooks\useWSVoice.js"
      2. Assert: no matches (both refs removed)
      3. Run: bun run build
      4. Assert: build succeeds (no undefined references)
    Expected Result: No references to removed queue/playing refs; build passes
    Failure Indicators: Dangling refs cause runtime errors or build failure
    Evidence: .sisyphus/evidence/task-3-refs-cleanup.txt
  ```

  **Evidence to Capture**:
  - [ ] task-3-samplerate-fix.txt — grep output showing AudioContext has no sampleRate option
  - [ ] task-3-gapless-playback.txt — grep output showing nextStartTime pattern
  - [ ] task-3-refs-cleanup.txt — grep + build output confirming clean removal

  **Commit**: YES (grouped with Tasks 1, 2)

- [ ] 4. Build verification + server startup check

  **What to do**:
  - Run `bun run build` in `C:\Users\naman\techex-ai-local` and verify it completes with exit code 0
  - Run `bun run start` and verify server starts without errors (check first 10 seconds of output)
  - Verify both target files are syntactically valid by checking build output for errors in `wsHandler.ts` or `useWSVoice.js`
  - If build fails: identify which task's changes caused the error and report back

  **Must NOT do**:
  - DO NOT make any code changes — this is verification only
  - DO NOT modify package.json or install new dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - Reason: Run two commands, check output — no code changes
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential after Wave 2)
  - **Blocks**: F1-F4 (final verification)
  - **Blocked By**: Tasks 1, 2, 3 (all fixes must be applied first)

  **References**:

  **Pattern References**:
  - `C:\Users\naman\techex-ai-local\package.json:4-11` — Scripts section showing `build: "vite build"` and `start: "bun server.ts"`

  **WHY Each Reference Matters**:
  - Package.json confirms the exact build and start commands to run

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Vite build succeeds
    Tool: Bash
    Preconditions: All 3 fix tasks completed
    Steps:
      1. Run: bun run build (working dir: C:\Users\naman\techex-ai-local)
      2. Assert: exit code 0
      3. Assert: output does NOT contain "error" (case-insensitive search)
    Expected Result: Build completes successfully, dist/ directory updated
    Failure Indicators: Non-zero exit code, TypeScript errors, syntax errors
    Evidence: .sisyphus/evidence/task-4-build-output.txt

  Scenario: Server starts without errors
    Tool: Bash
    Preconditions: Build succeeded
    Steps:
      1. Run: timeout 10 bun run start 2>&1 || true (working dir: C:\Users\naman\techex-ai-local)
      2. Assert: output does NOT contain "Error:" or "Cannot find" or "SyntaxError"
      3. Assert: output shows server listening (e.g., port number or "listening" message)
    Expected Result: Server starts and listens without import/syntax/runtime errors
    Failure Indicators: Crash on startup, missing module errors, syntax errors in wsHandler.ts
    Evidence: .sisyphus/evidence/task-4-server-startup.txt
  ```

  **Evidence to Capture**:
  - [ ] task-4-build-output.txt — full build output
  - [ ] task-4-server-startup.txt — first 10 seconds of server output

  **Commit**: YES (this is the commit point — all fix tasks + AudioWorklet grouped)
  - Message: `fix(voice): fix Gemini Live audio + migrate mic to AudioWorklet for lower latency`
  - Files: `src/lib/wsHandler.ts`, `src/hooks/useWSVoice.js`, `public/pcm-processor.js`
  - Pre-commit: `bun run build`

- [ ] 5. Migrate mic capture from ScriptProcessorNode to AudioWorklet

  **What to do**:

  **Part A — Create AudioWorklet processor file:**
  - Create a new file: `C:\Users\naman\techex-ai-local\public\pcm-processor.js`
  - This file defines a `PCMProcessor` class extending `AudioWorkletProcessor`
  - The processor collects incoming audio samples into a fixed-size buffer (4096 samples)
  - When the buffer is full, it sends the Float32Array to the main thread via `this.port.postMessage`
  - Register with: `registerProcessor('pcm-processor', PCMProcessor)`
  - Implementation (from Google's official `generative-ai` demo apps):
    ```js
    class PCMProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this.bufferSize = 4096;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
      }
      process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (!input || !input.length) return true;
        const channelData = input[0];
        for (let i = 0; i < channelData.length; i++) {
          this.buffer[this.bufferIndex++] = channelData[i];
          if (this.bufferIndex >= this.bufferSize) {
            this.port.postMessage(this.buffer.slice());
            this.bufferIndex = 0;
          }
        }
        return true;
      }
    }
    registerProcessor('pcm-processor', PCMProcessor);
    ```

  **Part B — Replace ScriptProcessorNode in `startMicStream()`:**
  - In `C:\Users\naman\techex-ai-local\src\hooks\useWSVoice.js`, find the `startMicStream` function (currently at lines 215-277)
  - Replace the `ScriptProcessorNode` creation and `onaudioprocess` handler with `AudioWorkletNode`
  - The current code (approximately lines 218-260) does:
    1. `getUserMedia` with `sampleRate: 16000` — KEEP THIS
    2. Creates `ScriptProcessorNode(audioContext, 4096, 1, 1)` — REPLACE
    3. `onaudioprocess` handler converts Float32 to Int16, does VAD silence detection, base64-encodes and sends via WebSocket — MOVE to `port.onmessage`
  - New pattern:
    ```js
    // Load the AudioWorklet module
    await audioContextRef.current.audioWorklet.addModule('/pcm-processor.js');
    
    const source = audioContextRef.current.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(audioContextRef.current, 'pcm-processor');
    
    workletNode.port.onmessage = (event) => {
      const float32 = event.data;
      // Keep existing VAD silence-detection logic here (on main thread)
      // Keep existing Float32-to-Int16 conversion here
      // Keep existing base64 encoding + WebSocket send here
    };
    
    source.connect(workletNode);
    // Do NOT connect workletNode to destination (mic capture, not playback)
    ```
  - The VAD silence-detection logic (checking RMS, `silentFrames` counter, `isSilent` flag) stays on the main thread inside `port.onmessage` — do NOT move it into the worklet processor
  - The Float32-to-Int16 conversion, base64 encoding, and WebSocket send stay on the main thread inside `port.onmessage`
  - Store `workletNode` in the same ref that currently holds the ScriptProcessorNode (for cleanup in `stopMicStream`)
  - Make `startMicStream` async (add `async` keyword) since `audioWorklet.addModule()` returns a Promise

  **Part C — Update cleanup in `stopMicStream`:**
  - Find `stopMicStream` and ensure it disconnects the `AudioWorkletNode` properly
  - Pattern: `workletNode.disconnect(); source.disconnect();` (same cleanup as ScriptProcessorNode)

  **Must NOT do**:
  - DO NOT move VAD logic into the worklet processor — keep on main thread via `port.onmessage`
  - DO NOT change the Float32-to-Int16 conversion logic or base64 encoding
  - DO NOT change `getUserMedia` constraints (keep `sampleRate: 16000`)
  - DO NOT change any WebSocket message format or protocol
  - DO NOT add fallback to ScriptProcessorNode — AudioWorklet is supported in all modern browsers
  - DO NOT add error handling beyond what currently exists
  - DO NOT touch playback code (that's Task 3)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - Reason: Requires understanding AudioWorklet API, async module loading, and careful preservation of VAD logic. Not a simple find-replace — needs to restructure the mic capture pipeline while keeping identical behavior.
  - **Skills**: `[]`
  - No special skills needed — changes are in vanilla JS with React hooks

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 3 — Task 3 edits playback code in `handleIncomingRawPCM`/`playNextInQueue`/`initAudio`, Task 5 edits mic capture code in `startMicStream`/`stopMicStream`. Different functions, no overlap.)
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Task 4
  - **Blocked By**: Task 1 (server-side root cause must be fixed first so end-to-end testing is meaningful)

  **References**:

  **Pattern References** (existing code to follow):
  - `C:\Users\naman\techex-ai-local\src\hooks\useWSVoice.js:215-277` — Current `startMicStream` function with ScriptProcessorNode + VAD logic. This is the PRIMARY target to rewrite.
  - `C:\Users\naman\techex-ai-local\src\hooks\useWSVoice.js:279-295` (approx) — `stopMicStream` cleanup function. Update to disconnect AudioWorkletNode.
  - `C:\Users\naman\techex-ai-local\src\hooks\useWSVoice.js:30-34` — Refs used for mic stream/processor. May need to update ref name or type.

  **External References** (CRITICAL — copy these patterns):
  - Official Google demo `pcm-processor.js`: `https://raw.githubusercontent.com/GoogleCloudPlatform/generative-ai/main/gemini/multimodal-live-api/native-audio-websocket-demo-apps/plain-js-python-sdk-demo-app/frontend/pcm-processor.js` — Exact processor implementation to use
  - Google's demo app main.js: Shows `audioContext.audioWorklet.addModule('/pcm-processor.js')` + `new AudioWorkletNode(audioContext, 'pcm-processor')` + `workletNode.port.onmessage` pattern
  - Firebase JS SDK `live-session-helpers.ts`: Shows inline blob alternative if static file serving is problematic: `const blob = new Blob([processorString], { type: 'application/javascript' }); const url = URL.createObjectURL(blob); await audioContext.audioWorklet.addModule(url);`

  **WHY Each Reference Matters**:
  - Lines 215-277 are the exact function to rewrite — executor must understand the VAD logic to preserve it in `port.onmessage`
  - Lines 279-295 show the cleanup pattern that needs matching update
  - The Google demo processor is the battle-tested implementation to copy verbatim
  - The Firebase inline blob is a fallback pattern if Vite's `public/` static serving doesn't work for `addModule`

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: AudioWorklet processor file exists and is valid
    Tool: Bash
    Preconditions: Task 5 Part A completed
    Steps:
      1. Run: type "C:\Users\naman\techex-ai-local\public\pcm-processor.js"
      2. Assert: file exists and contains `registerProcessor('pcm-processor'`
      3. Assert: file contains `class PCMProcessor extends AudioWorkletProcessor`
      4. Assert: file contains `this.port.postMessage`
    Expected Result: Valid AudioWorklet processor file with correct class, buffer logic, and postMessage
    Failure Indicators: File missing, wrong class name, no postMessage call
    Evidence: .sisyphus/evidence/task-5-processor-file.txt

  Scenario: ScriptProcessorNode completely removed from useWSVoice.js
    Tool: Bash (grep)
    Preconditions: Task 5 Part B completed
    Steps:
      1. Run: grep -n "ScriptProcessorNode\|createScriptProcessor\|onaudioprocess" "C:\Users\naman\techex-ai-local\src\hooks\useWSVoice.js"
      2. Assert: no matches (all ScriptProcessorNode references removed)
    Expected Result: Zero matches — ScriptProcessorNode fully replaced
    Failure Indicators: Any remaining ScriptProcessorNode, createScriptProcessor, or onaudioprocess references
    Evidence: .sisyphus/evidence/task-5-scriptprocessor-removed.txt

  Scenario: AudioWorkletNode is used for mic capture
    Tool: Bash (grep)
    Preconditions: Task 5 Part B completed
    Steps:
      1. Run: grep -n "AudioWorkletNode\|audioWorklet.addModule\|pcm-processor" "C:\Users\naman\techex-ai-local\src\hooks\useWSVoice.js"
      2. Assert: matches found for all three patterns
      3. Run: grep -n "port.onmessage" "C:\Users\naman\techex-ai-local\src\hooks\useWSVoice.js"
      4. Assert: match found (main-thread message handler for worklet data)
    Expected Result: AudioWorkletNode creation, addModule call, pcm-processor name, and port.onmessage handler all present
    Failure Indicators: Missing addModule, wrong processor name, no port.onmessage handler
    Evidence: .sisyphus/evidence/task-5-audioworklet-present.txt

  Scenario: VAD logic preserved in main thread (not moved to worklet)
    Tool: Bash (grep)
    Preconditions: Task 5 Part B completed
    Steps:
      1. Run: grep -n "silentFrames\|isSilent\|rms" "C:\Users\naman\techex-ai-local\src\hooks\useWSVoice.js"
      2. Assert: matches found — VAD logic still exists in the hook file
      3. Run: grep -n "silentFrames\|isSilent\|rms" "C:\Users\naman\techex-ai-local\public\pcm-processor.js"
      4. Assert: no matches — VAD logic NOT in the processor
    Expected Result: VAD remains in useWSVoice.js, absent from pcm-processor.js
    Failure Indicators: VAD logic moved into processor or deleted entirely
    Evidence: .sisyphus/evidence/task-5-vad-preserved.txt

  Scenario: Build succeeds with AudioWorklet changes
    Tool: Bash
    Preconditions: All Task 5 parts applied
    Steps:
      1. Run: bun run build (working dir: C:\Users\naman\techex-ai-local)
      2. Assert: exit code 0, no errors
    Expected Result: Build passes cleanly
    Failure Indicators: Import errors, syntax errors in modified files
    Evidence: .sisyphus/evidence/task-5-build-check.txt
  ```

  **Evidence to Capture**:
  - [ ] task-5-processor-file.txt — contents of pcm-processor.js
  - [ ] task-5-scriptprocessor-removed.txt — grep confirming no ScriptProcessorNode
  - [ ] task-5-audioworklet-present.txt — grep confirming AudioWorkletNode usage
  - [ ] task-5-vad-preserved.txt — grep confirming VAD in hook, not in processor
  - [ ] task-5-build-check.txt — build output

  **Commit**: YES (grouped with Tasks 1, 2, 3)
---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists by reading `C:\Users\naman\techex-ai-local\src\lib\wsHandler.ts`, `C:\Users\naman\techex-ai-local\src\hooks\useWSVoice.js`, and `C:\Users\naman\techex-ai-local\public\pcm-processor.js`. For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `bun run build` (Vite build). Review all changed lines in `wsHandler.ts`, `useWSVoice.js`, and `public/pcm-processor.js` for: syntax errors, `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check that no changes leaked into other files. Verify build succeeds.
  Output: `Build [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Start server with `bun run start`. Open the app in Playwright browser. Activate Gemini Live voice mode. Verify: (1) console shows "Session ready", (2) console shows "Setup complete", (3) No "sendRealtimeInput error" messages, (4) `audio_out` messages appear, (5) No `ScriptProcessorNode` deprecation warnings in console, (6) No AudioWorklet loading errors. Capture console output and screenshots to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  Read all three target files (`wsHandler.ts`, `useWSVoice.js`, `public/pcm-processor.js`). For each of the 5 bugs + AudioWorklet migration: verify the fix was applied as specified and NOTHING ELSE was changed. Check "Must NOT Have" compliance — scan all files for unplanned modifications. Flag any changes to `sendClientContent`, `handleChatStream`, `systemInstruction`, or VAD logic being moved into the worklet. Verify `ScriptProcessorNode` is fully removed from `useWSVoice.js`. Verify no other files were modified.
  Output: `Tasks [N/N compliant] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Single commit** after all 5 bug fixes + AudioWorklet migration are applied and build passes:
  - Message: `fix(voice): fix Gemini Live audio + migrate mic to AudioWorklet for lower latency`
  - Files: `src/lib/wsHandler.ts`, `src/hooks/useWSVoice.js`, `public/pcm-processor.js`
  - Pre-commit: `bun run build`

---

## Success Criteria

### Verification Commands
```bash
# Build must pass
bun run build  # Expected: no errors

# Server must start
bun run start  # Expected: no errors, "[Gemini Live]" ready messages on connect

# Pattern checks
grep -n "sendRealtimeInput" src/lib/wsHandler.ts  # Expected: contains "{ media:"
grep -n "maxOutputTokens" src/lib/wsHandler.ts  # Expected: no matches OR value > 1000
grep -n "sampleRate: 16000" src/hooks/useWSVoice.js  # Expected: only in getUserMedia, NOT in AudioContext
grep -n "nextStartTime" src/hooks/useWSVoice.js  # Expected: matches found (gapless scheduling)
grep -n "AudioWorkletNode" src/hooks/useWSVoice.js  # Expected: matches found (worklet migration)
grep -n "ScriptProcessorNode\|createScriptProcessor\|onaudioprocess" src/hooks/useWSVoice.js  # Expected: no matches
grep -n "registerProcessor" public/pcm-processor.js  # Expected: match found

### Final Checklist
- [ ] All "Must Have" present (5 bug fixes + AudioWorklet migration applied)
- [ ] All "Must NOT Have" absent (no scope creep, no wrong-file edits, VAD on main thread)
- [ ] `public/pcm-processor.js` exists with correct AudioWorklet processor
- [ ] No `ScriptProcessorNode` references remain in `useWSVoice.js`
- [ ] Build passes (`bun run build`)
- [ ] Server starts cleanly (`bun run start`)
