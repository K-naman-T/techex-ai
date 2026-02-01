import React, { useState } from 'react';
import styled from 'styled-components';

const Form = styled.form`
  width: 100%;
  position: relative;
`;

const InputContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
  background: ${props => props.theme.colors.surface.glassStrong};
  backdrop-filter: ${props => props.theme.glass.backdropFilter};
  padding: ${props => props.theme.spacing.sm};
  border-radius: ${props => props.theme.borderRadius.full};
  box-shadow: ${props => props.theme.glass.shadow};
  border: ${props => props.theme.glass.border};
  transition: all 0.3s ease;

  &:focus-within {
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 20px rgba(99, 102, 241, 0.2);
    transform: translateY(-2px);
  }
`;

const StyledInput = styled.input`
  flex: 1;
  padding: 12px 20px;
  border: none;
  background: transparent;
  outline: none;
  font-size: 1rem;
  color: ${props => props.theme.colors.text.primary};
  font-family: var(--font-sans);

  &::placeholder {
    color: ${props => props.theme.colors.text.muted};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

const SendButton = styled.button`
  background: linear-gradient(135deg, ${props => props.theme.colors.primary} 0%, ${props => props.theme.colors.accent} 100%);
  color: white;
  border: none;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);

  &:disabled {
    background: ${props => props.theme.colors.surface.card};
    color: ${props => props.theme.colors.text.muted};
    cursor: not-allowed;
    box-shadow: none;
  }

  &:hover:not(:disabled) {
    transform: scale(1.1);
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.6);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

const ChatInput = ({ onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
  };

  return (
    <Form onSubmit={handleSubmit}>
      <InputContainer>
        <StyledInput
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything..."
          disabled={isLoading}
        />
        <SendButton type="submit" disabled={isLoading || !input.trim()}>
          {isLoading ? (
            <svg viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" />
              <style>{'@keyframes spin { 100% { transform: rotate(360deg); } }'}</style>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          )}
        </SendButton>
      </InputContainer>
    </Form>
  );
};

export default ChatInput;
