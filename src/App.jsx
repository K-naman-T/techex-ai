import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Experience } from './components/3d/Experience';
import { BottomControlBar } from './components/ui/BottomControlBar';
import { FloatingChat } from './components/ui/FloatingChat';
import { useGoogleCloudAudio } from './hooks/useGoogleCloudAudio';
import { getGeminiResponse } from './lib/gemini';

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
  const [isChatFocused, setIsChatFocused] = useState(false); // New Focus State
  const { speak, stop, isSpeaking } = useGoogleCloudAudio();

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

      // Speak
      speak(responseText);
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

      {/* FOCUS OVERLAY (Blur & Darken) */}
      <div 
        className={`absolute inset-0 z-10 bg-black/60 backdrop-blur-xl transition-all duration-700 ease-in-out pointer-events-none ${isChatFocused ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* HEADER (Always Visible, Z-Index High) */}
      <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-start pointer-events-none z-50">
        <div>
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
      </div>

      {/* FLOATING CHAT LAYER (Expanded in Focus Mode) */}
      <div className={`absolute inset-0 z-30 transition-all duration-500 ${isChatFocused ? 'pt-24' : ''}`}>
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