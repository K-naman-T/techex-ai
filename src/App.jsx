import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './components/AuthPage';
import { Onboarding } from './components/Onboarding';

// UI Components
import { StyledOrbAvatar } from './components/ui/StyledOrbAvatar';
import { AppHeader } from './components/ui/AppHeader';
import { ChatLayer, FocusOverlay } from './components/ui/ChatLayer';
import { BottomControlBar } from './components/ui/BottomControlBar';
import { MapModal } from './components/ui/MapModal';
import { Loader } from './components/ui/Loader';
import { ChatSidebar } from './components/ui/ChatSidebar';

// Hooks
import { useWSVoice } from './hooks/useWSVoice';
import { useMicAnalyser } from './hooks/useMicAnalyser';


// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-cyan-400">Loading...</div>;
  if (!user) return <Navigate to="/auth" />;
  return children;
};

function AppLayout() {
  const { user, login, logout } = useAuth();

  // Chat State
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('techex_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [loading, setLoading] = useState(false);
  const [isChatFocused, setIsChatFocused] = useState(false);

  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapTarget, setMapTarget] = useState(null);

  // Hooks
  const {
    isVoiceModeActive,
    isListening,
    isSpeaking,
    activeBackend,
    transcript,
    interimTranscript,
    chatResponse,
    toggleVoiceMode,
    toggleGeminiLiveMode,
    sendChat,
    stopSpeaking,
    analyser,
    warmup
  } = useWSVoice({
    onShowMap: (stallId) => { setMapTarget(stallId); setShowMap(true); },
  });


  const [language, setLanguage] = useState(() => {
    try { return JSON.parse(localStorage.getItem('techex_user'))?.language || 'hi-IN'; } catch { return 'hi-IN'; }
  });

  const mapLanguage = (lang) => {
    if (lang === 'hi-Hinglish') return 'hinglish';
    if (lang?.startsWith('hi')) return 'hi';
    return 'en';
  };

  // Microphone Analyser for Visualizer
  const micAnalyser = useMicAnalyser(isListening);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('techex_history', JSON.stringify(messages));
  }, [messages]);



  // Handle Chat Response Stream (Text Mode)
  useEffect(() => {
    if (chatResponse && !isVoiceModeActive) { // Only for text mode
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'ai') {
          return [...prev.slice(0, -1), { ...last, content: chatResponse }];
        }
        return [...prev, { role: 'ai', content: chatResponse }];
      });
    }
  }, [chatResponse, isVoiceModeActive]);

  // Handle Voice Response Sync (commit to history on turn complete or session end)
  const lastSyncResponse = useRef('');
  useEffect(() => {
    if (isVoiceModeActive) {
      lastSyncResponse.current = chatResponse;
    } else if (lastSyncResponse.current) {
      // Session just ended, commit the last response if not empty
      setMessages(prev => {
        const filtered = prev.filter(m => m.content !== lastSyncResponse.current);
        return [...filtered, { role: 'ai', content: lastSyncResponse.current }];
      });
      lastSyncResponse.current = '';
    }
  }, [chatResponse, isVoiceModeActive]);

  // Auto-disconnect voice when chat focuses
  useEffect(() => {
    if (isChatFocused && isVoiceModeActive) {
      console.log("[App] Chat focused, auto-disconnecting voice...");
      const lang = mapLanguage(language);
      toggleGeminiLiveMode(lang, user);
    }
  }, [isChatFocused, isVoiceModeActive, toggleGeminiLiveMode, language, user]);

  // Auto-activate voice mode after onboarding
  useEffect(() => {
    if (user && !loading && !localStorage.getItem('techex_greeted')) {
      console.log("[App] New user detected, auto-activating voice mode...");
      localStorage.setItem('techex_greeted', 'true');
      const lang = mapLanguage(language);
      // Slight delay to ensure UI is ready
      setTimeout(() => {
        toggleGeminiLiveMode(lang, user);
      }, 500);
    }
  }, [user, loading, toggleGeminiLiveMode, language]);

  // === Handlers ===
  const handleMicClick = (userOverride = null) => {
    // Check if userOverride is a React Event (it will have .nativeEvent or .target)
    const isEvent = userOverride && (userOverride.nativeEvent || userOverride.target);
    const activeUser = (userOverride && !isEvent) ? userOverride : user;

    console.log(`[App] Orb Clicked. Toggle Gemini Live Mode:`, !isVoiceModeActive);
    warmup();
    const lang = mapLanguage(language);
    toggleGeminiLiveMode(lang, activeUser);
  };

  const handleStop = () => stopSpeaking();

  const handleSend = async (text = input) => {
    if (!text.trim() || loading) return;

    warmup();
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const chatLanguage = mapLanguage(language);
      // Pass user metadata for personalization
      sendChat(text, null, messages, chatLanguage, {
        userName: user?.name,
        interests: user?.interests
      });
    } catch (error) {
      console.error("Error processing request:", error);
      setMessages(prev => [...prev, { role: 'ai', content: "I'm having trouble connecting." }]);
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm("Clear all chat history?")) {
      setMessages([]);
      localStorage.removeItem('techex_history');
    }
  };

  if (!user) {
    return <Onboarding onComplete={login} />;
  }

  // === Render ===
  return (
    <div className="relative h-[100dvh] w-full bg-[#050505] overflow-hidden font-sans selection:bg-cyan-500/30">
      <Loader />
      {/* 3D Avatar Scene Replacement - Styled Orb */}
      <StyledOrbAvatar
        isSpeaking={isSpeaking}
        isListening={isListening}
        isLoading={loading}
        isActive={isVoiceModeActive}
        analyser={analyser}
        micAnalyser={micAnalyser}
        onClick={handleMicClick}
      />


      {/* Focus Overlay */}
      <FocusOverlay isFocused={isChatFocused} />

      {/* Header */}
      <AppHeader
        isSpeaking={isSpeaking}
        onStop={handleStop}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        ttsProvider="auto"
        setTtsProvider={() => { }}
        sttLanguage={language}
        setSttLanguage={setLanguage}
        onLogout={logout}
        onClearHistory={handleClearHistory}
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
        onToggleFocus={() => setIsChatFocused(!isChatFocused)}
        isFocused={isChatFocused}
        isListening={isListening && !isVoiceModeActive}
        onMicClick={handleMicClick}
        interimTranscript={interimTranscript}
        isSTTSupported={true}
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
          <Route path="/*" element={<AppLayout />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}