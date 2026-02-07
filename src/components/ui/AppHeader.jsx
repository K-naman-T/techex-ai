import { Settings, StopCircle, LogOut } from 'lucide-react';
import { SettingsModal } from './SettingsModal';

export const AppHeader = ({
    isSpeaking,
    onStop,
    showSettings,
    setShowSettings,
    ttsProvider,
    setTtsProvider,
    sttLanguage,
    setSttLanguage,
    onLogout
}) => {
    return (
        <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-start pointer-events-none z-50">
            {/* Logo / Branding */}
            <div className="pointer-events-auto">
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

            {/* Controls */}
            <div className="pointer-events-auto flex gap-3 relative">
                {/* Stop Speaking Button */}
                {isSpeaking && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onStop(); }}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/80 border border-red-500/50 text-white rounded-full hover:bg-red-600 transition-all backdrop-blur-md shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-in fade-in zoom-in duration-300"
                    >
                        <StopCircle size={20} className="animate-pulse" />
                        <span className="font-mono text-sm font-bold">STOP</span>
                    </button>
                )}

                {/* Settings Button */}
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`h-10 w-10 rounded-full border flex items-center justify-center backdrop-blur-md transition-all ${showSettings ? 'bg-white/10 border-white/30 text-white' : 'bg-black/20 border-white/10 text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    <Settings size={20} />
                </button>

                {/* Settings Modal */}
                <SettingsModal
                    isOpen={showSettings}
                    onClose={() => setShowSettings(false)}
                    ttsProvider={ttsProvider}
                    setTtsProvider={setTtsProvider}
                    sttLanguage={sttLanguage}
                    setSttLanguage={setSttLanguage}
                />

                {/* Logout Button */}
                <button
                    onClick={onLogout}
                    title="Sign Out"
                    className="h-10 w-10 rounded-full border flex items-center justify-center backdrop-blur-md transition-all bg-black/20 border-white/10 text-gray-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30"
                >
                    <LogOut size={18} />
                </button>
            </div>
        </div>
    );
};
