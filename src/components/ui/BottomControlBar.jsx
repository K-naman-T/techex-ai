import React from 'react';
import { Send, Square, Sparkles, Maximize2, Minimize2 } from 'lucide-react';

export const BottomControlBar = ({
  input,
  setInput,
  onSend,
  onStop,
  isSpeaking,
  loading,
  onToggleFocus,
  isFocused
}) => {

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="absolute bottom-10 sm:bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-2 sm:px-4 flex flex-col gap-2 sm:gap-4 pointer-events-auto z-[60] border border-red-500/0">
      {/* Main Control Capsule */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 rounded-full opacity-30 group-hover:opacity-60 blur transition duration-500"></div>

        <div className="relative flex items-center bg-black/90 backdrop-blur-xl rounded-full border border-white/10 p-1.5 sm:p-2 shadow-2xl">

          {/* Left Controls (Focus Only) */}
          <div className="flex items-center pr-1 sm:pr-2 border-r border-white/10 mr-1 sm:mr-2 gap-0.5 sm:gap-1">
            <button
              onClick={onToggleFocus}
              className={`p-2 sm:p-3 rounded-full transition-all ${isFocused ? 'text-cyan-400 bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              {isFocused ? <Minimize2 size={18} className="sm:w-5 sm:h-5" /> : <Maximize2 size={18} className="sm:w-5 sm:h-5" />}
            </button>
          </div>

          {/* Input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading || isSpeaking}
            placeholder="Ask me anything..."
            className="flex-1 bg-transparent border-none outline-none placeholder-gray-500 px-2 sm:px-4 font-sans text-base sm:text-lg h-10 sm:h-12 min-w-0 text-white"
          />

          {/* Send / Stop */}
          <div className="pr-0.5 sm:pr-1">
            {isSpeaking ? (
              <button
                onClick={onStop}
                className="p-2 sm:p-3 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all transform hover:scale-105 active:scale-95"
              >
                <Square size={18} className="sm:w-5 sm:h-5" fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={onSend}
                disabled={loading || !input.trim()}
                className={`
                        p-2 sm:p-3 rounded-full flex items-center justify-center transition-all duration-300
                        ${loading || !input.trim()
                    ? 'bg-white/10 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:scale-105 active:scale-95'
                  }
                    `}
              >
                {loading ? <Sparkles size={18} className="animate-spin sm:w-5 sm:h-5" /> : <Send size={18} className="sm:w-5 sm:h-5 ml-0.5" />}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
