import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './components/AuthPage';

// UI Components
import { Scene3D } from './components/ui/Scene3D';
import { AppHeader } from './components/ui/AppHeader';
import { ChatLayer, FocusOverlay } from './components/ui/ChatLayer';
import { BottomControlBar } from './components/ui/BottomControlBar';
import { MapModal } from './components/ui/MapModal';

// Hooks
import { useTTS } from './hooks/useTTS';
import { useSTT } from './hooks/useSTT';
import { getGeminiResponseStreaming } from './lib/gemini';

const SUGGESTIONS = [
  "What is the Kalinganagar project?",
  "Tell me about sustainability.",
  "Latest CSR initiatives?",
  "Steel manufacturing process"
];

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-cyan-400">Loading...</div>;
  if (!user) return <Navigate to="/auth" />;
  return children;
};

function AppLayout() {
  const { user, logout } = useAuth();

  // Chat State
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isChatFocused, setIsChatFocused] = useState(false);

  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapTarget, setMapTarget] = useState(null);

  // Conversation State
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);

  // Hooks
  const { stop, isSpeaking, queueSentence, provider, setProvider, analyser } = useTTS();
  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported: isSTTSupported,
    startListening,
    stopListening,
    resetTranscript,
    language,
    setLanguage
  } = useSTT();

  // Load conversations on login
  useEffect(() => {
    if (user) loadConversations();
  }, [user]);

  // Auto-send STT transcript
  useEffect(() => {
    if (transcript && !isListening) {
      handleSend(transcript);
      resetTranscript();
    }
  }, [transcript, isListening]);

  // Sync loading state with TTS: Stop thinking when voice starts
  useEffect(() => {
    if (isSpeaking) {
      setLoading(false);
    }
  }, [isSpeaking]);

  // === API Functions ===
  const loadConversations = async () => {
    try {
      const res = await fetch('/api/conversations', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (res.ok && data.length > 0) {
        setConversations(data);
        selectConversation(data[0].id);
      } else {
        createConversation();
      }
    } catch (e) { console.error("Failed to load chats", e); }
  };

  const createConversation = async () => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ title: "New Chat" })
      });
      const data = await res.json();
      setConversationId(data.id);
      setMessages([]);
    } catch (e) { console.error("New chat failed", e); }
  };

  const selectConversation = async (id) => {
    setConversationId(id);
    try {
      const res = await fetch(`/api/messages?conversation_id=${id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (res.ok) {
        const uiMsgs = data.map(m => ({
          type: m.role === 'user' ? 'user' : 'bot',
          text: m.content
        }));
        setMessages(uiMsgs);
      }
    } catch (e) { console.error("Load msgs failed", e); }
  };

  // === Handlers ===
  const handleMicClick = () => {
    isListening ? stopListening() : startListening();
  };

  const handleStop = () => stop();

  const handleSend = async (text = input) => {
    if (!text.trim() || loading) return;

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const aiMsgId = Date.now();
    setMessages(prev => [...prev, { role: 'ai', content: '...', id: aiMsgId }]);

    try {
      // Determine chat language: if STT is Hindi, tell Gemini to respond in Hindi
      const chatLanguage = language?.startsWith('hi') ? 'hi' : 'en';

      await getGeminiResponseStreaming(
        text,
        (sentence) => {
          if (!isChatFocused) queueSentence(sentence);
        },
        (fullResponse) => {
          const mapMatch = fullResponse.match(/\[SHOW_MAP:\s*(.*?)\]/);
          if (mapMatch) {
            setMapTarget(mapMatch[1]);
            setShowMap(true);
          }
          setMessages(prev => prev.map(msg =>
            msg.id === aiMsgId ? { ...msg, content: fullResponse } : msg
          ));

          // Safety fallback: if for some reason TTS doesn't trigger isSpeaking, 
          // stop loading after a reasonable delay (5s)
          setTimeout(() => setLoading(false), 5000);
        },
        conversationId,
        messages, // Pass history for context
        chatLanguage // Pass language for Gemini system instruction
      );
    } catch (error) {
      console.error("Error processing request:", error);
      setMessages(prev => prev.map(msg =>
        msg.id === aiMsgId
          ? { ...msg, content: "I'm having trouble connecting to the network." }
          : msg
      ));
    } finally {
      setLoading(false);
    }
  };

  // === Render ===
  return (
    <div className="relative h-[100dvh] w-full bg-[#050505] overflow-hidden font-sans selection:bg-cyan-500/30">

      {/* 3D Avatar Scene */}
      <Scene3D isSpeaking={isSpeaking} analyser={analyser} />

      {/* Focus Overlay */}
      <FocusOverlay isFocused={isChatFocused} />

      {/* Header */}
      <AppHeader
        isSpeaking={isSpeaking}
        onStop={handleStop}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        ttsProvider={provider}
        setTtsProvider={setProvider}
        sttLanguage={language}
        setSttLanguage={setLanguage}
        onLogout={logout}
      />

      {/* Floating Chat */}
      <ChatLayer
        messages={messages}
        loading={loading}
        isFocused={isChatFocused}
        onMapClick={(stall) => { setMapTarget(stall); setShowMap(true); }}
      />

      {/* Bottom Control Bar */}
      <BottomControlBar
        input={input}
        setInput={setInput}
        onSend={() => handleSend(input)}
        onStop={handleStop}
        isSpeaking={isSpeaking}
        loading={loading}
        quickReplies={messages.length === 0 ? SUGGESTIONS : []}
        onQuickReply={handleSend}
        onToggleFocus={() => setIsChatFocused(!isChatFocused)}
        isFocused={isChatFocused}
        isListening={isListening}
        onMicClick={handleMicClick}
        interimTranscript={interimTranscript}
        isSTTSupported={isSTTSupported}
      />

      {/* Map Modal */}
      <MapModal
        isOpen={showMap}
        onClose={() => setShowMap(false)}
        targetStall={mapTarget}
      />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </Router>
  );
}