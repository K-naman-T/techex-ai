import React from 'react';

export const AudioVisualizer = ({ isActive }) => {
  return (
    <div className={`flex items-center gap-1 h-8 ${isActive ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}>
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="w-1 bg-cyan-400 rounded-full animate-wave"
          style={{
            height: '100%',
            animationDelay: `${i * 0.1}s`,
            animationPlayState: isActive ? 'running' : 'paused'
          }}
        />
      ))}
    </div>
  );
};
