import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Experience } from './components/3d/Experience';
import { BottomControlBar } from './components/ui/BottomControlBar';
import { FloatingChat } from './components/ui/FloatingChat';
import { useTTS } from './hooks/useTTS'; 
import { getGeminiResponse } from './lib/gemini';
import { MessageSquare, X, Mic, StopCircle, Settings } from 'lucide-react';

const SUGGESTIONS = [
  "What is the Kalinganagar project?",
  "Tell me about sustainability.",
  "Latest CSR initiatives?",
  "Steel manufacturing process"
];

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isChatFocused, setIsChatFocused] = useState(false); // Default: Bubbles HIDDEN
  const [showSettings, setShowSettings] = useState(false); 
  
  const { speak, stop, isSpeaking, provider, setProvider } = useTTS();

  const handleSend = async (text = input) => {
    if (!text.trim() || loading) return;

    // Add User Message
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Get AI Response
      const responseText = await getGeminiResponse(text);

      // Add AI Message
      const aiMsg = { role: 'ai', content: responseText };
      setMessages(prev => [...prev, aiMsg]);

      // Speak ONLY if Chat is NOT focused (Immersive Mode)
      if (!isChatFocused) {
          speak(responseText);
      }
    } catch (error) {
      console.error("Error processing request:", error);
      setMessages(prev => [...prev, { role: 'ai', content: "I'm having trouble connecting to the network." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = () => {
      stop();
  };

  return (
    <div className="relative h-screen w-full bg-[#050505] overflow-hidden font-sans selection:bg-cyan-500/30">

      {/* BACKGROUND: 3D SCENE */}
      <div className="absolute inset-0 z-0">
        <Canvas shadows camera={{ position: [0, 1.65, 1.3], fov: 30 }}>
          <color attach="background" args={['#050505']} />
          <Experience isSpeaking={isSpeaking} />
        </Canvas>
      </div>

      {/* FOCUS OVERLAY */}
      <div 
        className={`absolute inset-0 z-10 bg-black/60 backdrop-blur-xl transition-all duration-700 ease-in-out pointer-events-none ${isChatFocused ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* HEADER */}
      <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-start pointer-events-none z-50">
        <div className="pointer-events-auto">
          <h1 className="text-3xl font-bold font-mono tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
            TECHEX <span className="text-cyan-400">2026</span>
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs text-gray-500 font-mono tracking-widest uppercase">SYS ONLINE</span>
          </div>
        </div>

        {/* TOP RIGHT CONTROLS */}
        <div className="pointer-events-auto flex gap-3 relative">
            {isSpeaking && (
                <button 
                    onClick={(e) => { e.stopPropagation(); stop(); }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/80 border border-red-500/50 text-white rounded-full hover:bg-red-600 transition-all backdrop-blur-md shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-in fade-in zoom-in duration-300"
                >
                    <StopCircle size={20} className="animate-pulse" />
                    <span className="font-mono text-sm font-bold">STOP</span>
                </button>
            )}

            <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`h-10 w-10 rounded-full border flex items-center justify-center backdrop-blur-md transition-all ${showSettings ? 'bg-white/10 border-white/30 text-white' : 'bg-black/20 border-white/10 text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
                <Settings size={20} />
            </button>

            {showSettings && (
                <div className="absolute top-12 right-0 bg-black/90 border border-white/10 rounded-xl p-4 min-w-[220px] backdrop-blur-xl shadow-2xl animate-in slide-in-from-top-2 fade-in z-50">
                   <h3 className="text-[10px] font-mono text-gray-500 mb-3 uppercase tracking-widest">Voice Engine</h3>
                   <div className="flex flex-col gap-1">
                      {[
                        { id: 'google', label: 'Google Neural2', desc: 'Standard' },
                        { id: 'elevenlabs', label: 'ElevenLabs', desc: 'Krishna Gupta (Custom)' },
                        { id: 'sarvam', label: 'Sarvam AI', desc: 'Indian Context' }
                      ].map((opt) => (
                         <button 
                           key={opt.id}
                           onClick={() => { setProvider(opt.id); setShowSettings(false); }}
                           className={`text-left px-3 py-2.5 rounded-lg transition-all group ${provider === opt.id ? 'bg-cyan-500/10 border border-cyan-500/30' : 'hover:bg-white/5 border border-transparent'}`}
                         >
                           <div className={`text-sm font-medium ${provider === opt.id ? 'text-cyan-400' : 'text-gray-200 group-hover:text-white'}`}>
                              {opt.label}
                           </div>
                           <div className="text-[10px] text-gray-500 mt-0.5">{opt.desc}</div>
                         </button>
                      ))}
                   </div>
                </div>
            )}
        </div>
      </div>

      {/* FLOATING CHAT LAYER (Hidden by default, Only visible when Focused) */}
      <div className={`absolute inset-0 z-30 transition-all duration-500 ${isChatFocused ? 'pt-24 opacity-100' : 'opacity-0 pointer-events-none'}`}>
         <FloatingChat messages={messages} loading={loading} isFocused={isChatFocused} />
      </div>

      {/* BOTTOM CONTROL BAR */}
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
      />

    </div>
  );
}

export default App;