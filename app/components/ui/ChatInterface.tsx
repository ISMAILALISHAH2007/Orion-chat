'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import {
  Paperclip,
  Mic,
  ArrowUp,
  PenLine,
  Dumbbell,
  BarChart3,
  Code2,
  Sparkles,
  Image as ImageIcon,
  Paintbrush,
  HelpCircle,
  Camera,
  X,
  Wand2,
} from 'lucide-react';
import { useChat, type ChatAttachment } from '@/app/components/providers/ChatProvider';
import CameraModal from './CameraModal';
import { useMode } from '@/app/components/providers/ThemeProvider';
import { useVoice } from '@/app/components/hooks/useVoice';
import MessageBubble from './MessageBubble';

import { useTTS } from '@/app/components/providers/TTSProvider';

const SUGGESTIONS = [
  { icon: PenLine, title: 'Help me write', prompt: 'Help me write a professional email to reschedule a meeting.' },
  { icon: Dumbbell, title: 'Create a workout plan', prompt: 'Create a 4-day workout plan for building strength at home.' },
  { icon: BarChart3, title: 'Analyze a dataset', prompt: 'How should I approach analyzing a sales dataset to find trends?' },
  { icon: Code2, title: 'Explain some code', prompt: 'Explain how async/await works in JavaScript with an example.' },
];

const MODE_PLACEHOLDERS: Record<string, string> = {
  casual: "Chat naturally, I'm here for you.",
  developer: 'Write code, debug, or architect systems.',
  research: 'Dive deep into research, analyse data.',
  professional: 'Executive insights, concise and data-driven.',
};

const SLASH_COMMANDS = [
  { cmd: 'img', label: 'Generate image', desc: 'Render a free pollinations.ai image from a prompt.', icon: ImageIcon },
  { cmd: 'code', label: 'Code expert', desc: 'Switch into terse code-expert mode with fenced blocks.', icon: Code2 },
  { cmd: 'design', label: 'Design concept', desc: 'Senior product-designer UI/UX response.', icon: Paintbrush },
  { cmd: 'help', label: 'Show help', desc: 'List slash commands and modes.', icon: HelpCircle },
];

