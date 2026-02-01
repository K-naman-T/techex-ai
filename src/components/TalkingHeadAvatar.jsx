import React, { useEffect, useRef } from 'react';
import { TalkingHead } from '@met4citizen/talkinghead';
import { useStore } from '../state/store';

export default function TalkingHeadAvatar() {
    const containerRef = useRef(null);
    const headRef = useRef(null);
    const lastMessageRef = useRef('');
    const speechBuffer = useRef('');

    // Subscribe to store updates
    const messages = useStore((state) => state.messages);
    const isTalking = useStore((state) => state.isTalking);

    useEffect(() => {
        if (!containerRef.current) return;

        // 1. Initialize TalkingHead
        const head = new TalkingHead(containerRef.current, {
            ttsEndpoint: "https://eu-text-to-speech.googleapis.com/v1/text:synthesize",
            cameraView: "upper",
            cameraDistance: 1.5,
            avatarMood: "neutral",
            modulesPath: "/met4citizen/modules/"
        });

        headRef.current = head;

        // 2. Load the Model
        const loadAvatar = async () => {
            try {
                await head.showAvatar({
                    url: '/models/avatar.glb',
                    body: 'M', // Assumption, can be 'F'
                    avatarMood: 'neutral',
                    lipsyncLang: 'en'
                }, (progress) => {
                    console.log(`Loading Avatar: ${progress}%`);
                });
                console.log("Avatar loaded successfully");
            } catch (error) {
                console.error("Failed to load avatar:", error);
            }
        };

        loadAvatar();

        return () => {
            if (headRef.current) {
                headRef.current.stop(); // Stop any speech
                // Cleanup if method exists, otherwise just clear ref
                headRef.current = null;
            }
        };
    }, []);

    // 3. Handle Speech (Reactive to Store)
    useEffect(() => {
        if (!headRef.current) return;

        // Get the last message
        const lastMsg = messages[messages.length - 1];

        // Check if it's a NEW AI message that needs to be spoken
        // Check if it's a NEW AI message that needs to be spoken
        if (lastMsg && lastMsg.role === 'model') {
            const newText = lastMsg.text;

            // Only process if text has grown
            if (newText.length > lastMessageRef.current.length) {
                const chunk = newText.slice(lastMessageRef.current.length);
                speechBuffer.current += chunk;

                // Check for sentence completion punctuations
                // We use a regex that looks for [.!?] followed by whitespace or end of string
                // or just a newline.
                if (/([.!?]\s)|(\n)|([.!?]$)/.test(speechBuffer.current)) {
                    // Speak the accumulated buffer
                    if (headRef.current && speechBuffer.current.trim().length > 0) {
                        console.log('Speaking Chunk:', speechBuffer.current);
                        headRef.current.speakText(speechBuffer.current);
                        speechBuffer.current = '';
                    }
                }
            }

            lastMessageRef.current = newText;
        }
    }, [messages]);

    // Direct subscription to a "speak" action might be better to avoid React render cycles for stream
    // Let's try to attach to the window for debugging first, or just run logic in `useStore` subscription.

    return (
        <div
            id="avatar-container"
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 0,
                background: 'linear-gradient(to top, #0f0f11, #1a1a1e)'
            }}
        />
    );
}
