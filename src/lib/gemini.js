/**
 * Streaming chat function - calls the backend WebSocket for Gemini Flash responses.
 * This file is kept for backwards compatibility with components that import from it.
 * The actual Gemini calls happen server-side in wsHandler.ts.
 */

// Non-streaming fallback — calls WebSocket chat endpoint
export const getGeminiResponse = async (prompt) => {
  console.warn("getGeminiResponse: Use WebSocket chat instead. This is a legacy fallback.");
  return "Please use the chat interface to talk to me.";
};

// Streaming function — calls backend via WebSocket (not used directly, kept for compat)
export const getGeminiResponseStreaming = async (prompt, onSentence, onComplete, conversation_id = null, history = [], language = 'en') => {
  console.warn("getGeminiResponseStreaming: Use WebSocket chat instead.");
  const errorMsg = "Please use the chat interface.";
  if (onComplete) onComplete(errorMsg);
  return errorMsg;
};
