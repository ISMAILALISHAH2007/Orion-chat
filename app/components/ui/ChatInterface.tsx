'use client';
import { useState, useEffect, useRef } from 'react';
import { useChat } from '@/app/components/hooks/useChat';
import { useVoice } from '@/app/components/hooks/useVoice';
import { parseMarkdown } from '@/app/lib/utils/markdown';
import { UltronAnimations } from '@/app/lib/animations';
import MessageBubble from './MessageBubble';

export default function ChatInterface() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, isStreaming } = useChat();
  const { isRecording, toggleRecording, transcript } = useVoice();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    UltronAnimations.boot();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (transcript) {
      setInput((prev) => prev ? prev + ' ' + transcript : transcript);
    }
  }, [transcript]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <section className="chat-section glass">
      <div id="chat-messages" className="messages-container">
        {messages.map((msg, idx) => (
          <MessageBubble key={idx} sender={msg.sender} text={msg.text} mode={msg.mode} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <div className="input-glass-wrapper">
          <button
            id="btn-voice"
            className={`btn-voice-indicator ${isRecording ? 'active' : ''}`}
            onClick={toggleRecording}
            aria-label="Voice input"
          >
            <div className="pulse-ring"></div>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </button>
          <input
            type="text"
            id="chat-input"
            placeholder="Transmit commands or speak freely..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
          />
          <button
            id="btn-send"
            className="btn-send"
            onClick={handleSend}
            disabled={isStreaming}
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
