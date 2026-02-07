import { useState, useCallback, useRef, useEffect } from 'react';

export const useTTS = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [provider, setProvider] = useState('elevenlabs'); // 'elevenlabs' or 'sarvam'
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const sentenceQueueRef = useRef([]);
  const isProcessingRef = useRef(false);

  const analyserRef = useRef(null);

  const getAudioContext = () => {
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
  };

  const stop = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) { }
      sourceNodeRef.current = null;
    }
    sentenceQueueRef.current = [];
    isProcessingRef.current = false;
    setIsSpeaking(false);
  }, []);

  // Internal function to play a single audio buffer
  const playAudioBuffer = useCallback(async (text) => {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, provider }),
      });

      if (!response.ok) {
        console.error("TTS Backend Error");
        return;
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
      const audioBuffer = await ctx.decodeAudioData(bytes.buffer);

      return new Promise((resolve) => {
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;

        // Connect source to Analyser instead of ctx.destination
        source.connect(analyserRef.current);

        // Only set isSpeaking TRUE when audio actually starts
        setIsSpeaking(true);

        source.onended = () => {
          resolve();
        };
        sourceNodeRef.current = source;
        source.start(0);
      });
    } catch (error) {
      console.error("Audio Playback Error:", error);
    }
  }, [provider]);

  // Process the sentence queue sequentially
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    while (sentenceQueueRef.current.length > 0) {
      const sentence = sentenceQueueRef.current.shift();
      if (sentence) {
        await playAudioBuffer(sentence);
      }
    }

    isProcessingRef.current = false;
    setIsSpeaking(false);
  }, [playAudioBuffer]);

  // Queue a sentence for TTS playback
  const queueSentence = useCallback((sentence) => {
    if (!sentence || !sentence.trim()) return;
    sentenceQueueRef.current.push(sentence);
    processQueue();
  }, [processQueue]);

  // Original speak function (speaks entire text at once)
  const speak = useCallback(async (text) => {
    stop();
    if (!text) return;
    sentenceQueueRef.current.push(text);
    processQueue();
  }, [stop, processQueue]);

  useEffect(() => {
    return () => {
      stop();
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [stop]);

  return {
    speak,
    stop,
    isSpeaking,
    queueSentence,
    provider,
    setProvider,
    analyser: analyserRef.current
  };
};


