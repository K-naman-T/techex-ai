import React from 'react';
import { X, Navigation } from 'lucide-react';

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

export const MapModal = ({ isOpen, onClose, targetStall }) => {
    if (!isOpen) return null;

    const getPinPosition = (stall) => {
        if (!stall) return { x: 450, y: 325 };

        const cleanStall = stall.replace(/^[A-Z]-/, '');

        if (STALL_POSITIONS[cleanStall]) {
            const pos = STALL_POSITIONS[cleanStall];
            return { x: pos.x + 27.5, y: pos.y + 21.5 };
        }

        const zone = stall.charAt(0).toUpperCase();
        switch (zone) {
            case 'A': return { x: 220, y: 280 };
            case 'B': return { x: 680, y: 280 };
            case 'C': return { x: 220, y: 150 };
            case 'D': return { x: 680, y: 150 };
            default: return { x: 450, y: 325 };
        }
    };

    const USER_POS = { x: 450, y: 610 };
    const targetPos = getPinPosition(targetStall);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/90 p-2 sm:p-4 animate-in fade-in duration-300">
            {/* Modal Container */}
            <div className="relative w-full max-w-5xl max-h-[85dvh] bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xl flex flex-col lg:flex-row animate-in zoom-in-95 duration-200">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 sm:top-4 sm:right-4 z-20 p-2 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-full transition-all border border-slate-200 shadow-sm"
                >
                    <X size={18} />
                </button>

                {/* Info Panel */}
                <div className="p-4 sm:p-6 lg:p-8 lg:w-1/3 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50 flex flex-col justify-center shrink-0 text-slate-900">
                    <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                        <Navigation size={20} className="sm:w-6 sm:h-6 text-[#06b6d4]" />
                        <h2 className="text-base sm:text-lg font-bold tracking-tight uppercase">Wayfinding</h2>
                    </div>

                    <div className="space-y-4 sm:space-y-6">
                        <div>
                            <span className="text-[10px] sm:text-xs text-slate-500 uppercase font-semibold">Destination</span>
                            <div className="text-xl sm:text-3xl font-bold text-slate-900 mt-1">{targetStall || "Main Hall"}</div>
                        </div>

                        <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Proceed to the <span className="text-[#06b6d4] font-bold">highlighted marker</span> starting from the Entrance.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <span className="px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium bg-white border border-slate-200 text-slate-600 rounded-full shadow-sm">Step-free</span>
                            <span className="px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium bg-[#22c55e]/10 border border-[#22c55e]/20 text-[#22c55e] rounded-full">~2 min</span>
                        </div>
                    </div>

                    {/* Zone Legend */}
                    <div className="mt-8 pt-6 border-t border-slate-200">
                        <span className="text-[10px] sm:text-xs text-slate-500 uppercase font-semibold mb-3 block">Zones</span>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#9333ea]"></div><span className="text-xs text-slate-600 font-medium">Productivity</span></div>
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#22c55e]"></div><span className="text-xs text-slate-600 font-medium">Sustainability</span></div>
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#ca8a04]"></div><span className="text-xs text-slate-600 font-medium">Cost</span></div>
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#ef4444]"></div><span className="text-xs text-slate-600 font-medium">Safety</span></div>
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#06b6d4]"></div><span className="text-xs text-slate-600 font-medium">Reliability</span></div>
                        </div>
                    </div>
                </div>

                {/* Map View */}
                <div className="relative bg-white flex-1 min-h-[300px] sm:min-h-[450px] lg:min-h-[500px] overflow-hidden">
                    <svg
                        className="w-full h-full"
                        viewBox="0 0 900 650"
                        preserveAspectRatio="xMidYMid meet"
                    >
                        {/* Background */}
                        <rect width="900" height="650" fill="#ffffff" />

                        {/* Grid */}
                        <defs>
                            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.15" />
                            </pattern>
                        </defs>
                        <rect width="900" height="650" fill="url(#grid)" />

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

                        {/* End Point (Target) */}
                        <circle cx={targetPos.x} cy={targetPos.y} r="18" fill="#06b6d4" opacity="0.3" className="animate-ping" />
                        <circle cx={targetPos.x} cy={targetPos.y} r="12" fill="#06b6d4" />
                        <text x={targetPos.x} y={targetPos.y + 4} textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontSize="10" fill="white" fontWeight="bold">{targetStall?.charAt(0) || '★'}</text>

                    </svg>
                </div>
            </div>
        </div>
    );
};
