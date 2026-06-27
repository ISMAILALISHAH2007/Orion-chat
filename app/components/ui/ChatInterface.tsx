'use client';
import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  Paperclip,
  Mic,
  ArrowUp,
  PenLine,
  Dumbbell,
  BarChart3,
  Code2,
} from 'lucide-react';
import { useChat } from '@/app/components/providers/ChatProvider';
import { useVoice } from '@/app/components/hooks/useVoice';
import MessageBubble from './MessageBubble';

const SUGGESTIONS = [
  { icon: PenLine, title: 'Help me write', prompt: 'Help me write a professional email to reschedule a meeting.' },
  { icon: Dumbbell, title: 'Create a workout plan', prompt: 'Create a 4-day workout plan for building strength at home.' },
  { icon: BarChart3, title: 'Analyze a dataset', prompt: 'How should I approach analyzing a sales dataset to find trends?' },
  { icon: Code2, title: 'Explain some code', prompt: 'Explain how async/await works in JavaScript with an example.' },
];

export default function ChatInterface() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, isStreaming } = useChat();
  const { isRecording, toggleRecording, transcript } = useVoice();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: session } = useSession();
  const userName = session?.user?.name?.split(' ')[0] || 'there';

  const isEmpty = messages.length === 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (transcript) {
      setInput((prev) => (prev ? prev + ' ' + transcript : transcript));
    }
  }, [transcript]);

  // Auto-grow the textarea.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [input]);

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

  const lastMessage = messages[messages.length - 1];
  const showThinking = isStreaming && (!lastMessage || lastMessage.sender === 'user');

  return (
    <section className="relative flex min-h-0 flex-1 flex-col bg-background">
      {/* Conversation window */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center px-4 py-10">
            <h1 className="text-balance text-center font-display text-3xl font-semibold text-foreground sm:text-4xl">
              How can I help you{userName !== 'there' ? `, ${userName}` : ''} today?
            </h1>
            <p className="mt-3 text-center text-sm text-muted">
              Ask anything, or start with one of these.
            </p>
            <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
              {SUGGESTIONS.map(({ icon: Icon, title, prompt }) => (
                <button
                  key={title}
                  onClick={() => {
                    setInput(prompt);
                    textareaRef.current?.focus();
                  }}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-all hover:border-accent hover:bg-surface-2"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-accent transition-colors group-hover:bg-background">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{title}</span>
                    <span className="mt-0.5 block text-xs text-muted line-clamp-2">{prompt}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
            {messages.map((msg, idx) => (
              <MessageBubble key={idx} sender={msg.sender} text={msg.text} mode={msg.mode} />
            ))}
            {showThinking && (
              <div className="flex animate-fade-in items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface" />
                <span className="thinking-dots" aria-label="Assistant is thinking">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Docked input */}
      <div className="px-4 pb-6">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-2 shadow-sm transition-all focus-within:border-accent focus-within:ring-2 focus-within:ring-[var(--accent-soft)]">
            <textarea
              ref={textareaRef}
              value={input}
              rows={1}
              placeholder="Message ULTRON…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              className="max-h-[200px] w-full resize-none bg-transparent px-3 py-2 text-[0.975rem] leading-relaxed text-foreground outline-none placeholder:text-muted disabled:opacity-60"
            />
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Attach file"
                  className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  <Paperclip size={18} />
                </button>
                <button
                  type="button"
                  onClick={toggleRecording}
                  aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
                  className={[
                    'relative rounded-lg p-2 transition-colors',
                    isRecording
                      ? 'voice-active bg-[var(--danger)] text-white'
                      : 'text-muted hover:bg-surface-2 hover:text-foreground',
                  ].join(' ')}
                >
                  <span className="pulse-ring" aria-hidden="true" />
                  <Mic size={18} />
                </button>
              </div>
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                aria-label="Send message"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted"
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-muted">
            ULTRON can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </section>
  );
}
