import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { MapPin } from 'lucide-react';

const FloatingBubble = ({ message, onMapClick }) => {
  const isUser = message.role === 'user';
  const stallId = message.stallId; // If stall info is attached

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-in slide-in-from-bottom-4 duration-500 fade-in`}>
      <div
        className={`
          max-w-[80%] md:max-w-[70%] p-4 rounded-3xl text-sm md:text-base leading-relaxed font-sans shadow-lg backdrop-blur-md border
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

export const FloatingChat = ({ messages, loading, isFocused, onMapClick }) => {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, isFocused]);

  if (messages.length === 0 && !loading) return null;

  return (
    <div className={`absolute inset-0 z-30 pointer-events-none flex flex-col justify-end px-4 md:px-0 transition-all duration-500 ${isFocused ? 'pb-36 pt-24' : 'pb-32 h-[60vh] top-auto'}`}>
      <div className={`w-full max-w-3xl mx-auto overflow-y-auto custom-scrollbar pointer-events-auto pr-2 ${isFocused ? 'h-full' : 'h-full mask-gradient-top'}`}>
        {messages.filter(msg => msg.content && msg.content.trim() !== '').map((msg, idx) => (
          <FloatingBubble key={idx} message={msg} onMapClick={onMapClick} />
        ))}

        {loading && (
          <div className="flex justify-start animate-in fade-in">
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-3xl rounded-bl-sm p-4 flex gap-2 items-center">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};