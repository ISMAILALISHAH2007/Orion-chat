'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { 
  Sparkles, 
  Volume2, 
  VolumeX, 
  ChevronDown, 
  BrainCircuit,
  Copy,
  Check,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Edit2
} from 'lucide-react';
import { parseMarkdown } from '@/app/lib/utils/markdown';
import { generatePreviewHtml } from '@/app/lib/utils/preview';
import { useTTS } from '@/app/components/providers/TTSProvider';
import { useChat } from '@/app/components/providers/ChatProvider';

interface MessageBubbleProps {
  index: number;
  sender: 'user' | 'ai';
  text: string;
  mode?: string;
  attachments?: { url: string; mimeType: string; name: string }[];
  isStreaming?: boolean;
  onPreviewCode?: (code: string, lang: string) => void;
}

function parseReasoning(text: string): { mainText: string; reasoningText: string } | null {
  const match = text.match(/\[REASONING\]([\s\S]*?)\[\/REASONING\]/);
  if (!match) return null;
  const reasoningText = match[1].trim();
  const mainText = text.replace(/\[REASONING\][\s\S]*?\[\/REASONING\]/, '').trim();
  return { mainText, reasoningText };
}

export default function MessageBubble({ 
  index,
  sender, 
  text, 
  attachments, 
  isStreaming, 
  onPreviewCode 
}: MessageBubbleProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const { speak, stopSpeaking, isSpeaking, initAudioContext } = useTTS();
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const { sessionId, regenerate, editAndResend } = useChat();
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  // Overrides & Feedback states
  const [localTextOverride, setLocalTextOverride] = useState<string | null>(null);
  const mediaGeneratingRef = useRef(false);
  
  // Copying & Feedback toggles
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  // User editing states
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(text);

  const rawText = localTextOverride ?? text;
  const reasoning = parseReasoning(rawText);
  const displayText = reasoning ? reasoning.mainText : rawText;
  const reasoningText = reasoning?.reasoningText;

  // Background Media Generation Trigger
  useEffect(() => {
    if (sender === 'user' || isStreaming) return;

    const videoGenMatch = displayText.match(/\[GENERATING_VIDEO:\s*(.*?)\]/);
    const imageGenMatch = displayText.match(/\[GENERATING_IMAGE:\s*(.*?)\]/);

    if ((videoGenMatch || imageGenMatch) && !mediaGeneratingRef.current) {
      mediaGeneratingRef.current = true;
      const type = videoGenMatch ? 'video' : 'image';
      const prompt = videoGenMatch ? videoGenMatch[1] : (imageGenMatch ? imageGenMatch[1] : '');
      const tagToReplace = videoGenMatch ? videoGenMatch[0] : (imageGenMatch ? imageGenMatch[0] : '');

      const pollJob = async (jobId: string) => {
        try {
          const res = await fetch(`/api/media/generate?jobId=${jobId}&prompt=${encodeURIComponent(prompt)}&sessionId=${encodeURIComponent(sessionId || '')}`);
          const data = await res.json();
          if (data.status === 'processing') {
            setTimeout(() => pollJob(jobId), 4000);
          } else if (data.url) {
            const newTag = `[VIDEO: ${data.url}]`;
            setLocalTextOverride(displayText.replace(tagToReplace, newTag));
            if (Notification.permission === 'granted') {
              new Notification("Orion", { body: `Your video is ready!` });
            }
            try {
              const audio = new Audio('/sounds/notify.mp3');
              audio.volume = 0.5;
              audio.play().catch(() => {});
            } catch (e) {}
          } else {
            setLocalTextOverride(displayText.replace(tagToReplace, `⚠️ **Failed to generate video**: ${data.error || 'Unknown error'}`));
          }
        } catch (e) {
          setTimeout(() => pollJob(jobId), 4000);
        }
      };

      fetch('/api/media/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, type, sessionId: sessionId || 'current' })
      })
        .then(res => res.json())
        .then(data => {
          if (data.jobId) {
            pollJob(data.jobId);
          } else if (data.url) {
            const newTag = type === 'video' ? `[VIDEO: ${data.url}]` : `[IMAGE: ${data.url}]`;
            setLocalTextOverride(displayText.replace(tagToReplace, newTag));
            if (Notification.permission === 'granted') {
              new Notification("Orion", { body: `Your ${type} is ready!` });
            }
            try {
              const audio = new Audio('/sounds/notify.mp3');
              audio.volume = 0.5;
              audio.play().catch(() => {});
            } catch (e) {}
          } else {
            setLocalTextOverride(displayText.replace(tagToReplace, `⚠️ **Failed to generate ${type}**: ${data.error}`));
          }
        })
        .catch(err => {
          setLocalTextOverride(displayText.replace(tagToReplace, `⚠️ **Failed to generate ${type}**: Network error`));
        });
    }
  }, [displayText, isStreaming, sender, sessionId]);

  const handleDownloadImage = async (urlToDownload?: string) => {
    const targetUrl = typeof urlToDownload === 'string' ? urlToDownload : fullScreenImage;
    if (!targetUrl) return;
    try {
      const response = await fetch(`/api/download?url=${encodeURIComponent(targetUrl)}`);
      const blob = await response.blob();
      
      const img = new window.Image();
      const objectUrl = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.drawImage(img, 0, 0);
        const fontSize = Math.max(20, Math.floor(img.width * 0.03));
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.textAlign = 'right';
        ctx.fillText('⚡ ORION AI', img.width - 20, img.height - 24);
        
        canvas.toBlob((watermarkedBlob) => {
          if (!watermarkedBlob) return;
          const downloadUrl = URL.createObjectURL(watermarkedBlob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = 'orion-generation.jpg';
          a.click();
          URL.revokeObjectURL(downloadUrl);
          URL.revokeObjectURL(objectUrl);
        }, 'image/jpeg', 0.95);
      };
      img.src = objectUrl;
    } catch (e) {
      console.error('Failed to download image:', e);
      window.open(targetUrl, '_blank');
    }
  };

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
        if (onPreviewCode) {
          onPreviewCode(decoded, lang);
        } else {
          const win = window.open('', '_blank', 'width=900,height=700');
          if (!win) return;
          win.document.write(generatePreviewHtml(decoded, lang));
          win.document.close();
        }
      };
      btn.addEventListener('click', onClick);
      cleanups.push(() => btn.removeEventListener('click', onClick));
    });

    const imageElements = Array.from(root.querySelectorAll<HTMLImageElement>('.generated-image'));
    imageElements.forEach((img) => {
      img.style.cursor = 'pointer';
      img.title = 'Click to expand';
      const onClick = () => setFullScreenImage(img.src);
      img.addEventListener('click', onClick);
      cleanups.push(() => img.removeEventListener('click', onClick));
    });

    const downloadBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('.watermark-download-btn'));
    downloadBtns.forEach((btn) => {
      const onClick = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
        const url = btn.getAttribute('data-url');
        if (url) {
          const originalHtml = btn.innerHTML;
          btn.innerHTML = '<span class="animate-pulse">...</span>';
          handleDownloadImage(url).finally(() => {
             btn.innerHTML = originalHtml;
          });
        }
      };
      btn.addEventListener('click', onClick);
      cleanups.push(() => btn.removeEventListener('click', onClick));
    });

    return () => cleanups.forEach((c) => c());
  }, [displayText, fullScreenImage, onPreviewCode, isStreaming]);

  const handleReadAloud = () => {
    initAudioContext();
    if (isSpeaking) stopSpeaking();
    else speak(displayText);
  };

  const handleCopyText = () => {
    navigator.clipboard?.writeText(displayText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleEditResend = () => {
    if (!editValue.trim() || editValue.trim() === text) {
      setIsEditing(false);
      return;
    }
    editAndResend(index, editValue.trim());
    setIsEditing(false);
  };

  if (sender === 'user') {
    return (
      <div className="gemini-msg-user group relative">
        {isEditing ? (
          <div className="w-full max-w-2xl ml-auto bg-surface-2 border border-border/80 rounded-2xl p-3 flex flex-col gap-2">
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full bg-transparent resize-y outline-none text-sm text-foreground pr-2"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 border border-border rounded-xl text-muted hover:text-foreground hover:bg-surface-3 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleEditResend}
                className="px-3 py-1.5 bg-accent text-accent-foreground font-semibold rounded-xl hover:opacity-90 transition"
              >
                Send
              </button>
            </div>
          </div>
        ) : (
          <div className="relative max-w-[85%] sm:max-w-[75%] w-fit min-w-[30px] flex-shrink-0">
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
            
            {/* Inline editing button on hover */}
            <button
              onClick={() => {
                setEditValue(text);
                setIsEditing(true);
              }}
              title="Edit & Resend"
              className="absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 rounded-full border border-border bg-surface-1 text-muted opacity-0 group-hover:opacity-100 hover:text-foreground hover:scale-105 active:scale-95 transition-all shadow-sm"
            >
              <Edit2 size={11} />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="gemini-msg-ai relative group">
      <span className="gemini-msg-avatar flex items-center justify-center">
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

        {/* AI Message Actions Bar */}
        {!isStreaming && (
          <div className="flex items-center gap-1.5 mt-3 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">
            {/* Copy button */}
            <button
              onClick={handleCopyText}
              title="Copy response"
              className="p-2 border border-border/50 rounded-full hover:bg-surface-2 transition hover:text-foreground text-muted"
            >
              {copied ? <Check size={12} className="text-accent" /> : <Copy size={12} />}
            </button>

            {/* Read aloud button */}
            <button
              onClick={handleReadAloud}
              title={isSpeaking ? 'Stop speaking' : 'Read aloud'}
              className="p-2 border border-border/50 rounded-full hover:bg-surface-2 transition hover:text-foreground text-muted"
            >
              {isSpeaking ? <VolumeX size={12} className="text-accent animate-pulse" /> : <Volume2 size={12} />}
            </button>

            {/* Regenerate button */}
            <button
              onClick={() => regenerate(index)}
              title="Regenerate answer"
              className="p-2 border border-border/50 rounded-full hover:bg-surface-2 transition hover:text-foreground text-muted"
            >
              <RefreshCw size={12} />
            </button>

            <span className="h-4 w-px bg-border/80 mx-1" />

            {/* Thumbs up */}
            <button
              onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
              title="Good response"
              className={[
                'p-2 border border-border/50 rounded-full hover:bg-surface-2 transition-all',
                feedback === 'up' ? 'text-accent border-accent/40 bg-accent/5' : 'text-muted hover:text-foreground'
              ].join(' ')}
            >
              <ThumbsUp size={12} className={feedback === 'up' ? 'fill-accent' : ''} />
            </button>

            {/* Thumbs down */}
            <button
              onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
              title="Bad response"
              className={[
                'p-2 border border-border/50 rounded-full hover:bg-surface-2 transition-all',
                feedback === 'down' ? 'text-danger border-danger/40 bg-danger/5' : 'text-muted hover:text-foreground'
              ].join(' ')}
            >
              <ThumbsDown size={12} className={feedback === 'down' ? 'fill-danger' : ''} />
            </button>
          </div>
        )}
      </div>
      
      {fullScreenImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 sm:p-8 cursor-zoom-out" onClick={() => setFullScreenImage(null)}>
          <img src={fullScreenImage} className="max-h-full max-w-full rounded-xl object-contain shadow-2xl cursor-default" onClick={(e) => e.stopPropagation()} />
          <button className="absolute top-4 sm:top-8 right-4 sm:right-8 text-white hover:text-accent bg-black/50 p-2 sm:p-3 rounded-full transition" onClick={() => setFullScreenImage(null)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleDownloadImage(); }} className="absolute bottom-6 sm:bottom-10 right-6 sm:right-10 bg-accent text-black font-bold px-6 py-3 rounded-full hover:bg-accent/90 hover:scale-105 active:scale-95 transition shadow-[0_0_20px_rgba(var(--accent),0.3)] flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Download
          </button>
        </div>
      )}
    </div>
  );
}
