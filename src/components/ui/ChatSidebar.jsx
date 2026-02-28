import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Plus, X, Clock, Trash2 } from 'lucide-react';

export const ChatSidebar = ({
    isOpen,
    onClose,
    conversations,
    activeId,
    onSelect,
    onNewChat,
    onDeleteChat
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
                    />

                    {/* Sidebar */}
                    <motion.div
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed top-0 left-0 h-full w-80 bg-[#0a0a0a]/90 border-r border-white/10 backdrop-blur-xl z-[101] flex flex-col shadow-[20px_0_50px_rgba(0,0,0,0.5)]"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <h2 className="text-xl font-bold font-mono tracking-tighter text-white">
                                CHAT <span className="text-cyan-400">HISTORY</span>
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* New Chat Button */}
                        <div className="p-4">
                            <button
                                onClick={() => { onNewChat(); onClose(); }}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-xl hover:bg-cyan-500/20 transition-all font-mono text-sm font-bold tracking-widest uppercase mb-4"
                            >
                                <Plus size={18} />
                                New Thread
                            </button>
                        </div>

                        {/* Conversations List */}
                        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2 custom-scrollbar">
                            {conversations.length === 0 ? (
                                <div className="text-center py-10 opacity-30 font-mono text-xs uppercase tracking-widest text-white">
                                    No records found
                                </div>
                            ) : (
                                conversations.map((chat) => (
                                    <div
                                        key={chat.id}
                                        onClick={() => { onSelect(chat.id); onClose(); }}
                                        className={`group relative p-4 rounded-xl border transition-all cursor-pointer ${activeId === chat.id
                                                ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                                                : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:border-white/20'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <MessageSquare size={18} className={activeId === chat.id ? 'text-cyan-400' : 'text-gray-500'} />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm truncate pr-6">
                                                    {chat.title || 'Untitled Session'}
                                                </div>
                                                <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-500 font-mono uppercase tracking-tighter">
                                                    <Clock size={10} />
                                                    {new Date(chat.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Delete Action (Optional/Future) */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteChat?.(chat.id);
                                            }}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer Info */}
                        <div className="p-6 border-t border-white/5 bg-black/20">
                            <div className="text-[10px] font-mono text-white/20 uppercase tracking-[0.2em]">
                                Secure Archive V2.4
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
