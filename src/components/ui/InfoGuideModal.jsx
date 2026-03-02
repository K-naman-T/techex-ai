import React, { useState } from 'react';
import { X, Info, Mic, Hand, MessageSquare, Map, ChevronRight } from 'lucide-react';

// Reuse map constants
const STALL_POSITIONS = {
    '3': { x: 80, y: 530, theme: 'purple' },
    '2': { x: 137, y: 530, theme: 'purple' },
    '1': { x: 194, y: 530, theme: 'purple' },
    '4': { x: 80, y: 485, theme: 'purple' },
    '5': { x: 80, y: 440, theme: 'purple' },
    '6': { x: 80, y: 395, theme: 'purple' },
    '7': { x: 80, y: 350, theme: 'purple' },
    '8': { x: 80, y: 305, theme: 'purple' },
    '9': { x: 80, y: 260, theme: 'green' },
    '10': { x: 80, y: 215, theme: 'green' },
    '11': { x: 80, y: 170, theme: 'green' },
    '12': { x: 80, y: 125, theme: 'green' },
    '13': { x: 137, y: 80, theme: 'gold' },
    '14': { x: 194, y: 80, theme: 'gold' },
    '15': { x: 651, y: 80, theme: 'gold' },
    '16': { x: 708, y: 80, theme: 'gold' },
    '17': { x: 765, y: 125, theme: 'red' },
    '18': { x: 765, y: 195, theme: 'red' },
    '19': { x: 765, y: 240, theme: 'red' },
    '20': { x: 765, y: 285, theme: 'red' },
    '21': { x: 765, y: 330, theme: 'red' },
    '22': { x: 765, y: 375, theme: 'teal' },
    '23': { x: 765, y: 440, theme: 'teal' },
    '24': { x: 765, y: 485, theme: 'teal' },
    '25': { x: 708, y: 530, theme: 'teal' },
    '26': { x: 651, y: 530, theme: 'teal' },
    '27': { x: 594, y: 530, theme: 'teal' },
    '28': { x: 545, y: 350, theme: 'teal' },
    '29': { x: 545, y: 305, theme: 'red' },
    '30': { x: 545, y: 260, theme: 'red' },
    '31': { x: 545, y: 215, theme: 'red' },
    '32': { x: 300, y: 350, theme: 'purple' },
    '33': { x: 300, y: 305, theme: 'purple' },
    '34': { x: 300, y: 260, theme: 'green' },
    '35': { x: 300, y: 215, theme: 'green' }
};

const EMPTY_STALLS = [
    { x: 80, y: 80 },
    { x: 765, y: 80 },
    { x: 765, y: 530 }
];

const THEME_COLORS = {
    purple: '#9333ea',
    green: '#22c55e',
    gold: '#ca8a04',
    red: '#ef4444',
    teal: '#06b6d4',
    empty: '#f1f5f9'
};

const VOICE_STEPS = [
    {
        icon: Mic,
        title: 'Tap the Orb',
        desc: 'Tap the glowing orb in the center to connect your voice. It will turn fully blue when ready.',
        color: 'from-cyan-500 to-blue-500'
    },
    {
        icon: Hand,
        title: 'Speak, Then Tap',
        desc: 'Speak your question. When you\'re done, tap the orb again so she can respond.',
        color: 'from-blue-500 to-indigo-500'
    },
    {
        icon: MessageSquare,
        title: 'Tap to Interrupt',
        desc: 'While she\'s speaking, tap the orb to interrupt and ask something else.',
        color: 'from-indigo-500 to-purple-500'
    }
];