export default function ChatInterface() {
  const [input, setInput] = useState('');
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [isImageMode, setIsImageMode] = useState(false);
  const { messages, sendMessage, isStreaming, stop } = useChat();
  const { mode } = useMode();
  const { speak, liveVoiceMode, setLiveVoiceMode, isSpeaking, stopSpeaking } = useTTS();
  const { isRecording, startRecording, stopRecording, transcript } = useVoice({
    onSpeechEnd: (finalText) => {
      if (liveVoiceMode) {
        sendMessage(finalText);
        setInput('');
      }
    }
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const slashRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevStreamingRef = useRef(false);
  const { data: session } = useSession();
  const userName = session?.user?.name?.split(' ')[0] || 'there';

  const isEmpty = messages.length === 0;
  
  let placeholder = MODE_PLACEHOLDERS[mode] ?? MODE_PLACEHOLDERS.casual;
  if (isImageMode) placeholder = "Describe the image you want to create...";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing external speech-recognition state into the controlled input
    if (transcript) setInput((prev) => (prev ? prev + ' ' + transcript : transcript));
  }, [transcript]);

  // Auto-grow the textarea.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [input]);

  const liveVoiceModeRef = useRef(liveVoiceMode);
  useEffect(() => { liveVoiceModeRef.current = liveVoiceMode; }, [liveVoiceMode]);

  // Handle Live Voice Mode TTS, mic auto-resume, and Web Search Loop
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming) {
      // Streaming just finished
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.sender === 'ai') {
        
        // 1. Check for web search command
        const searchMatch = lastMessage.text.match(/\[SEARCH:\s*(?:"|')?([^"\]]+)(?:"|')?\]/i);
        if (searchMatch) {
          const query = searchMatch[1];
          // Fetch search results
          fetch(`/api/search?q=${encodeURIComponent(query)}`)
            .then(res => res.json())
            .then(data => {
              sendMessage(`[SYSTEM SEARCH RESULTS FOR "${query}"]\n${data.results}\n\nPlease provide your final answer to the user based on these results. Do not output another SEARCH command.`, undefined, { isHidden: true });
            })
            .catch(e => {
              sendMessage(`[SYSTEM SEARCH ERROR] Failed to perform web search for "${query}". Please inform the user.`, undefined, { isHidden: true });
            });
          
          prevStreamingRef.current = isStreaming;
          return; // Skip TTS for the search command itself
        }

        // 1.5 Check for maps command
        const mapsMatch = lastMessage.text.match(/\[MAPS:\s*(?:"|')?([^"\]]+)(?:"|')?\]/i);
        if (mapsMatch) {
          const query = mapsMatch[1];
          fetch(`/api/maps?q=${encodeURIComponent(query)}`)
            .then(res => res.json())
            .then(data => {
              sendMessage(`[SYSTEM MAPS RESULTS FOR "${query}"]\n${data.results}\n\nPlease provide your final answer to the user based on these location results. Do not output another MAPS command.`, undefined, { isHidden: true });
            })
            .catch(e => {
              sendMessage(`[SYSTEM MAPS ERROR] Failed to perform map search for "${query}". Please inform the user.`, undefined, { isHidden: true });
            });
          
          prevStreamingRef.current = isStreaming;
          return; // Skip TTS for the maps command itself
        }

        // 2. TTS Voice
        if (liveVoiceMode) {
          let voiceOverride = undefined;
          const voiceMatch = lastMessage.text.match(/\[VOICE:\s*([^\]]+)\]/i);
          if (voiceMatch) {
            voiceOverride = voiceMatch[1];
          }

          speak(lastMessage.text, voiceOverride);
        }
      }
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming, messages, liveVoiceMode, speak, sendMessage]);

  // BULLETPROOF WATCHDOG: Guarantees the mic never gets permanently stuck off
  useEffect(() => {
    if (liveVoiceModeRef.current && !isRecording && !isStreaming && !isSpeaking) {
      // Don't auto-start if there's pending input that hasn't been sent yet
      if (input.trim().length > 0) return;
      
      const timer = setTimeout(() => {
        if (liveVoiceModeRef.current && !isRecording && !isStreaming && !isSpeaking) {
          startRecording();
        }
      }, 800); // slightly longer delay to ensure states settle
      return () => clearTimeout(timer);
    }
  }, [liveVoiceMode, isRecording, isStreaming, isSpeaking, startRecording, input]);

  // Slash-command popover — derived from input + manually controlled open state.
  const slashQuery = input.startsWith('/') ? input.split(/\s+/)[0].slice(1).toLowerCase() : '';
  const filteredCommands = SLASH_COMMANDS.filter((c) =>
    slashQuery ? c.cmd.startsWith(slashQuery) : true
  );

  // Derive slash-open from input unless the user has manually dismissed it.
  const effectiveSlashOpen = slashOpen && input.startsWith('/') && filteredCommands.length > 0;

  // Detect image intent in developer mode for an inline preview notice.
  const noticeText = (() => {
    const imageIntent = mode === 'developer' && /(draw|generate|render|create).*(image|picture|illustration|photo|logo|icon)/i.test(input);
    if (imageIntent && input.trim()) {
      return 'Detected image intent — Developer mode will auto-route to image generation.';
    }
    if (input.startsWith('/img ')) {
      return 'Slash command /img — image generation.';
    }
    return null;
  })();

  // Click-outside dismissal for slash popover.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (slashRef.current && !slashRef.current.contains(e.target as Node)) {
        setSlashOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const applyCommand = (cmd: string) => {
    setInput(`/${cmd} `);
    setSlashOpen(false);
    textareaRef.current?.focus();
  };

  const handleMicClick = () => {
    setLiveVoiceMode(true);
    if (!isRecording) {
      startRecording();
    }
  };

  const handleEndVoiceSession = () => {
    setLiveVoiceMode(false);
    if (isRecording) stopRecording();
    if (isSpeaking) stopSpeaking();
  };

  const handleSend = () => {
    if ((!input.trim() && attachments.length === 0) || isStreaming) return;

    let finalInput = input;
    if (isImageMode && !finalInput.startsWith('/img')) {
      finalInput = `/img ${finalInput.trim()}`;
    }

    sendMessage(finalInput, attachments);
    setInput('');
    setAttachments([]);
    setIsImageMode(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (effectiveSlashOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (filteredCommands[slashIndex]) {
          e.preventDefault();
          applyCommand(filteredCommands[slashIndex].cmd);
          return;
        }
      }
      if (e.key === 'Escape') {
        setSlashOpen(false);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newAttachments: ChatAttachment[] = [];
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        const dataUri = await new Promise<string>((resolve) => {
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsDataURL(file);
        });
        
        // Compress image to prevent crashing vision models
        const img = new window.Image();
        const compressedUri = await new Promise<string>((resolve) => {
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            const MAX_DIMENSION = 800; // safe max dimension for base64 payloads
            if (width > height && width > MAX_DIMENSION) {
              height *= MAX_DIMENSION / width;
              width = MAX_DIMENSION;
            } else if (height > MAX_DIMENSION) {
              width *= MAX_DIMENSION / height;
              height = MAX_DIMENSION;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', 0.8));
            } else {
              resolve(dataUri); // fallback
            }
          };
          img.src = dataUri;
        });

        newAttachments.push({ url: compressedUri, mimeType: 'image/jpeg', name: file.name });
      } else {
        setNotice('Currently, only images are supported for analysis.');
        window.setTimeout(() => setNotice(null), 3000);
      }
    }
    setAttachments((prev) => [...prev, ...newAttachments]);
    // Reset inputs
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCameraCapture = (dataUri: string) => {
    setAttachments((prev) => [...prev, { url: dataUri, mimeType: 'image/jpeg', name: `camera-${Date.now()}.jpg` }]);
    setShowCamera(false);
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const lastMessage = messages[messages.length - 1];
  const showThinking = isStreaming && (!lastMessage || lastMessage.sender === 'user');

  return (
    <section className="relative flex min-h-0 flex-1 flex-col bg-background/50">
      {/* Live Voice Overlay */}
      {liveVoiceMode && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-3xl animate-fade-in">
          <div className="live-voice-blob live-voice-blob-1" />
          <div className="live-voice-blob live-voice-blob-2" />
          <div className="live-voice-blob live-voice-blob-3" />
          
          <h2 className="mb-12 font-display text-4xl font-semibold text-foreground md:text-6xl">
            {isRecording ? "Listening..." : isStreaming ? "Thinking..." : isSpeaking ? "Speaking..." : "Listening..."}
          </h2>
          
          {isRecording ? (
            <div className="live-voice-wave mb-16">
              <div className="live-voice-bar" />
              <div className="live-voice-bar" />
              <div className="live-voice-bar" />
              <div className="live-voice-bar" />
              <div className="live-voice-bar" />
            </div>
          ) : isStreaming ? (
             <div className="mb-16 flex gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
                  <Sparkles size={24} className="text-accent animate-pulse" />
                </span>
                <span className="thinking-dots scale-150" aria-label="Assistant is thinking">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
             </div>
          ) : isSpeaking ? (
            <div className="flex flex-col items-center mb-16">
              <div className="live-voice-wave mb-8">
                <div className="live-voice-bar !animate-bounce" />
                <div className="live-voice-bar !animate-pulse" />
                <div className="live-voice-bar !animate-bounce" style={{ animationDelay: '0.2s' }} />
                <div className="live-voice-bar !animate-pulse" />
                <div className="live-voice-bar !animate-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
              <button 
                onClick={() => {
                  stopSpeaking();
                  stop();
                }}
                className="rounded-full border border-border bg-surface px-8 py-3 font-semibold text-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 animate-fade-in"
              >
                Interrupt & Listen
              </button>
            </div>
          ) : (
            <div className="live-voice-wave mb-16 opacity-50">
              <div className="live-voice-bar" />
              <div className="live-voice-bar" />
              <div className="live-voice-bar" />
            </div>
          )}
          
          {isRecording && (
            <p className="max-w-xl text-center text-xl font-medium text-foreground/80">
              {transcript || "Speak now..."}
            </p>
          )}
          
          <button
            onClick={handleEndVoiceSession}
            className="absolute bottom-12 rounded-full bg-danger px-8 py-4 font-semibold text-white shadow-xl transition-transform hover:scale-105 active:scale-95"
          >
            End Voice Session
          </button>
        </div>
      )}

      {showCamera && (
        <CameraModal onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />
      )}
      {/* Conversation window */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-start px-4 pb-10 pt-12 sm:justify-center sm:pt-10">
            <div className="flex flex-col items-center">
              <h1 className="gemini-gradient-text text-balance text-center font-display text-4xl font-bold sm:text-5xl">
                Hello, {userName !== 'there' ? userName : 'Commander'}
              </h1>
              <p className="mt-3 text-center text-xl text-muted font-medium">
                How can I help you today?
              </p>
            </div>
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
            {messages.filter(m => !m.isHidden).map((msg, idx, arr) => (
              <MessageBubble 
                key={idx} 
                sender={msg.sender} 
                text={msg.text} 
                mode={msg.mode} 
                attachments={msg.attachments} 
                isStreaming={isStreaming && idx === arr.length - 1 && msg.sender === 'ai'}
              />
            ))}
            {showThinking && (
              <div className="flex animate-fade-in items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
                  <Sparkles size={16} className="text-accent" />
                </span>
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
          {(noticeText ?? notice) && (
            <div className="mb-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent animate-fade-in">
              {noticeText ?? notice}
            </div>
          )}

          <div ref={slashRef} className="relative">
            {effectiveSlashOpen && (
              <div
                role="listbox"
                className="absolute bottom-full left-0 right-0 z-40 mb-2 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-lg animate-fade-in"
              >
                {filteredCommands.map((c, i) => {
                  const Icon = c.icon;
                  const active = i === slashIndex;
                  return (
                    <button
                      key={c.cmd}
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setSlashIndex(i)}
                      onClick={() => applyCommand(c.cmd)}
                      className={[
                        'flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                        active ? 'bg-surface-2' : 'hover:bg-surface-2',
                      ].join(' ')}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-accent">
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">/{c.cmd}</span>
                        <span className="block text-xs text-muted">{c.desc}</span>
                      </span>
                    </button>
                  );
                })}
                <div className="border-t border-border px-3 py-1.5 text-[11px] text-muted">
                  ↑↓ navigate · Enter/Tab select · Esc dismiss
                </div>
              </div>
            )}

            <div className={['flex flex-col gap-2 rounded-[28px] border p-2 shadow-sm transition-all glass-pill', isImageMode ? 'border-[#a855f7] focus-within:border-[#a855f7]' : 'border-border focus-within:border-accent focus-within:shadow-md'].join(' ')}>
              {/* Attachments Preview */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 px-2 pt-2">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-border">
                      <Image src={att.url} alt={att.name} fill className="object-cover" unoptimized />
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <textarea
                ref={textareaRef}
                value={input}
                rows={1}
                placeholder={placeholder}
                onChange={(e) => {
                  const value = e.target.value;
                  setInput(value);
                  // Sync slash-popover open state with the input.
                  if (value.startsWith('/')) {
                    if (!slashOpen) setSlashIndex(0);
                    setSlashOpen(true);
                  } else if (slashOpen) {
                    setSlashOpen(false);
                  }
                }}
                onKeyDown={handleKeyDown}
                disabled={isStreaming}
                className="max-h-[200px] w-full resize-none bg-transparent px-3 py-2 text-base leading-relaxed text-foreground outline-none placeholder:text-muted disabled:opacity-60"
              />
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setIsImageMode(!isImageMode)}
                    aria-label="Toggle image generation mode"
                    className={[
                      'rounded-lg p-2 transition-colors',
                      isImageMode
                        ? 'bg-[#a855f7]/10 text-[#a855f7]'
                        : 'text-muted hover:bg-surface-2 hover:text-foreground',
                    ].join(' ')}
                  >
                    <Wand2 size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach image"
                    className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                  >
                    <Paperclip size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCamera(true)}
                    aria-label="Take photo"
                    className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                  >
                    <Camera size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={handleMicClick}
                    aria-label={liveVoiceMode ? 'Live voice active' : 'Start voice input'}
                    className={[
                      'relative rounded-lg p-2 transition-colors',
                      liveVoiceMode
                        ? 'voice-active bg-[var(--danger)] text-white'
                        : 'text-muted hover:bg-surface-2 hover:text-foreground',
                    ].join(' ')}
                  >
                    {liveVoiceMode && <span className="pulse-ring" aria-hidden="true" />}
                    <Mic size={18} />
                  </button>
                </div>
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={stop}
                    aria-label="Stop generation"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-foreground transition-all hover:bg-danger hover:text-white"
                  >
                    <div className="h-3.5 w-3.5 rounded-[2px] bg-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!input.trim() && attachments.length === 0}
                    aria-label="Send message"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted"
                  >
                    <ArrowUp size={18} />
                  </button>
                )}
              </div>
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