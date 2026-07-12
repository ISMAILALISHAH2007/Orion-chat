'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Sparkles, Volume2, VolumeX, ChevronDown, BrainCircuit } from 'lucide-react';
import { parseMarkdown } from '@/app/lib/utils/markdown';
import { generatePreviewHtml } from '@/app/lib/utils/preview';
import { useTTS } from '@/app/components/providers/TTSProvider';

interface MessageBubbleProps {
  sender: 'user' | 'ai';
  text: string;
  mode?: string;
  attachments?: { url: string; mimeType: string; name: string }[];
  isStreaming?: boolean;
}

/**
 * Parse [REASONING]...[/REASONING] blocks from AI text.
 * Returns { mainText, reasoningText } or null if no reasoning tags.
 */
function parseReasoning(text: string): { mainText: string; reasoningText: string } | null {
  const match = text.match(/\[REASONING\]([\s\S]*?)\[\/REASONING\]/);
  if (!match) return null;
  const reasoningText = match[1].trim();
  const mainText = text.replace(/\[REASONING\][\s\S]*?\[\/REASONING\]/, '').trim();
  return { mainText, reasoningText };
}

export default function MessageBubble({ sender, text, attachments, isStreaming }: MessageBubbleProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const { speak, stopSpeaking, isSpeaking, initAudioContext } = useTTS();
  const [reasoningOpen, setReasoningOpen] = useState(false);

  const reasoning = parseReasoning(text);
  const displayText = reasoning ? reasoning.mainText : text;
  const reasoningText = reasoning?.reasoningText;

  // Wire up copy + preview buttons in code blocks
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const cleanups: Array<() => void> = [];

    const copyButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('.code-copy'));
    copyButtons.forEach((btn) => {
      const onClick = () => {
        const code = btn.closest('.code-block')?.querySelector('code')?.textContent ?? '';
        navigator.clipboard?.writeText(code).then(() => {
          const original = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = original; }, 2000);
        });
      };
      btn.addEventListener('click', onClick);
      cleanups.push(() => btn.removeEventListener('click', onClick));
    });

    const previewButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('.code-preview'));
    previewButtons.forEach((btn) => {
      const onClick = () => {
        const lang = btn.getAttribute('data-lang') || 'text';
        const rawCode = btn.getAttribute('data-code') || '';
        const decoded = rawCode.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        const win = window.open('', '_blank', 'width=900,height=700');
        if (!win) return;
        win.document.write(generatePreviewHtml(decoded, lang));
        win.document.close();
      };
      btn.addEventListener('click', onClick);
      cleanups.push(() => btn.removeEventListener('click', onClick));
    });

    return () => cleanups.forEach((c) => c());
  }, [displayText]);

  const handleReadAloud = () => {
    initAudioContext();
    if (isSpeaking) stopSpeaking();
    else speak(displayText);
  };

  if (sender === 'user') {
    return (
      <div className="gemini-msg-user">
        <div className="gemini-msg-user-bubble">
          {text}
          {attachments && attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {attachments.map((att, idx) => (
                <div key={idx} className="relative h-20 w-20 sm:h-28 sm:w-28 overflow-hidden rounded-xl border border-border shadow-sm transition-transform hover:scale-105 cursor-pointer">
                  <Image src={att.url} alt={att.name} fill className="object-cover" unoptimized />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="gemini-msg-ai">
      <span className="gemini-msg-avatar">
        <Sparkles size={14} className="text-accent" />
      </span>
      <div className="gemini-msg-content">
        {/* Expandable Reasoning Section */}
        {reasoningText && (
          <div className="gemini-reasoning-section">
            <button
              type="button"
              onClick={() => setReasoningOpen((o) => !o)}
              className="gemini-reasoning-toggle"
            >
              <BrainCircuit size={14} className="shrink-0 text-gemini-purple" />
              <span>Show reasoning</span>
              <ChevronDown size={13} className={`ml-auto shrink-0 text-muted transition-transform ${reasoningOpen ? 'rotate-180' : ''}`} />
            </button>
            {reasoningOpen && (
              <div className="gemini-reasoning-content">
                <div className="gemini-reasoning-text">{reasoningText}</div>
              </div>
            )}
          </div>
        )}

        {/* Main answer */}
        <div
          ref={contentRef}
          className="msg-content"
          dangerouslySetInnerHTML={{
            __html: parseMarkdown(displayText) + (isStreaming
              ? '<span class="ml-1 inline-block h-4 w-2 animate-pulse bg-accent align-middle shadow-[0_0_6px_var(--accent)] rounded-full"></span>'
              : '')
          }}
        />

        {!isStreaming && (
          <button
            onClick={handleReadAloud}
            className="mt-2 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all hover:bg-surface-2 active:scale-95 border border-border/50 text-muted hover:text-foreground"
            title={isSpeaking ? 'Stop reading' : 'Read aloud'}
          >
            {isSpeaking ? (
              <><VolumeX size={12} /><span>Stop</span></>
            ) : (
              <><Volume2 size={12} /><span>Read aloud</span></>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