export const InfoGuideModal = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('guide');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-white animate-in zoom-in-95 duration-200 sm:p-4 sm:bg-zinc-950/90 items-center justify-center">
            <div className="relative w-full h-full max-w-3xl sm:h-[90dvh] sm:rounded-2xl border-slate-200 sm:border bg-white flex flex-col overflow-hidden shadow-2xl">

                {/* Header */}
                <div className="flex-none px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between border-b border-slate-200 bg-slate-50 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
                            <Info size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-bold text-slate-900">TechEx 2026 Guide</h2>
                            <p className="text-xs text-slate-500">How to use your AI assistant</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-full transition-all border border-slate-200 shadow-sm"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex-none flex border-b border-slate-200 bg-white">
                    <button
                        onClick={() => setActiveTab('guide')}
                        className={`flex-1 py-3 text-sm font-semibold transition-all relative ${activeTab === 'guide' ? 'text-cyan-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Voice Guide
                        {activeTab === 'guide' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('map')}
                        className={`flex-1 py-3 text-sm font-semibold transition-all relative flex items-center justify-center gap-1.5 ${activeTab === 'map' ? 'text-cyan-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Map size={14} />
                        Floor Map
                        {activeTab === 'map' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500" />}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto">
                    {activeTab === 'guide' ? (
                        <div className="p-4 sm:p-6 space-y-5">
                            {/* Voice interaction steps */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Voice Interaction</h3>
                                {VOICE_STEPS.map((step, i) => (
                                    <div key={i} className="flex gap-4 items-start p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                        <div className={`flex-none w-11 h-11 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-md`}>
                                            <step.icon size={20} className="text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-bold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-full">Step {i + 1}</span>
                                                <h4 className="font-bold text-slate-900 text-sm">{step.title}</h4>
                                            </div>
                                            <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Text chat tip */}
                            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-cyan-50/50 border border-slate-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <MessageSquare size={16} className="text-cyan-600" />
                                    <h4 className="font-bold text-slate-900 text-sm">Text Chat</h4>
                                </div>
                                <p className="text-slate-500 text-sm leading-relaxed">
                                    Prefer typing? Use the input bar at the bottom. Tap the expand icon to open full chat view with conversation history.
                                </p>
                            </div>

                            {/* Quick tips */}
                            <div className="space-y-2">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tips</h3>
                                <div className="grid gap-2">
                                    {[
                                        'Ask about any stall or project by number or name',
                                        'She can show you the map and guide you to any stall',
                                        'Ask for recommendations based on your interests',
                                        'Tap anywhere on the background to disconnect voice'
                                    ].map((tip, i) => (
                                        <div key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                                            <ChevronRight size={14} className="text-cyan-500 mt-0.5 flex-none" />
                                            <span>{tip}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Map Tab — full interactive map */
                        <div className="w-full h-full min-h-[400px] flex items-center justify-center p-2 sm:p-4 bg-[#f8fafc]">
                            <svg
                                className="w-full h-full drop-shadow-md"
                                viewBox="0 0 900 650"
                                preserveAspectRatio="xMidYMid meet"
                            >
                                <rect width="900" height="650" fill="#ffffff" />
                                <defs>
                                    <pattern id="guide-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.15" />
                                    </pattern>
                                </defs>
                                <rect width="900" height="650" fill="url(#guide-grid)" />

                                {/* Central Logo */}
                                <text x="450" y="325" textAnchor="middle" fill="#0f172a" opacity="0.05" fontSize="48" fontWeight="900" letterSpacing="8" fontFamily="Inter, system-ui, sans-serif">TECH EX</text>
                                <text x="450" y="380" textAnchor="middle" fill="#0f172a" opacity="0.03" fontSize="32" fontWeight="bold" letterSpacing="12" fontFamily="Inter, system-ui, sans-serif">2026</text>

                                {/* Zone Labels */}
                                <text x="160" y="420" transform="rotate(-90 160 420)" fill={THEME_COLORS.purple} opacity="0.6" fontSize="14" fontWeight="bold" letterSpacing="4" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif">PRODUCTIVITY</text>
                                <text x="160" y="220" transform="rotate(-90 160 220)" fill={THEME_COLORS.green} opacity="0.6" fontSize="14" fontWeight="bold" letterSpacing="4" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif">SUSTAINABILITY</text>
                                <text x="450" y="150" fill={THEME_COLORS.gold} opacity="0.6" fontSize="14" fontWeight="bold" letterSpacing="4" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif">COST</text>
                                <text x="740" y="270" transform="rotate(90 740 270)" fill={THEME_COLORS.red} opacity="0.6" fontSize="14" fontWeight="bold" letterSpacing="4" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif">SAFETY</text>
                                <text x="740" y="450" transform="rotate(90 740 450)" fill={THEME_COLORS.teal} opacity="0.6" fontSize="14" fontWeight="bold" letterSpacing="4" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif">RELIABILITY</text>

                                {/* Empty Stalls */}
                                {EMPTY_STALLS.map((pos, idx) => (
                                    <g key={`empty-${idx}`} transform={`translate(${pos.x}, ${pos.y})`}>
                                        <rect width="55" height="43" rx="4" fill={THEME_COLORS.empty} stroke="#cbd5e1" strokeWidth="1" />
                                    </g>
                                ))}

                                {/* Active Stalls */}
                                {Object.entries(STALL_POSITIONS).map(([id, pos]) => (
                                    <g key={id} transform={`translate(${pos.x}, ${pos.y})`}>
                                        <rect width="55" height="43" rx="4" fill={THEME_COLORS[pos.theme]} opacity="0.9" />
                                        <text x="27.5" y="26.5" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="Inter, system-ui, sans-serif">{id}</text>
                                    </g>
                                ))}

                                {/* ENTRY Marker */}
                                <g transform="translate(450, 580)">
                                    <path d="M -10 10 L 0 -5 L 10 10" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                    <text x="0" y="28" textAnchor="middle" fill="#22c55e" fontSize="12" fontWeight="bold" fontFamily="Inter, system-ui, sans-serif">ENTRY</text>
                                </g>

                                {/* EXIT Markers */}
                                <g transform="translate(835, 180)">
                                    <path d="M -10 -8 L 0 0 L -10 8" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                    <text x="-5" y="22" textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="bold" fontFamily="Inter, system-ui, sans-serif">EXIT</text>
                                </g>
                                <g transform="translate(835, 425)">
                                    <path d="M -10 -8 L 0 0 L -10 8" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                    <text x="-5" y="22" textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="bold" fontFamily="Inter, system-ui, sans-serif">EXIT</text>
                                </g>
                            </svg>
                        </div>
                    )}
                </div>

                {/* Legend (shown in map tab) */}
                {activeTab === 'map' && (
                    <div className="flex-none p-3 border-t border-slate-200 bg-white overflow-x-auto whitespace-nowrap z-10">
                        <div className="flex items-center gap-4 min-w-max px-2">
                            <span className="text-[10px] text-slate-500 uppercase font-bold mr-2">Zones:</span>
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#9333ea]"></div><span className="text-[11px] text-slate-700 font-bold">Productivity</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]"></div><span className="text-[11px] text-slate-700 font-bold">Sustainability</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#ca8a04]"></div><span className="text-[11px] text-slate-700 font-bold">Cost</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></div><span className="text-[11px] text-slate-700 font-bold">Safety</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#06b6d4]"></div><span className="text-[11px] text-slate-700 font-bold">Reliability</span></div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
