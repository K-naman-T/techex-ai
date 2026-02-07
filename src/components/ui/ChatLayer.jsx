import { FloatingChat } from './FloatingChat';

export const ChatLayer = ({
    messages,
    loading,
    isFocused,
    onMapClick
}) => {
    return (
        <div
            className={`absolute inset-0 z-30 transition-all duration-500 ${isFocused ? 'pt-24 opacity-100' : 'opacity-0 pointer-events-none'
                }`}
        >
            <FloatingChat
                messages={messages}
                loading={loading}
                isFocused={isFocused}
                onMapClick={onMapClick}
            />
        </div>
    );
};

// Focus overlay backdrop
export const FocusOverlay = ({ isFocused }) => {
    return (
        <div
            className={`absolute inset-0 z-10 bg-black/60 backdrop-blur-xl transition-all duration-700 ease-in-out pointer-events-none ${isFocused ? 'opacity-100' : 'opacity-0'
                }`}
        />
    );
};
