'use client';
import { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { parseMarkdown } from '@/app/lib/utils/markdown';

interface MessageBubbleProps {
  sender: 'user' | 'ai';
  text: string;
  mode?: string;
  attachments?: { url: string; mimeType: string; name: string }[];
}

export default function MessageBubble({ sender, text, attachments }: MessageBubbleProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Wire up "Copy" buttons inside rendered code blocks.
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;

    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.code-copy'));
    const cleanups: Array<() => void> = [];

    buttons.forEach((btn) => {
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

    return () => cleanups.forEach((c) => c());
  }, [text]);

  if (sender === 'user') {
    return (
      <div className="flex animate-fade-in-up justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-surface-2 px-4 py-3">
          <div className="whitespace-pre-wrap text-[0.975rem] leading-relaxed text-foreground">
            {text}
          </div>
          {attachments && attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {attachments.map((att, idx) => (
                <div key={idx} className="h-20 w-20 overflow-hidden rounded-lg border border-border">
                  <img src={att.url} alt={att.name} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex animate-fade-in-up gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-accent">
        <Sparkles size={16} />
      </span>
      <div
        ref={contentRef}
        className="msg-content min-w-0 flex-1 pt-1"
        dangerouslySetInnerHTML={{ __html: parseMarkdown(text) }}
      />
    </div>
  );
}
