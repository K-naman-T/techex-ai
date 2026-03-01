import React, { useEffect, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';

const rotate = keyframes`
  0% { transform: rotate(0deg) scale(var(--audio-scale, 1)); }
  100% { transform: rotate(360deg) scale(var(--audio-scale, 1)); }
`;

const StyledWrapper = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 40;
  pointer-events: none;

  .orb-clickable-area {
    position: relative;
    width: 350px;
    height: 350px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    pointer-events: auto;
    z-index: 45;
    
    &:hover .orb-container {
      transform: scale(1.05);
      filter: drop-shadow(0 0 30px #ff3e1cbb) drop-shadow(0 0 30px #1c8cffbb);
    }
  }

  .orb-container {
    position: relative;
    width: 300px;
    height: 300px;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    border-radius: 50%;
    rotate: 90deg;
    transition: all 1.2s cubic-bezier(0.4, 0, 0.2, 1);
    
    /* Inactive State: Grayscale/Low Opacity shadow */
    filter: ${props => props.$isActive
    ? 'drop-shadow(0 0 10px #ff3e1c88) drop-shadow(0 0 10px #1c8cff88)'
    : 'drop-shadow(0 0 5px #ffffff22)'};

    ${props => props.$isListening && css`
      filter: drop-shadow(0 0 25px #06b6d4) drop-shadow(0 0 25px #3b82f6);
    `}
  }

  .orb {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: #060606;
    filter: blur(24px);
    
    /* Dynamic speed based on state */
    animation: ${rotate} linear infinite;
    animation-duration: ${props => {
    if (!props.$isActive) return '60s';
    if (props.$isListening) return '3s';
    if (props.$isLoading) return '10s';
    if (props.$isSpeaking) return '10s';
    return '40s';
  }};
    transition: animation-duration 1.2s ease-in-out;
  }

  .orb-inner {
    position: absolute;
    left: -120%;
    top: -25%;
    width: 160%;
    aspect-ratio: 1;
    border-radius: 50%;
    
    /* Active vs Inactive Colors */
    background: ${props => {
    if (!props.$isActive) return 'radial-gradient(ellipse at 30% 40%, rgba(245,245,245,0.6), rgba(200,200,210,0.3) 50%, rgba(100,100,120,0.15) 100%)'; // White smoke dormant
    return props.$isListening ? '#06b6d4' : '#ff3e1c';
  }};
    transition: background 1.2s cubic-bezier(0.4, 0, 0.2, 1);
    
    clip-path: polygon(
      50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 
      50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%
    );
    
    animation: ${rotate} linear infinite;
    animation-duration: ${props => {
    if (!props.$isActive) return '45s';
    if (props.$isListening) return '4s';
    if (props.$isLoading) return '6s';
    if (props.$isSpeaking) return '6s';
    return '30s';
  }};
    
    opacity: ${props => props.$isActive ? '0.8' : '0.55'};
    will-change: transform;
    --audio-scale: 1;
  }

  .orb-inner:nth-child(2) {
    left: auto;
    right: -120%;
    top: auto;
    bottom: -25%;
    
    background: ${props => {
    if (!props.$isActive) return '#555555'; // Inactive lighter Gray
    return props.$isListening ? '#3b82f6' : '#1c8cff';
  }};
    
    animation-duration: ${props => {
    if (!props.$isActive) return '50s';
    if (props.$isListening) return '5s';
    if (props.$isLoading) return '8s';
    if (props.$isSpeaking) return '8s';
    return '35s';
  }};
    animation-direction: reverse;
    
    clip-path: polygon(
      20% 0%, 0% 20%, 30% 50%, 0% 80%, 20% 100%, 
      50% 70%, 80% 100%, 100% 80%, 70% 50%, 100% 20%, 
      80% 0%, 50% 30%
    );
  }
`;

export const StyledOrbAvatar = ({ isSpeaking, isListening, isLoading, isActive, analyser, micAnalyser, onClick, onInterruptStart, onInterruptStop }) => {
  const requestRef = useRef();
  const lastScale = useRef(1);
  const innerRef1 = useRef(null);
  const innerRef2 = useRef(null);
  // Robust tap tracking to circumvent WebKit animation hit-test bugs
  const pointerDownTimeRef = useRef(0);
  const pointerDownPosRef = useRef(null);


  const activeAnalyser = isListening ? micAnalyser : (isSpeaking ? analyser : null);

  useEffect(() => {
    if (!activeAnalyser || !isActive) {
      if (innerRef1.current) innerRef1.current.style.setProperty('--audio-scale', '1');
      if (innerRef2.current) innerRef2.current.style.setProperty('--audio-scale', '1');
      return;
    }

    const dataArray = new Uint8Array(activeAnalyser.frequencyBinCount);

    const update = () => {
      activeAnalyser.getByteFrequencyData(dataArray);

      let sum = 0;
      const range = 32;
      for (let i = 0; i < range; i++) {
        sum += dataArray[i];
      }
      const average = sum / range;
      const targetScale = 1 + (average / 255) * 1.2;

      const smoothedScale = lastScale.current + (targetScale - lastScale.current) * 0.25;
      lastScale.current = smoothedScale;

      if (innerRef1.current) innerRef1.current.style.setProperty('--audio-scale', smoothedScale.toFixed(3));
      if (innerRef2.current) innerRef2.current.style.setProperty('--audio-scale', smoothedScale.toFixed(3));

      requestRef.current = requestAnimationFrame(update);
    };

    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [activeAnalyser, isActive]);

  const handlePointerDown = (e) => {
    // DO NOT preventDefault, allow native pan to evaluate, but trap capture
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { }
    pointerDownTimeRef.current = Date.now();
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) { }
    if (!pointerDownTimeRef.current) return;

    // Calculate if this was a quick tap (< 500ms) with minimal movement (< 15px)
    const timeDelta = Date.now() - pointerDownTimeRef.current;
    const distance = pointerDownPosRef.current
      ? Math.hypot(e.clientX - pointerDownPosRef.current.x, e.clientY - pointerDownPosRef.current.y)
      : 0;

    pointerDownTimeRef.current = 0; // reset
    if (timeDelta < 500 && distance < 15) {
      onClick?.();
    }
  };

  return (
    <StyledWrapper $isListening={isListening} $isSpeaking={isSpeaking} $isLoading={isLoading} $isActive={isActive}>
      <div
        className="orb-clickable-area"
        style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTapHighlightColor: 'transparent' }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="orb-container">
          <div className="orb">
            <div ref={innerRef1} className="orb-inner" />
            <div ref={innerRef2} className="orb-inner" />
          </div>
        </div>

        {/* Status label */}
        <div className={`absolute -bottom-6 font-mono tracking-widest text-[10px] uppercase ${isListening ? 'text-green-400 animate-pulse' : 'text-white/40 animate-pulse'}`}>
          {!isActive ? 'Tap to start voice' : (
            isListening ? 'Tap when done' : (
              isSpeaking || isLoading ? 'Tap to interrupt' : 'Tap to speak'
            )
          )}
        </div>
      </div>
    </StyledWrapper>
  );
};
