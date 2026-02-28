import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useWSVoice - Unified hook for WebSocket-based Speech-to-Speech
 * Supports TWO backends:
 *   1. "sarvam" - Continuous mic → Sarvam STT (server-side VAD) → Gemini Flash → TTS
 *   2. "gemini_live" - Continuous mic → Gemini Live API (built-in VAD+STT+LLM+TTS)
 *
 * NOTE: No client-side VAD — both backends use server-side VAD.
 *       Mic audio is streamed continuously via AudioWorkletNode.
 */
export const useWSVoice = ({ onShowMap } = {}) => {
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

  const nextStartTimeRef = useRef(0);
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
      const ctx = new AudioContextClass({ latencyHint: 'interactive' });
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
    nextStartTimeRef.current = 0;
    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop(); } catch (e) { }
      activeSourceRef.current = null;
    }
    setIsSpeaking(false);
  }, []);



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

    // Gapless playback with scheduled start time
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(analyserRef.current);

    const now = ctx.currentTime;
    const startTime = Math.max(now, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + audioBuffer.duration;

    setIsSpeaking(true);
    source.onended = () => {
      if (ctx.currentTime >= nextStartTimeRef.current - 0.05) {
        setIsSpeaking(false);
      }
    };
  }, [initAudio]);
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

          case 'show_map':
            console.log('[WS] Map trigger received:', msg.stallId);
            if (onShowMap) onShowMap(msg.stallId);
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
    await audioCtx.audioWorklet.addModule('/pcm-processor.js');
    const source = audioCtx.createMediaStreamSource(stream);

    // Use AudioWorkletNode for continuous PCM capture (server-side VAD handles silence detection)
    const workletNode = new AudioWorkletNode(audioCtx, 'pcm-processor');
    workletNode.port.onmessage = (e) => {
      if (!isVoiceModeActiveRef.current) return;
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;

      const float32 = e.data;

      // Convert to PCM16 Base64
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

    source.connect(workletNode);
    micProcessorRef.current = { source, workletNode };

    console.log(`[Mic] Streaming started (type: ${messageType})`);
  }, [initAudio]);

  const stopMicStream = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (micProcessorRef.current) {
      micProcessorRef.current.source.disconnect();
      micProcessorRef.current.workletNode.disconnect();
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
          language: language,
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
