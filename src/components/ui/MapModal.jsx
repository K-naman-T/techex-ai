import React from 'react';
import { X, Navigation } from 'lucide-react';

export const MapModal = ({ isOpen, onClose, targetStall }) => {
    if (!isOpen) return null;

    // Simple mapping logic: Stall ID (e.g., "A-101") -> Position
    const getPinPosition = (stall) => {
        if (!stall) return { x: 400, y: 300 };

        const zone = stall.charAt(0).toUpperCase();

        // Coords based on 800x600 viewBox
        switch (zone) {
            case 'A': return { x: 200, y: 175 };
            case 'B': return { x: 600, y: 175 };
            case 'C': return { x: 200, y: 425 };
            case 'D': return { x: 600, y: 425 };
            default: return { x: 400, y: 300 };
        }
    };

    // Default User Location (Bottom Center Entrance)
    const USER_POS = { x: 400, y: 530 };
    const targetPos = getPinPosition(targetStall);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-300">

            {/* Modal Container */}
            <div className="relative w-full max-w-4xl max-h-[95vh] bg-white rounded-xl overflow-hidden shadow-2xl flex flex-col lg:flex-row animate-in zoom-in-95 duration-200">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 sm:top-4 sm:right-4 z-20 p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-all"
                >
                    <X size={18} />
                </button>

                {/* Info Panel */}
                <div className="p-4 sm:p-6 lg:p-8 lg:w-1/3 border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50 flex flex-col justify-center shrink-0">
                    <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6 text-black">
                        <Navigation size={20} className="sm:w-6 sm:h-6" />
                        <h2 className="text-base sm:text-lg font-bold tracking-tight uppercase">Wayfinding</h2>
                    </div>

                    <div className="space-y-4 sm:space-y-6">
                        <div>
                            <span className="text-[10px] sm:text-xs text-gray-400 uppercase font-semibold">Destination</span>
                            <div className="text-xl sm:text-3xl font-bold text-gray-900 mt-1">{targetStall || "Main Hall"}</div>
                        </div>

                        <div className="p-3 sm:p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                                Follow the <span className="text-blue-600 font-bold">highlighted path</span> from the Entrance to Zone {targetStall?.charAt(0) || "Center"}.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <span className="px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium bg-blue-50 text-blue-600 rounded-full">Step-free</span>
                            <span className="px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium bg-green-50 text-green-600 rounded-full">~2 min</span>
                        </div>
                    </div>
                </div>

                {/* Map View */}
                <div className="relative bg-white flex-1 min-h-[250px] sm:min-h-[350px] lg:min-h-[400px] overflow-hidden">

                    {/* Map SVG (Inline for better control) */}
                    <svg
                        className="w-full h-full"
                        viewBox="0 0 800 600"
                        preserveAspectRatio="xMidYMid meet"
                    >
                        {/* Background */}
                        <rect width="800" height="600" fill="#ffffff" />

                        {/* Grid */}
                        <defs>
                            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth="1" />
                            </pattern>
                        </defs>
                        <rect width="800" height="600" fill="url(#grid)" />

                        {/* Outer Walls */}
                        <rect x="50" y="50" width="700" height="500" rx="4" fill="none" stroke="#374151" strokeWidth="3" />

                        {/* Zone A */}
                        <g transform="translate(60, 60)">
                            <rect width="330" height="230" fill="#f3f4f6" stroke="#9ca3af" strokeWidth="2" />
                            <text x="20" y="30" fontFamily="sans-serif" fontSize="18" fill="#4b5563" fontWeight="bold">ZONE A</text>
                            <text x="20" y="50" fontFamily="sans-serif" fontSize="11" fill="#6b7280">IOT & DIGITIZATION</text>
                        </g>

                        {/* Zone B */}
                        <g transform="translate(410, 60)">
                            <rect width="330" height="230" fill="#f3f4f6" stroke="#9ca3af" strokeWidth="2" />
                            <text x="20" y="30" fontFamily="sans-serif" fontSize="18" fill="#4b5563" fontWeight="bold">ZONE B</text>
                            <text x="20" y="50" fontFamily="sans-serif" fontSize="11" fill="#6b7280">SAFETY</text>
                        </g>

                        {/* Zone C */}
                        <g transform="translate(60, 310)">
                            <rect width="330" height="230" fill="#f3f4f6" stroke="#9ca3af" strokeWidth="2" />
                            <text x="20" y="30" fontFamily="sans-serif" fontSize="18" fill="#4b5563" fontWeight="bold">ZONE C</text>
                            <text x="20" y="50" fontFamily="sans-serif" fontSize="11" fill="#6b7280">GREEN TECH</text>
                        </g>

                        {/* Zone D */}
                        <g transform="translate(410, 310)">
                            <rect width="330" height="230" fill="#f3f4f6" stroke="#9ca3af" strokeWidth="2" />
                            <text x="20" y="30" fontFamily="sans-serif" fontSize="18" fill="#4b5563" fontWeight="bold">ZONE D</text>
                            <text x="20" y="50" fontFamily="sans-serif" fontSize="11" fill="#6b7280">INDUSTRIAL</text>
                        </g>

                        {/* Entrance Label */}
                        <text x="400" y="575" textAnchor="middle" fontFamily="sans-serif" fontSize="14" fill="#374151" fontWeight="bold">ENTRANCE</text>

                        {/* Dynamic Path Line */}
                        <path
                            d={`M ${USER_POS.x} ${USER_POS.y} Q 400 300 ${targetPos.x} ${targetPos.y}`}
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="4"
                            strokeDasharray="10 6"
                            className="animate-[dash_1s_linear_infinite]"
                        />

                        {/* Start Point (You) */}
                        <circle cx={USER_POS.x} cy={USER_POS.y} r="10" fill="#2563eb" />
                        <text x={USER_POS.x} y={USER_POS.y + 4} textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill="white" fontWeight="bold">YOU</text>

                        {/* End Point (Target) */}
                        <circle cx={targetPos.x} cy={targetPos.y} r="18" fill="#ef4444" opacity="0.3" className="animate-ping" />
                        <circle cx={targetPos.x} cy={targetPos.y} r="12" fill="#ef4444" />
                        <text x={targetPos.x} y={targetPos.y + 4} textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill="white" fontWeight="bold">{targetStall?.charAt(0)}</text>

                    </svg>
                </div>

            </div>
        </div>
    );
};
