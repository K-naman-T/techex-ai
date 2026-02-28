import { create } from 'zustand';

/**
 * Global application state.
 */
export const useStore = create((set, get) => ({
    // --- Chat Slice ---
    messages: [{ role: 'model', text: 'Hello! I am your AI Avatar running on Gemini 3 Flash. Ask me anything.' }],
    isStreaming: false,
    isLoading: false,

    addMessage: (role, text) => set((state) => ({
        messages: [...state.messages, { role, text }]
    })),

    /**
     * Sends a message to the backend and handles the streaming response.
     */
    sendMessage: async (text) => {
        const { addMessage, messages } = get();

        // 1. Add User Message
        addMessage('user', text);
        set({ isLoading: true, isStreaming: true });

        try {
            // 2. Prepare History (excluding system messages if any specific handling needed)
            // The backend will likely need the full context or we send the last N messages
            const history = messages.map(m => ({ role: m.role, text: m.text }));

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, history }),
            });

            if (!response.ok) throw new Error('API request failed');

            // 3. Handle Streaming Response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            // Add placeholder for model response
            addMessage('model', '');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                fullResponse += chunk;

                // Update the last message (model)
                set((state) => {
                    const newMessages = [...state.messages];
                    newMessages[newMessages.length - 1] = { role: 'model', text: fullResponse };
                    return { messages: newMessages, currentResponse: fullResponse };
                });

                // Trigger Avatar Talking State (Simple heuristic: if receiving data, we are 'talking')
                // Ideally, this is driven by the audio playback, but this is a fallback visual cue
                if (get().interactionState !== 'talking') {
                    get().setInteractionState('talking');
                }
            }

            // Stream finished
            set({ isStreaming: false, isLoading: false, interactionState: 'idle' });

        } catch (error) {
            console.error('Chat Error:', error);
            addMessage('model', 'Sorry, I encountered an error connecting to the server.');
            set({ isLoading: false, isStreaming: false, interactionState: 'idle' });
        }
    },

    // --- Avatar Slice ---
    interactionState: 'idle', // 'idle' | 'listening' | 'talking' | 'thinking'
    setInteractionState: (state) => set({ interactionState: state }),

    // --- UI Slice ---
    themeMode: 'dark', // 'light' | 'dark'
    toggleTheme: () => set((state) => ({ themeMode: state.themeMode === 'light' ? 'dark' : 'light' })),
}));
