import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for Speech-to-Text using Web Speech API
 * Works in Chrome, Edge, Safari (partial). Firefox not supported.
 * Supports: 'en-IN' (English India), 'hi-IN' (Hindi)
 */
export const useSTT = () => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [error, setError] = useState(null);
    const [isSupported, setIsSupported] = useState(false);
    const [language, setLanguage] = useState('en-IN'); // 'en-IN' or 'hi-IN'

    const recognitionRef = useRef(null);

    // Recreate recognition when language changes
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setIsSupported(false);
            setError('Speech Recognition not supported in this browser');
            return;
        }

        setIsSupported(true);

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = language; // Use current language
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
            setError(null);
            setTranscript('');
            setInterimTranscript('');
        };

        recognition.onresult = (event) => {
            let interim = '';
            let final = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    final += result[0].transcript;
                } else {
                    interim += result[0].transcript;
                }
            }

            if (final) {
                setTranscript(final);
                setInterimTranscript('');
            } else {
                setInterimTranscript(interim);
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech Recognition Error:', event.error);
            let userFriendlyError = event.error;

            if (event.error === 'network') {
                userFriendlyError = 'Network Error: Browser speech services are unreachable. Ensure you have internet and are using HTTPS or localhost.';
            } else if (event.error === 'not-allowed') {
                userFriendlyError = 'Permission Denied: Mic access was blocked by the browser.';
            }

            setError(userFriendlyError);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
        };
    }, [language]); // Re-initialize when language changes

    const startListening = useCallback(() => {
        if (recognitionRef.current && !isListening) {
            try {
                recognitionRef.current.start();
            } catch (e) {
                console.error('Failed to start recognition:', e);
            }
        }
    }, [isListening]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
        }
    }, [isListening]);

    const resetTranscript = useCallback(() => {
        setTranscript('');
        setInterimTranscript('');
    }, []);

    return {
        isListening,
        transcript,
        interimTranscript,
        error,
        isSupported,
        startListening,
        stopListening,
        resetTranscript,
        language,
        setLanguage, // Expose this so UI can switch between en-IN and hi-IN
    };
};
