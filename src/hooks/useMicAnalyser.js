import { useState, useEffect, useRef } from 'react';

/**
 * Hook to capture microphone audio and provide an analyser node.
 * Useful for visualizers that need to react to user input.
 */
export const useMicAnalyser = (isListening) => {
  const [analyser, setAnalyser] = useState(null);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (isListening) {
      const initMic = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;

          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          const ctx = new AudioContextClass();
          audioContextRef.current = ctx;

          const analyserNode = ctx.createAnalyser();
          analyserNode.fftSize = 256;
          
          const source = ctx.createMediaStreamSource(stream);
          source.connect(analyserNode);
          sourceRef.current = source;

          setAnalyser(analyserNode);
        } catch (err) {
          console.error("Error accessing microphone for visualizer:", err);
        }
      };

      initMic();
    } else {
      // Cleanup
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (analyser) {
        setAnalyser(null);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    }
  }, [isListening]);

  return analyser;
};
