import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './components/AuthPage';
import { Onboarding } from './components/Onboarding';

// UI Components
import { StyledOrbAvatar } from './components/ui/StyledOrbAvatar';
import { AppHeader } from './components/ui/AppHeader';
import { ChatModal } from './components/ui/ChatModal';
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
  const [showGuide, setShowGuide] = useState(false);
  const [mapTarget, setMapTarget] = useState(null);
  const [voiceToast, setVoiceToast] = useState(null);

  // Hooks
  // No longer using voiceMode state

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
    startInterrupt,
    stopInterrupt,
    analyser,
    warmup
  } = useWSVoice({
    onShowMap: (stallId) => { setMapTarget(stallId); setShowMap(true); },
    voiceMode: 'native'
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

  // Sync language to localStorage whenever it changes (covers Settings changes too)
  useEffect(() => {
    try {
      const userData = JSON.parse(localStorage.getItem('techex_user') || '{}');
      if (userData.language !== language) {
        userData.language = language;
        localStorage.setItem('techex_user', JSON.stringify(userData));
      }
    } catch (e) {
      console.warn('[App] Failed to sync language to localStorage:', e);
    }
  }, [language]);



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
      toggleGeminiLiveMode(lang, user, false);
    }
  }, [isChatFocused, isVoiceModeActive, toggleGeminiLiveMode, language, user]);

  // Removed auto-activation of voice mode. The user will manually initiate the pipeline via Tap and Hold.
  // Voice connected toast
  useEffect(() => {
    if (isVoiceModeActive) {
      setVoiceToast('Voice connected — tap the orb to speak');
      const timer = setTimeout(() => setVoiceToast(null), 3000);
      return () => clearTimeout(timer);
    } else {
      setVoiceToast(null);
    }
  }, [isVoiceModeActive]);

  // === Handlers ===
  const handleMicClick = (userOverride = null) => {
    const isEvent = userOverride && (userOverride.nativeEvent || userOverride.target);
    const activeUser = (userOverride && !isEvent) ? userOverride : user;
    warmup();

    if (!isVoiceModeActive) {
      // 1. Inactive -> Connect and enter listening mode automatically
      console.log(`[App] Orb Clicked. Activating voice mode.`);
      const lang = mapLanguage(language);
      toggleGeminiLiveMode(lang, activeUser, false);
    } else if (isListening) {
      // 2. Listening -> User taps to say they are finished speaking
      console.log(`[App] Orb Clicked. Finishing turn (Tap-to-Talk).`);
      stopInterrupt();
    } else {
      // 3. AI Processing/Speaking -> User taps to interrupt AI and talk again
      console.log(`[App] Orb Clicked. Interrupting AI (Tap-to-Talk).`);
      startInterrupt();
    }
  };

  const handleStop = () => stopSpeaking();

  const handleSend = async (text = input) => {
    if (!text.trim() || loading) return;

    warmup();
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setIsChatFocused(true); // Auto-open chat modal on text send

    try {
      const chatLanguage = mapLanguage(language);
      // Pass user metadata for personalization
      await sendChat(text, null, messages, chatLanguage, {
        userName: user?.name,
        interests: user?.interests
      });
    } catch (error) {
      console.error("Error processing request:", error);
      setMessages(prev => [...prev, { role: 'ai', content: "I'm having trouble connecting." }]);
    } finally {
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
    <div
      className="relative h-[100dvh] w-full bg-animated-dark overflow-hidden font-sans selection:bg-cyan-500/30"
      onClick={() => {
        if (isVoiceModeActive) {
          console.log("[App] Background clicked, closing voice session...");
          const lang = mapLanguage(language);
          toggleGeminiLiveMode(lang, user, false);
        }
      }}
    >
      <Loader />

      {/* Voice toast */}
      {voiceToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 bg-white/40 border border-green-200/60 backdrop-blur-xl rounded-full text-green-700 text-sm font-semibold tracking-wide animate-in slide-in-from-top-4 fade-in duration-300 shadow-sm">
          {voiceToast}
        </div>
      )}


      {/* 3D Avatar Scene Replacement - Styled Orb */}
      <StyledOrbAvatar
        isSpeaking={isSpeaking}
        isListening={isListening}
        isLoading={loading}
        isActive={isVoiceModeActive}
        analyser={analyser}
        micAnalyser={micAnalyser}
        onClick={handleMicClick}
        onInterruptStart={startInterrupt}
        onInterruptStop={stopInterrupt}
      />


      {/* Chat Modal (self-contained with its own input bar) */}
      <ChatModal
        isOpen={isChatFocused}
        onClose={() => setIsChatFocused(false)}
        messages={messages}
        loading={loading}
        input={input}
        setInput={setInput}
        onSend={() => handleSend(input)}
        onStop={handleStop}
        isSpeaking={isSpeaking}
        onMapClick={(stall) => { setMapTarget(stall); setShowMap(true); }}
        onClearHistory={handleClearHistory}
      />

      {/* Header */}
      <AppHeader
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        ttsProvider="auto"
        setTtsProvider={() => { }}
        sttLanguage={language}
        setSttLanguage={setLanguage}
        showGuide={showGuide}
        setShowGuide={setShowGuide}
      />

      {/* Bottom Control Bar — hidden when chat modal is open */}
      {!isChatFocused && (
        <BottomControlBar
          input={input}
          setInput={setInput}
          onSend={() => handleSend(input)}
          onStop={handleStop}
          isSpeaking={isSpeaking}
          loading={loading}
          onToggleFocus={() => setIsChatFocused(!isChatFocused)}
          isFocused={isChatFocused}
        />
      )}

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