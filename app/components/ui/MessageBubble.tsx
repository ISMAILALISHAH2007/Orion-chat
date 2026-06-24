'use client';
import { useEffect, useRef } from 'react';
import { UltronAnimations } from '@/app/lib/animations';
import { parseMarkdown } from '@/app/lib/utils/markdown';

interface MessageBubbleProps {
  sender: 'user' | 'ai';
  text: string;
  mode?: string;
}

export default function MessageBubble({ sender, text, mode = 'casual' }: MessageBubbleProps) {
  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bubbleRef.current) {
      UltronAnimations.animateMessage(bubbleRef.current);
    }
  }, []);

  return (
    <div ref={bubbleRef} className={`message-bubble ${sender}`}>
      <span className="msg-sender-label">
        {sender === 'user' ? 'USER TRANSMISSION' : `ULTRON // ${(mode || 'casual').toUpperCase()}`}
      </span>
      <div
        className="msg-content"
        dangerouslySetInnerHTML={{ __html: parseMarkdown(text) }}
      />
    </div>
  );
}
