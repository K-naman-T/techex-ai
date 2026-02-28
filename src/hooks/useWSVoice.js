import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useWSVoice - Unified hook for WebSocket-based Speech-to-Speech
 * Supports TWO backends:
 *   1. "sarvam" - Continuous mic → Sarvam STT (server-side VAD) → Gemini Flash → TTS
 *   2. "gemini_live" - Continuous mic → Gemini Live API (built-in VAD+STT+LLM+TTS)
 *
 * NOTE: No client-side VAD — both backends use server-side VAD.
 *       Mic audio is streamed continuously via ScriptProcessorNode.
 */
export const useWSVoice = () => {
  // Connection & Active States
  const [isConnected, setIsConnected] = useState(false);
  const [isVoiceModeActive, setIsVoiceModeActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeBackend, setActiveBackend] = useState('gemini_live');

  // Data States
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [chatResponse, setChatResponse] = useState('');

  // Refs for Web Audio & WS
  const audioContextRef = useRef(null);
  const wsRef = useRef(null);
  const isVoiceModeActiveRef = useRef(false);

  // Refs for Playback Queue
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const analyserRef = useRef(null);
  const activeSourceRef = useRef(null);

  // Mic streaming refs (shared by both backends)
  const micStreamRef = useRef(null);
  const micProcessorRef = useRef(null);
  const activeBackendRef = useRef('gemini_live');
  const lastLanguageRef = useRef('hi-IN');

  // Initialize Web Audio Context & Analyser
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // ============= PLAYBACK =============

  const stopSpeaking = useCallback(() => {
    audioQueueRef.current = [];
    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop(); } catch (e) { }
      activeSourceRef.current = null;
    }
    isPlayingRef.current = false;
    setIsSpeaking(false);
  }, []);

  const playNextInQueue = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);
    const ctx = initAudio();
    const buffer = audioQueueRef.current.shift();

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(analyserRef.current);

    source.onended = () => {
      activeSourceRef.current = null;
      playNextInQueue();
    };
    activeSourceRef.current = source;
    source.start(0);
  }, [initAudio]);


  // Raw PCM decode (for Gemini Live — sends raw 24kHz 16-bit PCM)
  const handleIncomingRawPCM = useCallback((base64, sampleRate = 24000) => {
    const ctx = initAudio();
    const binary = atob(base64);

    // Ensure byte length is even for 16-bit PCM
    const validBytes = binary.length - (binary.length % 2);

    // Create an ArrayBuffer to hold the raw bytes
    const buffer = new ArrayBuffer(validBytes);
    const view = new Uint8Array(buffer);

    for (let i = 0; i < validBytes; i++) {
      view[i] = binary.charCodeAt(i);
    }

    // Read explicitly as Little-Endian Int16 (Gemini native format)
    const dataView = new DataView(buffer);
    const float32 = new Float32Array(validBytes / 2);

    // Convert Int16 to Float32 [-1.0, 1.0] for Web Audio API
    for (let i = 0; i < float32.length; i++) {
      const int16 = dataView.getInt16(i * 2, true); // true = Little Endian
      float32[i] = int16 / 32768.0;
    }

    // Create AudioBuffer
    const audioBuffer = ctx.createBuffer(1, float32.length, sampleRate);
    audioBuffer.getChannelData(0).set(float32);

    audioQueueRef.current.push(audioBuffer);
    if (!isPlayingRef.current) {
      playNextInQueue();
    }
  }, [initAudio, playNextInQueue]);

  // ============= WEBSOCKET =============

  const connect = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        resolve(wsRef.current);
        return;
      }

      if (wsRef.current?.readyState === WebSocket.CONNECTING) {
        const waitForOpen = () => {
          if (wsRef.current?.readyState === WebSocket.OPEN) resolve(wsRef.current);
          else if (wsRef.current?.readyState === WebSocket.CLOSED) reject(new Error("WS closed during connection"));
          else setTimeout(waitForOpen, 50);
        };
        waitForOpen();
        return;
      }

      console.log("[WS] Attempting to connect...");
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const ws = new WebSocket(`${protocol}//${host}/api/ws`);

      ws.onopen = () => {
        console.log("[WS] Connection established.");
        setIsConnected(true);
        resolve(ws);
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'chat_delta':
            setChatResponse(prev => prev + msg.text);
            break;
          case 'chat_complete':
            break;
          case 'audio_out':
            // AI is speaking → user is no longer "listening"
            setIsListening(false);
            handleIncomingRawPCM(msg.data, 24000);
            break;

          // === Gemini Live messages ===
          case 'gemini_live_ready':
            console.log("[GeminiLive] Session ready.");
            setIsListening(true);
            break;
          case 'gemini_live_interrupted':
            console.log("[GeminiLive] Response interrupted by user.");
            stopSpeaking();
            setIsListening(true); // User interrupted → back to listening
            break;
          case 'gemini_live_turn_complete':
            console.log("[GeminiLive] Turn complete.");
            // AI finished speaking → back to listening for user
            if (isVoiceModeActiveRef.current) {
              setIsListening(true);
            }
            break;

          case 'error':
            console.error("[WS] Server Error:", msg.message);
            break;
        }
      };

      ws.onclose = () => {
        console.log("[WS] Disconnected");
        setIsConnected(false);
        wsRef.current = null;
      };

      ws.onerror = (err) => console.error("[WS] Error", err);

      wsRef.current = ws;
    });
  }, [handleIncomingRawPCM, stopSpeaking]);

  // ============= SHARED: Mic Capture (used by both backends) =============

  const startMicStream = useCallback(async (messageType) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
    });
    micStreamRef.current = stream;

    const audioCtx = initAudio();
    const source = audioCtx.createMediaStreamSource(stream);

    // VAD Configuration: Stop sending chunks if volume stays below threshold
    // Using a simple RMS (Root Mean Square) calculation
    const silenceThreshold = 0.01; // Adjust this based on mic sensitivity
    let silenceChunkCount = 0;
    const maxSilenceChunks = 20; // ~1.2 seconds of silence before cutting stream (adjusted for smaller buffer)

    // Use ScriptProcessorNode for continuous PCM capture
    const processor = audioCtx.createScriptProcessor(1024, 1, 1);
    processor.onaudioprocess = (e) => {
      if (!isVoiceModeActiveRef.current) return;
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;

      const float32 = e.inputBuffer.getChannelData(0);

      // 1. Calculate Volume (RMS)
      let sumSquares = 0.0;
      for (let i = 0; i < float32.length; i++) {
        sumSquares += float32[i] * float32[i];
      }
      const rms = Math.sqrt(sumSquares / float32.length);

      // 2. VAD Logic
      if (rms < silenceThreshold) {
        silenceChunkCount++;
      } else {
        silenceChunkCount = 0; // Reset on sound
      }

      // 3. Skip sending if we've been silent for too long
      // (Keeps sending a few silent chunks to ensure trailing audio isn't cut)
      if (silenceChunkCount > maxSilenceChunks) {
        return; // Skip WebSocket send to save bandwidth/latency
      }

      // 4. Convert to PCM16 Base64
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        int16[i] = Math.max(-1, Math.min(1, float32[i])) * 0x7FFF;
      }

      const uint8 = new Uint8Array(int16.buffer);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      const base64 = btoa(binary);

      wsRef.current.send(JSON.stringify({ type: messageType, data: base64 }));
    };

    source.connect(processor);
    processor.connect(audioCtx.destination);
    micProcessorRef.current = { source, processor };

    console.log(`[Mic] Streaming started (type: ${messageType})`);
  }, [initAudio]);

  const stopMicStream = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (micProcessorRef.current) {
      micProcessorRef.current.source.disconnect();
      micProcessorRef.current.processor.disconnect();
      micProcessorRef.current = null;
    }
    console.log("[Mic] Streaming stopped.");
  }, []);


  // ============= GEMINI LIVE MODE =============

  const toggleGeminiLiveMode = useCallback(async (language = 'hi', userMetadata = null) => {
    const newState = !isVoiceModeActive;
    setIsVoiceModeActive(newState);
    isVoiceModeActiveRef.current = newState;
    activeBackendRef.current = 'gemini_live';
    setActiveBackend('gemini_live');

    if (newState) {
      console.log("[GeminiLive] Activating...");

      // iOS / Safari: AudioContext MUST be resumed on user gesture
      const ctx = initAudio();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      try {
        const ws = await connect();
        // Tell backend to start Gemini Live session with personalization
        // Safety check: Ensure userMetadata only contains serializable fields
        const safeMetadata = userMetadata && typeof userMetadata === 'object'
          ? { name: userMetadata.name, interests: userMetadata.interests }
          : null;

        ws.send(JSON.stringify({
          type: 'start_gemini_live',
          language: language.startsWith('hi') ? 'hi' : 'en',
          userMetadata: safeMetadata
        }));
        // Start continuous mic streaming
        await startMicStream('gemini_audio_in');
        setIsListening(true);
      } catch (err) {
        console.error("[GeminiLive] Failed to activate:", err);
        setIsVoiceModeActive(false);
        isVoiceModeActiveRef.current = false;
        setActiveBackend('gemini_live');
      }
    } else {
      console.log("[GeminiLive] Deactivating...");
      stopMicStream();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'stop_gemini_live' }));
      }
      stopSpeaking();
      setIsListening(false);
    }
  }, [isVoiceModeActive, connect, startMicStream, stopMicStream, stopSpeaking, initAudio]);

  // ============= CHAT (Text) =============

  const sendChat = useCallback(async (text, conversation_id, history = [], language = 'en', userMetadata = {}) => {
    const ws = await connect();
    setChatResponse('');
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'chat',
        message: text,
        conversation_id,
        history,
        language,
        userMetadata
      }));
    }
  }, [connect]);

  // ============= CLEANUP =============

  useEffect(() => {
    let isMounted = true;
    let localSocket = null;

    connect().then(socket => {
      if (!isMounted && socket.readyState === WebSocket.OPEN) socket.close();
      else localSocket = socket;
    });

    return () => {
      isMounted = false;
      if (localSocket?.readyState === WebSocket.OPEN) localSocket.close();
      stopMicStream();
    };
  }, [connect, stopMicStream]);

  return {
    isConnected,
    isVoiceModeActive,
    isListening,
    isSpeaking,
    activeBackend,
    transcript,
    interimTranscript,
    chatResponse,
    toggleGeminiLiveMode,   // Gemini Live (unified audio-in/out)
    sendChat,
    stopSpeaking,
    analyser: analyserRef.current,
    warmup: initAudio
  };
};
