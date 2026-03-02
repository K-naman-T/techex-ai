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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                    <h2 className="text-lg font-bold text-slate-900">Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-700"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* STT Language */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Mic size={16} />
                            <span className="font-medium uppercase tracking-wider text-xs">Speech Input Language</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => setLocalLanguage('en-IN')}
                                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2
                                    ${localLanguage === 'en-IN'
                                        ? 'bg-cyan-50 text-cyan-700 border-2 border-cyan-400 shadow-sm'
                                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-800'}`}
                            >
                                🇬🇧 English
                                {localLanguage === 'en-IN' && <Check size={16} />}
                            </button>
                            <button
                                onClick={() => setLocalLanguage('hi-IN')}
                                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2
                                    ${localLanguage === 'hi-IN'
                                        ? 'bg-cyan-50 text-cyan-700 border-2 border-cyan-400 shadow-sm'
                                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-800'}`}
                            >
                                🇮🇳 हिंदी
                                {localLanguage === 'hi-IN' && <Check size={16} />}
                            </button>
                            <button
                                onClick={() => setLocalLanguage('hi-Hinglish')}
                                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2
                                    ${localLanguage === 'hi-Hinglish'
                                        ? 'bg-cyan-50 text-cyan-700 border-2 border-cyan-400 shadow-sm'
                                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-800'}`}
                            >
                                🗣️ Hinglish
                                {localLanguage === 'hi-Hinglish' && <Check size={16} />}
                            </button>
                        </div>
                    </div>


                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div className="text-xs text-slate-400">
                        {hasChanges ? '• Unsaved changes' : ''}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges || isSaving}
                            className={`px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all
                                ${hasChanges && !isSaving
                                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 shadow-lg shadow-cyan-500/20'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
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
