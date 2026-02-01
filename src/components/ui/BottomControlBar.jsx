import React, { useState } from 'react';
import { Send, Mic, Square, Sparkles, Maximize2, Minimize2 } from 'lucide-react';
import { AudioVisualizer } from './AudioVisualizer';

export const BottomControlBar = ({ 
  input, 
  setInput, 
  onSend, 
  onStop, 
  isSpeaking, 
  loading,
  quickReplies = [],
  onQuickReply,
  onToggleFocus,
  isFocused
}) => {
  const [isListening, setIsListening] = useState(false);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const toggleMic = () => {
    setIsListening(!isListening);
  };

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 flex flex-col gap-4 pointer-events-auto z-50">
      
      {/* Quick Replies */}
      {!isSpeaking && !loading && quickReplies.length > 0 && !isFocused && (
        <div className="flex justify-center gap-2 overflow-x-auto pb-2 scrollbar-hide mask-linear-fade">
          {quickReplies.map((text, idx) => (
            <button
              key={idx}
              onClick={() => onQuickReply(text)}
              className="flex-shrink-0 px-4 py-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-sm text-cyan-100/80 hover:bg-cyan-500/20 hover:border-cyan-500/50 hover:text-white transition-all shadow-lg hover:shadow-cyan-500/20 whitespace-nowrap"
            >
              {text}
            </button>
          ))}
        </div>
      )}

      {/* Main Control Capsule */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 rounded-full opacity-30 group-hover:opacity-60 blur transition duration-500"></div>
        
        <div className="relative flex items-center bg-black/90 backdrop-blur-xl rounded-full border border-white/10 p-2 shadow-2xl">
          
          {/* Left Controls (Focus Only) */}
          <div className="flex items-center pr-2 border-r border-white/10 mr-2 gap-1">
             <button 
                onClick={onToggleFocus}
                className={`p-3 rounded-full transition-all ${isFocused ? 'text-cyan-400 bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
             >
                {isFocused ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
             </button>
          </div>

          {/* Mic */}
          <div className="flex items-center">
             {isListening ? (
                 <button onClick={toggleMic} className="p-3 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500/30 transition-colors animate-pulse">
                    <AudioVisualizer isActive={true} />
                 </button>
             ) : (
                 <button 
                    onClick={toggleMic}
                    className="p-3 text-gray-400 hover:text-cyan-400 hover:bg-white/5 rounded-full transition-all"
                 >
                    <Mic size={22} />
                 </button>
             )}
          </div>

          {/* Input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading || isSpeaking}
            placeholder={isListening ? "Listening..." : "Ask me anything..."}
            className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 px-4 font-sans text-lg h-12 min-w-0"
          />

          {/* Send / Stop */}
          <div className="pr-1">
            {isSpeaking ? (
                <button
                    onClick={onStop}
                    className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all transform hover:scale-105 active:scale-95"
                >
                    <Square size={20} fill="currentColor" />
                </button>
            ) : (
                <button
                    onClick={onSend}
                    disabled={loading || (!input.trim() && !isListening)}
                    className={`
                        p-3 rounded-full flex items-center justify-center transition-all duration-300
                        ${loading || (!input.trim() && !isListening)
                            ? 'bg-white/10 text-gray-500 cursor-not-allowed' 
                            : 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:scale-105 active:scale-95'
                        }
                    `}
                >
                    {loading ? <Sparkles className="animate-spin" size={20} /> : <Send size={20} className="ml-0.5" />}
                </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};