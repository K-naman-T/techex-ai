import { useState, useCallback, useRef, useEffect } from 'react';

export const useGoogleCloudAudio = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);

  // Initialize Audio Context on user interaction (lazy load)
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const stop = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) {
        // ignore if already stopped
      }
      sourceNodeRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(async (text) => {
    stop(); // Stop previous

    if (!text) return;

    try {
      // 1. Fetch Audio from Backend
      // Using direct port 3001 if proxy isn't perfect, or relative /api if proxy works.
      // Based on vite.config.js, /api is proxied to 3001.
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const err = await response.json();
        console.error("TTS Backend Error:", err);
        return;
      }

      const data = await response.json();
      const audioContent = data.audioContent; // Base64 string

      // 2. Decode Base64
      const binaryString = window.atob(audioContent);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // 3. Play Audio via Web Audio API
      const ctx = getAudioContext();
      const audioBuffer = await ctx.decodeAudioData(bytes.buffer);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      source.onended = () => {
        setIsSpeaking(false);
      };

      sourceNodeRef.current = source;
      source.start(0);
      setIsSpeaking(true);

    } catch (error) {
      console.error("Audio Playback Error:", error);
      setIsSpeaking(false);
    }
  }, [stop]);

  // Cleanup
  useEffect(() => {
    return () => {
      stop();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stop]);

  return { speak, stop, isSpeaking };
};
