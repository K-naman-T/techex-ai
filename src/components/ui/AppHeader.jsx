import { Settings, LogOut, Trash2 } from 'lucide-react';
import { SettingsModal } from './SettingsModal';

export const AppHeader = ({
    showSettings,
    setShowSettings,
    ttsProvider,
    setTtsProvider,
    sttLanguage,
    setSttLanguage,
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
                    className="h-10 w-10 rounded-full border border-white/10 bg-black/20 text-gray-400 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center backdrop-blur-md transition-all"
                    title="Clear History"
                >
                    <Trash2 size={18} />
                </button>

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
