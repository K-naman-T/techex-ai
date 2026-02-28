import React, { useEffect, useRef } from 'react';
import './BlobAvatar.css';

export const BlobAvatar = ({ isSpeaking, isListening, analyser }) => {
  const blobRef = useRef(null);
  const animationRef = useRef(null);

  // Audio Reactivity Loop
  useEffect(() => {
    if (!isSpeaking || !analyser || !blobRef.current) {
      if (blobRef.current) {
        blobRef.current.style.setProperty('--size', '1.5');
      }
      return;
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let currentScale = 1.5;

    const update = () => {
      if (!isSpeaking) return;

      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      let sum = 0;
      const range = dataArray.length / 2; // Focus on lower frequencies
      for (let i = 0; i < range; i++) {
        sum += dataArray[i];
      }
      const average = sum / range;

      // Target scale
      const targetScale = 1.5 + (average / 255) * 1.0; // Reduced max scale slightly for stability

      // Linear interpolation (Lerp) for smoothness without CSS transition lag
      // 0.1 factor = quick response but smoothed out jitter
      currentScale += (targetScale - currentScale) * 0.15;

      if (blobRef.current) {
        blobRef.current.style.setProperty('--size', currentScale.toFixed(3));
      }

      animationRef.current = requestAnimationFrame(update);
    };

    update();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isSpeaking, analyser]);

  // Determine state class
  let stateClass = '';
  if (isListening) stateClass = 'listening';
  else if (isSpeaking) stateClass = 'speaking';

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#050505] z-0 pointer-events-none">
      <div 
        ref={blobRef} 
        className={`blob-loader ${stateClass}`}
        style={{ '--size': 1.5 }} // Default starting size
      >
        <svg width="100" height="100" viewBox="0 0 100 100">
          <defs>
            <mask id="clipping">
              <polygon points="0,0 100,0 100,100 0,100" fill="black"></polygon>
              <polygon points="25,25 75,25 50,75" fill="white"></polygon>
              <polygon points="50,25 75,75 25,75" fill="white"></polygon>
              <polygon points="35,35 65,35 50,65" fill="white"></polygon>
              <polygon points="35,35 65,35 50,65" fill="white"></polygon>
              <polygon points="35,35 65,35 50,65" fill="white"></polygon>
              <polygon points="35,35 65,35 50,65" fill="white"></polygon>
            </mask>
          </defs>
        </svg>
        <div className="box"></div>
      </div>
    </div>
  );
};
