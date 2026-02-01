import { useState, useCallback, useRef, useEffect } from 'react';

export const useTTS = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [provider, setProvider] = useState('sarvam'); // 'sarvam' | 'google' | 'elevenlabs'
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);

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
      try { sourceNodeRef.current.stop(); } catch (e) {}
      sourceNodeRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(async (text) => {
    stop();
    if (!text) return;

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, provider }), // Send selected provider
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

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      source.onended = () => setIsSpeaking(false);

      sourceNodeRef.current = source;
      source.start(0);
      setIsSpeaking(true);

    } catch (error) {
      console.error("Audio Playback Error:", error);
      setIsSpeaking(false);
    }
  }, [stop, provider]);

  useEffect(() => {
    return () => {
      stop();
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [stop]);

  return { speak, stop, isSpeaking, provider, setProvider };
};
