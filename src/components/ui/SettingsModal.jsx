import { useState, useEffect } from 'react';
import { X, Save, Volume2, Mic, Check, Loader2 } from 'lucide-react';

export const SettingsModal = ({
    isOpen,
    onClose,
    ttsProvider,
    setTtsProvider,
    sttLanguage,
    setSttLanguage,
    onSave
}) => {
    // Local state for pending changes
    const [localProvider, setLocalProvider] = useState(ttsProvider);
    const [localLanguage, setLocalLanguage] = useState(sttLanguage);
    const [isSaving, setIsSaving] = useState(false);
    const [showSaved, setShowSaved] = useState(false);

    // Sync local state when modal opens
    useEffect(() => {
        if (isOpen) {
            setLocalProvider(ttsProvider);
            setLocalLanguage(sttLanguage);
            setShowSaved(false);
        }
    }, [isOpen, ttsProvider, sttLanguage]);

    const hasChanges = localProvider !== ttsProvider || localLanguage !== sttLanguage;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Update parent state
            setTtsProvider(localProvider);
            setSttLanguage(localLanguage);

            // Call optional save callback (for backend sync)
            if (onSave) {
                await onSave({ voice_provider: localProvider, stt_language: localLanguage });
            }

            setShowSaved(true);
            setTimeout(() => setShowSaved(false), 2000);
        } catch (e) {
            console.error("Failed to save settings", e);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <h2 className="text-lg font-bold text-white">Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* STT Language */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Mic size={16} />
                            <span className="font-medium uppercase tracking-wider text-xs">Speech Input Language</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setLocalLanguage('en-IN')}
                                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2
                                    ${localLanguage === 'en-IN'
                                        ? 'bg-cyan-500/20 text-cyan-400 border-2 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                                        : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'}`}
                            >
                                🇬🇧 English
                                {localLanguage === 'en-IN' && <Check size={16} />}
                            </button>
                            <button
                                onClick={() => setLocalLanguage('hi-IN')}
                                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2
                                    ${localLanguage === 'hi-IN'
                                        ? 'bg-cyan-500/20 text-cyan-400 border-2 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                                        : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'}`}
                            >
                                🇮🇳 हिंदी
                                {localLanguage === 'hi-IN' && <Check size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* TTS Provider */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Volume2 size={16} />
                            <span className="font-medium uppercase tracking-wider text-xs">Voice Engine</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setLocalProvider('elevenlabs')}
                                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all flex flex-col items-center gap-1
                                    ${localProvider === 'elevenlabs'
                                        ? 'bg-cyan-500/20 text-cyan-400 border-2 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                                        : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'}`}
                            >
                                <span className="font-semibold">ElevenLabs</span>
                                <span className="text-xs opacity-60">Premium Quality</span>
                            </button>
                            <button
                                onClick={() => setLocalProvider('sarvam')}
                                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all flex flex-col items-center gap-1
                                    ${localProvider === 'sarvam'
                                        ? 'bg-cyan-500/20 text-cyan-400 border-2 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                                        : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'}`}
                            >
                                <span className="font-semibold">Sarvam AI</span>
                                <span className="text-xs opacity-60">Indian Accent</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                        {hasChanges ? '• Unsaved changes' : ''}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges || isSaving}
                            className={`px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all
                                ${hasChanges && !isSaving
                                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-900/30'
                                    : 'bg-white/5 text-gray-500 cursor-not-allowed'}`}
                        >
                            {isSaving ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : showSaved ? (
                                <>
                                    <Check size={16} />
                                    Saved!
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
