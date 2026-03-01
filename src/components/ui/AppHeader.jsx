import { Settings, LogOut, Trash2 } from 'lucide-react';
import { SettingsModal } from './SettingsModal';

export const AppHeader = ({
    showSettings,
    setShowSettings,
    ttsProvider,
    setTtsProvider,
    sttLanguage,
    setSttLanguage,
    voiceMode,
    setVoiceMode,
    onLogout,
    onClearHistory
}) => {
    return (
        <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-start pointer-events-none z-50">
            {/* Logo / Branding */}
            <div className="pointer-events-auto flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <img
                        src="/techex26-logo.png"
                        alt="TechEx 2026 Logo"
                        className="h-16 w-auto object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                    />
                </div>
            </div>

            {/* Controls */}
            <div className="pointer-events-auto flex gap-3 relative">
                {/* Clear History Button */}
                <button
                    onClick={onClearHistory}
                    className="h-10 w-10 rounded-full border border-white/10 bg-slate-900/20 text-slate-700 hover:text-red-600 hover:bg-red-500/10 flex items-center justify-center backdrop-blur-md transition-all"
                    title="Clear History"
                >

                    <Trash2 size={18} />
                </button>

                {/* Settings Button */}
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`h-10 w-10 rounded-full border flex items-center justify-center backdrop-blur-md transition-all ${showSettings ? 'bg-white/40 border-white/60 text-indigo-600' : 'bg-slate-900/20 border-white/10 text-slate-700 hover:text-indigo-600 hover:bg-white/20'}`}
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
                    voiceMode={voiceMode}
                    setVoiceMode={setVoiceMode}
                />

                {/* Logout Button */}
                <button
                    onClick={onLogout}
                    title="Sign Out"
                    className="h-10 w-10 rounded-full border flex items-center justify-center backdrop-blur-md transition-all bg-slate-900/20 border-white/10 text-slate-700 hover:text-red-600 hover:bg-red-500/10 hover:border-red-500/30"
                >
                    <LogOut size={18} />
                </button>

            </div>
        </div>
    );
};
