'use client';
import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { Sparkles, Volume2, VolumeX } from 'lucide-react';
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

export default function MessageBubble({ sender, text, attachments, isStreaming }: MessageBubbleProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const { speak, stopSpeaking, isSpeaking, initAudioContext } = useTTS();

  // Wire up "Copy" and "Preview" buttons inside rendered code blocks.
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;

    const cleanups: Array<() => void> = [];

    // Copy buttons
    const copyButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('.code-copy'));
    copyButtons.forEach((btn) => {
      const onClick = () => {
        const code = btn.closest('.code-block')?.querySelector('code')?.textContent ?? '';
        navigator.clipboard?.writeText(code).then(() => {
          const original = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => {
            btn.textContent = original;
          }, 2000);
        });
      };
      btn.addEventListener('click', onClick);
      cleanups.push(() => btn.removeEventListener('click', onClick));
    });

    // Preview buttons — uses shared utility + client-side document.write (no URL limits)
    const previewButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('.code-preview'));
    previewButtons.forEach((btn) => {
      const onClick = () => {
        const lang = btn.getAttribute('data-lang') || 'text';
        const rawCode = btn.getAttribute('data-code') || '';
        // Decode HTML entities back to raw code
        const decoded = rawCode
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
        
        const win = window.open('', '_blank', 'width=900,height=700');
        if (!win) return;
        
        const html = generatePreviewHtml(decoded, lang);
        win.document.write(html);
        win.document.close();
      };
      btn.addEventListener('click', onClick);
      cleanups.push(() => btn.removeEventListener('click', onClick));
    });

    return () => cleanups.forEach((c) => c());
  }, [text]);

  const handleReadAloud = () => {
    initAudioContext();
    if (isSpeaking) {
      stopSpeaking();
    } else {
      speak(text);
    }
  };

  if (sender === 'user') {
    return (
      <div className="flex animate-fade-in-up justify-end mb-3 sm:mb-6">
        <div className="max-w-[90%] sm:max-w-[80%] rounded-[20px] sm:rounded-[24px] rounded-br-sm bg-surface-2 px-3.5 py-2.5 sm:px-5 sm:py-3.5 shadow-sm border border-border/50">
          <div className="whitespace-pre-wrap text-sm sm:text-[1rem] leading-relaxed text-foreground">
            {text}
          </div>
          {attachments && attachments.length > 0 && (
            <div className="mt-2 sm:mt-3 flex flex-wrap gap-1.5 sm:gap-2">
              {attachments.map((att, idx) => (
                <div key={idx} className="relative h-20 w-20 sm:h-32 sm:w-32 overflow-hidden rounded-xl border border-border shadow-sm transition-transform hover:scale-105 cursor-pointer">
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
    <div className="flex animate-fade-in-up gap-2 sm:gap-4 mb-4 sm:mb-8">
      <span className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent/20 to-transparent border border-accent/20 text-accent shadow-sm mt-0.5 sm:mt-1">
        <Sparkles size={16} className="drop-shadow-sm" />
      </span>
      <div className="min-w-0 flex-1">
        <div
          ref={contentRef}
          className="msg-content min-w-0 flex-1 pt-1.5"
          dangerouslySetInnerHTML={{ __html: parseMarkdown(text) + (isStreaming ? '<span class="ml-1.5 inline-block h-4 w-2 animate-pulse bg-accent align-middle shadow-[0_0_8px_var(--accent)] rounded-full"></span>' : '') }}
        />
        
        {/* Read Aloud Button - Only for non-streaming AI messages */}
        {!isStreaming && (
          <button
            onClick={handleReadAloud}
            className="mt-2 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all hover:bg-surface-2 active:scale-95 border border-border/50 text-muted hover:text-foreground"
            title={isSpeaking ? 'Stop reading' : 'Read aloud'}
          >
            {isSpeaking ? (
              <>
                <VolumeX size={12} />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Volume2 size={12} />
                <span>Read Aloud</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
