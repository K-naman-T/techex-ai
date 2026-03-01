import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { MapPin, X, Send, Sparkles, Square } from 'lucide-react';

// ============= MESSAGE BUBBLE =============
const MessageBubble = ({ message, onMapClick }) => {
    const isUser = message.role === 'user';
    const stallId = message.stallId;

    return (
        <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-in slide-in-from-bottom-4 duration-500 fade-in`}>
            <div
                className={`
          max-w-[85%] sm:max-w-[70%] p-4 rounded-3xl text-sm sm:text-base leading-relaxed font-sans shadow-lg backdrop-blur-md border
          ${isUser
                        ? 'bg-black/60 border-cyan-500/30 text-white rounded-br-sm'
                        : 'bg-white/10 border-white/10 text-gray-100 rounded-bl-sm'
                    }
        `}
            >
                {isUser ? (
                    message.content
                ) : (
                    <>
                        <div className="prose prose-invert prose-p:leading-normal prose-sm max-w-none">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                        {stallId && (
                            <button
                                onClick={() => onMapClick && onMapClick(stallId)}
                                className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-full transition-all shadow-lg"
                            >
                                <MapPin size={14} />
                                View on Map
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// ============= TYPING INDICATOR =============
const TypingIndicator = () => (
    <div className="flex justify-start animate-in fade-in mb-4">
        <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-3xl rounded-bl-sm p-4 flex gap-2 items-center">
            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></span>
            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
        </div>
    </div>
);

// ============= CHAT INPUT BAR =============
const ChatInputBar = ({ input, setInput, onSend, loading, isSpeaking, onStop }) => {
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    return (
        <div className="p-3 sm:p-4 border-t border-white/5">
            <div className="relative group max-w-3xl mx-auto">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 rounded-full opacity-30 group-hover:opacity-60 blur transition duration-500"></div>
                <div className="relative flex items-center bg-black/90 backdrop-blur-xl rounded-full border border-white/10 p-1.5 sm:p-2 shadow-2xl">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={loading || isSpeaking}
                        placeholder="Type a message..."
                        autoFocus
                        className="flex-1 bg-transparent border-none outline-none placeholder-gray-500 px-3 sm:px-4 font-sans text-base sm:text-lg h-10 sm:h-12 min-w-0 text-white"
                    />
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

// ============= CHAT MODAL (main export) =============
export const ChatModal = ({
    isOpen,
    onClose,
    messages,
    loading,
    input,
    setInput,
    onSend,
    onStop,
    isSpeaking,
    onMapClick,
}) => {
    const bottomRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, loading, isOpen]);

    if (!isOpen) return null;

    const filteredMessages = messages.filter(msg => msg.content && msg.content.trim() !== '');

    return (
        <div className="fixed inset-0 z-[80] flex flex-col">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/85 backdrop-blur-2xl transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Modal container */}
            <div className="relative z-10 flex flex-col h-full max-w-3xl w-full mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                        <span className="text-white/60 font-mono text-xs uppercase tracking-widest">Chat</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 hover:bg-white/10 border border-white/10 rounded-full text-white/60 hover:text-white backdrop-blur-md transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Messages (scrollable) */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 custom-scrollbar">
                    {filteredMessages.length === 0 && !loading && (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center text-white/20 font-mono text-sm uppercase tracking-widest">
                                Ask me anything about TechEx
                            </div>
                        </div>
                    )}

                    {filteredMessages.map((msg, idx) => (
                        <MessageBubble key={idx} message={msg} onMapClick={onMapClick} />
                    ))}

                    {loading && <TypingIndicator />}
                    <div ref={bottomRef} />
                </div>

                {/* Input bar (fixed at bottom of modal) */}
                <ChatInputBar
                    input={input}
                    setInput={setInput}
                    onSend={onSend}
                    loading={loading}
                    isSpeaking={isSpeaking}
                    onStop={onStop}
                />
            </div>
        </div>
    );
};
