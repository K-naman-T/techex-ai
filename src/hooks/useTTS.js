import { useState, useCallback, useRef, useEffect } from 'react';

export const useTTS = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [provider, setProvider] = useState('sarvam'); // 'sarvam' or 'elevenlabs'
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const sentenceQueueRef = useRef([]);
  const audioBufferQueueRef = useRef([]); // Stores promises of processed AudioBuffers
  const isProcessingRef = useRef(false);
  const analyserRef = useRef(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContextClass();

      // Create AnalyserNode
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.connect(audioContextRef.current.destination);
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const warmup = useCallback(() => {
    try {
      getAudioContext();
      console.log("[TTS] AudioContext warmed up.");
    } catch (e) { console.error("Warmup failed", e); }
  }, [getAudioContext]);

  const stop = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) { }
      sourceNodeRef.current = null;
    }
    sentenceQueueRef.current = [];
    audioBufferQueueRef.current = [];
    isProcessingRef.current = false;
    setIsSpeaking(false);
  }, []);

  // Internal function to fetch and decode audio for a sentence
  const fetchAudioBuffer = useCallback(async (text) => {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer guest-token'
        },
        body: JSON.stringify({ text, provider }),
      });

      if (!response.ok) {
        console.error("TTS Backend Error");
        return null;
      }

      const data = await response.json();
      const audioContent = data.audioContent;

      const binaryString = window.atob(audioContent);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const ctx = getAudioContext();
      return await ctx.decodeAudioData(bytes.buffer);
    } catch (error) {
      console.error("Audio Fetch/Decode Error:", error);
      return null;
    }
  }, [getAudioContext, provider]);

  // Process the buffer queue sequentially for playback
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    while (audioBufferQueueRef.current.length > 0) {
      const bufferPromise = audioBufferQueueRef.current.shift();
      const audioBuffer = await bufferPromise;

      if (audioBuffer) {
        await new Promise((resolve) => {
          const ctx = getAudioContext();
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;

          source.connect(analyserRef.current);
          setIsSpeaking(true);

          source.onended = () => {
            resolve();
          };
          sourceNodeRef.current = source;
          source.start(0);
        });
      }
    }

    isProcessingRef.current = false;
    setIsSpeaking(false);
  }, [getAudioContext]);

  // Queue a sentence: Immediately start fetching and then process playback
  const queueSentence = useCallback((sentence) => {
    if (!sentence || !sentence.trim()) return;

    // Start fetching audio immediately and store the promise
    const bufferPromise = fetchAudioBuffer(sentence);
    audioBufferQueueRef.current.push(bufferPromise);

    // Trigger sequential playback loop
    processQueue();
  }, [fetchAudioBuffer, processQueue]);

  // Original speak function (speaks entire text at once)
  const speak = useCallback(async (text) => {
    stop();
    if (!text) return;
    queueSentence(text);
  }, [stop, queueSentence]);

  useEffect(() => {
    return () => {
      stop();
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [stop]);

  return {
    speak,
    stop,
    warmup,
    isSpeaking,
    queueSentence,
    provider,
    setProvider,
    analyser: analyserRef.current
  };
};


