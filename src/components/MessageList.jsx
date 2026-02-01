import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.md};
  overflow-y: auto;
  max-height: 100%;
  padding-right: 5px;
  padding-bottom: 20px;

  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
`;

const MessageWrapper = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-self: ${props => props.role === 'user' ? 'flex-end' : 'flex-start'};
  max-width: 85%;
`;

const Bubble = styled.div`
  padding: ${props => props.theme.spacing.md};
  border-radius: ${props => props.theme.borderRadius.lg};
  font-size: 0.95rem;
  line-height: 1.6;
  font-family: var(--font-sans);
  
  /* User Bubble */
  ${props => props.role === 'user' && `
    background: linear-gradient(135deg, ${props.theme.colors.primary} 0%, ${props.theme.colors.accent} 100%);
    color: ${props.theme.colors.text.primary};
    border-bottom-right-radius: ${props.theme.borderRadius.xs};
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
  `}

  /* AI Bubble */
  ${props => props.role === 'model' && `
    background: ${props.theme.colors.surface.glassStrong};
    backdrop-filter: ${props.theme.glass.backdropFilter};
    border: ${props.theme.glass.border};
    color: ${props.theme.colors.text.primary};
    border-bottom-left-radius: ${props.theme.borderRadius.xs};
    box-shadow: ${props.theme.glass.shadow};
  `}
`;

const Time = styled.span`
  font-size: 0.7rem;
  color: ${props => props.theme.colors.text.muted};
  margin-top: 4px;
  align-self: ${props => props.role === 'user' ? 'flex-end' : 'flex-start'};
  padding: 0 4px;
`;

const TypingIndicator = styled.div`
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  
  span {
    width: 6px;
    height: 6px;
    background: ${props => props.theme.colors.text.secondary};
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out both;
  }
  
  span:nth-child(1) { animation-delay: -0.32s; }
  span:nth-child(2) { animation-delay: -0.16s; }
  
  @keyframes bounce {
    0%, 80%, 100% { transform: scale(0); }
    40% { transform: scale(1); }
  }
`;

const MessageList = ({ messages, isLoading, scrollRef }) => {
  return (
    <Container ref={scrollRef}>
      <AnimatePresence initial={false}>
        {messages.map((msg, idx) => (
          <MessageWrapper
            key={idx}
            role={msg.role}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Bubble role={msg.role}>
              {msg.text}
            </Bubble>
          </MessageWrapper>
        ))}
        {isLoading && (
          <MessageWrapper
            role="model"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Bubble role="model">
              <TypingIndicator>
                <span></span><span></span><span></span>
              </TypingIndicator>
            </Bubble>
          </MessageWrapper>
        )}
      </AnimatePresence>
    </Container>
  );
};

export default MessageList;
