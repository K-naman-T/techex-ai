import React, { useEffect, useRef, useMemo } from 'react';
import { X, Navigation, MapPin } from 'lucide-react';
import dbData from '../../../data/db.json';

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

const CATEGORY_LABELS = {
    purple: 'Productivity',
    green: 'Sustainability',
    gold: 'Cost',
    red: 'Safety',
    teal: 'Reliability'
};

export const MapModal = ({ isOpen, onClose, targetStall }) => {
    const mapContainerRef = useRef(null);

    // Build stall lookup from db.json — maps "1", "2", ... to project info
    const stallInfo = useMemo(() => {
        const map = {};
        if (dbData?.projects) {
            dbData.projects.forEach(p => {
                const num = String(parseInt(p.stall_number, 10));
                map[num] = {
                    title: p.title,
                    team: p.team_name,
                    category: p.category
                };
            });
        }
        return map;
    }, []);

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

    const targetPos = getPinPosition(targetStall);

    // Get details for the targeted stall
    const targetDetails = useMemo(() => {
        if (!targetStall) return null;
        const cleanStall = targetStall.replace(/^[A-Z]-/, '');
        const num = String(parseInt(cleanStall, 10));
        return stallInfo[num] || null;
    }, [targetStall, stallInfo]);

    // Get the theme color for the target stall
    const targetTheme = useMemo(() => {
        if (!targetStall) return null;
        const cleanStall = targetStall.replace(/^[A-Z]-/, '');
        return STALL_POSITIONS[cleanStall]?.theme || null;
    }, [targetStall]);

    useEffect(() => {
        if (isOpen && mapContainerRef.current) {
            const container = mapContainerRef.current;
            setTimeout(() => {
                const ratioX = container.scrollWidth / 900;
                const ratioY = container.scrollHeight / 650;

                const scrollLeft = (targetPos.x * ratioX) - (container.clientWidth / 2);
                const scrollTop = (targetPos.y * ratioY) - (container.clientHeight / 2);

                container.scrollTo({ left: scrollLeft, top: scrollTop, behavior: 'smooth' });
            }, 100);
        }
    }, [isOpen, targetPos.x, targetPos.y]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-white animate-in zoom-in-95 duration-200 sm:p-4 sm:bg-zinc-950/90 items-center justify-center">

            {/* Modal Container */}
            <div className="relative w-full h-full max-w-6xl sm:h-[90dvh] sm:rounded-2xl border-slate-200 sm:border bg-white flex flex-col overflow-hidden shadow-2xl">

                {/* Header Strip */}
                <div className="flex-none px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between border-b border-slate-200 bg-slate-50 z-10 shadow-sm">
                    <div className="flex flex-col flex-1 min-w-0 mr-3">
                        <div className="flex items-center gap-2 text-slate-500 mb-1">
                            <Navigation size={14} className="text-[#06b6d4]" />
                            <span className="text-[10px] sm:text-xs uppercase font-bold tracking-wider">Wayfinding Destination</span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-extrabold text-[#0ea5e9] leading-none">{targetStall || "Main Hall"}</div>
                    </div>

                    <button
                        onClick={onClose}
                        className="flex-none p-3 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-full transition-all border border-slate-200 shadow-sm"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Stall Details Card — shown when targeting a specific stall */}
                {targetDetails && (
                    <div className="flex-none px-4 py-3 sm:px-6 sm:py-3 border-b border-slate-100 bg-white">
                        <div className="flex items-start gap-3">
                            <div
                                className="flex-none w-10 h-10 rounded-xl flex items-center justify-center shadow-md mt-0.5"
                                style={{ backgroundColor: targetTheme ? THEME_COLORS[targetTheme] : '#0ea5e9' }}
                            >
                                <MapPin size={18} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">{targetDetails.title}</h3>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {targetTheme && (
                                        <span
                                            className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full text-white"
                                            style={{ backgroundColor: THEME_COLORS[targetTheme] }}
                                        >
                                            {CATEGORY_LABELS[targetTheme] || targetDetails.category}
                                        </span>
                                    )}
                                    {targetDetails.team && targetDetails.team !== 'Not explicitly mentioned' && (
                                        <span className="text-[10px] sm:text-xs text-slate-500">
                                            Team: {targetDetails.team}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Map View — responsive: SVG scales to fit viewport */}
                <div
                    ref={mapContainerRef}
                    className="flex-1 bg-[#f8fafc] overflow-auto overscroll-contain relative"
                >
                    <div className="w-full h-full flex items-center justify-center p-2 sm:p-4">
                        <svg
                            className="w-full h-full drop-shadow-md"
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

                            {/* Target Stall Marker — classic black teardrop pin with slow bounce */}
                            {targetStall && (
                                <g>
                                    {/* Drop shadow — pulses with bounce */}
                                    <ellipse cx={targetPos.x} cy={targetPos.y + 6} rx="8" ry="3" fill="#000" opacity="0.2">
                                        <animate attributeName="opacity" values="0.2;0.12;0.2" dur="2s" repeatCount="indefinite" />
                                        <animate attributeName="rx" values="8;6;8" dur="2s" repeatCount="indefinite" />
                                    </ellipse>
                                    {/* Bouncing pin group */}
                                    <g>
                                        <animateTransform attributeName="transform" type="translate" values={`0,0; 0,-6; 0,0`} dur="2s" repeatCount="indefinite" calcMode="spline" keySplines="0.33 0 0.67 1; 0.33 0 0.67 1" />
                                        {/* Teardrop pin body */}
                                        <path
                                            d={`M ${targetPos.x} ${targetPos.y + 4} C ${targetPos.x - 14} ${targetPos.y - 6}, ${targetPos.x - 14} ${targetPos.y - 28}, ${targetPos.x} ${targetPos.y - 34} C ${targetPos.x + 14} ${targetPos.y - 28}, ${targetPos.x + 14} ${targetPos.y - 6}, ${targetPos.x} ${targetPos.y + 4} Z`}
                                            fill="#1e1e1e"
                                            stroke="#fff"
                                            strokeWidth="2"
                                        />
                                        {/* Inner white dot */}
                                        <circle cx={targetPos.x} cy={targetPos.y - 16} r="5" fill="#fff" />
                                        {/* Stall label above pin */}
                                        <text x={targetPos.x} y={targetPos.y - 44} textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontSize="13" fill="#1e1e1e" fontWeight="900">{targetStall}</text>
                                    </g>
                                </g>
                            )}

                        </svg>
                    </div>
                </div>

                {/* Legend (Bottom Bar) — horizontally scrollable on mobile */}
                <div className="flex-none p-3 border-t border-slate-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] overflow-x-auto whitespace-nowrap z-10">
                    <div className="flex items-center gap-4 min-w-max px-2">
                        <span className="text-[10px] text-slate-500 uppercase font-bold mr-2">Zones:</span>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#9333ea]"></div><span className="text-[11px] text-slate-700 font-bold">Productivity</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]"></div><span className="text-[11px] text-slate-700 font-bold">Sustainability</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#ca8a04]"></div><span className="text-[11px] text-slate-700 font-bold">Cost</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></div><span className="text-[11px] text-slate-700 font-bold">Safety</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#06b6d4]"></div><span className="text-[11px] text-slate-700 font-bold">Reliability</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
