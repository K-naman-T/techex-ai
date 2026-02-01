import { useState, useCallback, useRef, useEffect } from 'react';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

const SPEECH_KEY = import.meta.env.VITE_AZURE_SPEECH_KEY;
const SPEECH_REGION = import.meta.env.VITE_AZURE_SPEECH_REGION;

export const useAzureAudio = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synthesizerRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (synthesizerRef.current) {
        synthesizerRef.current.close();
        synthesizerRef.current = null;
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const initSynthesizer = () => {
    if (synthesizerRef.current) {
        try { synthesizerRef.current.close(); } catch(e) {}
    }
    
    if (!SPEECH_KEY || !SPEECH_REGION) return null;

    const speechConfig = sdk.SpeechConfig.fromSubscription(SPEECH_KEY, SPEECH_REGION);
    speechConfig.speechSynthesisVoiceName = "en-US-AndrewNeural"; 
    
    const audioConfig = sdk.AudioConfig.fromDefaultSpeakerOutput();
    const synth = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

    synth.speakingStarted = () => setIsSpeaking(true);
    
    // Safety cleanup
    const cleanup = () => {
        setIsSpeaking(false);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };

    synth.speakingStopped = cleanup;
    synth.canceled = cleanup;

    synthesizerRef.current = synth;
    return synth;
  };

  const stop = useCallback(() => {
    if (synthesizerRef.current) {
      try { synthesizerRef.current.close(); } catch(e) {}
      synthesizerRef.current = null;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((text) => {
    stop(); // Reset

    if (!text || typeof text !== 'string') {
        console.warn("Invalid text passed to speak:", text);
        return;
    }

    const synthesizer = initSynthesizer();
    if (!synthesizer) return;

    const durationEstimate = (text.length / 15) * 1000 + 2000;
    
    timeoutRef.current = setTimeout(() => {
        // console.warn("Speech timeout reached");
        setIsSpeaking(false);
    }, durationEstimate);

    setIsSpeaking(true);

    const cleanText = text.replace(/[*#_`>]/g, '').replace(/\[.*?\]/g, '').trim();

    synthesizer.speakTextAsync(
      cleanText,
      result => {
        if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted) {
            setIsSpeaking(false);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        }
      },
      error => {
        console.error(error);
        setIsSpeaking(false);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
    );
  }, [stop]);

  return { speak, stop, isSpeaking };
};