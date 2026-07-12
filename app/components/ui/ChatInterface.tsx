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
  Video,
  Volume2,
  VolumeX,
  Globe,
  LoaderCircle,
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
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [isMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  });
  const { messages, sendMessage, isStreaming, stop } = useChat();
  const { mode } = useMode();
  const { speak, liveVoiceMode, setLiveVoiceMode, isSpeaking, stopSpeaking, selectedVoiceUri, initAudioContext, aiVoiceEnabled, setAiVoiceEnabled } = useTTS();
  const { isRecording, startRecording, stopRecording, transcript, voiceError, setVoiceError } = useVoice({
    language: selectedVoiceUri,
    onSpeechEnd: (finalText) => {
      if (liveVoiceMode) {
        searchAttemptsRef.current = 0; // Reset search loop guard on user voice input
        sendMessage(finalText);
        setInput('');
      } else {
        setInput((prev) => (prev ? prev + ' ' + finalText : finalText));
      }
    }
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const slashRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevStreamingRef = useRef(false);
  const searchAttemptsRef = useRef(0);
  const { data: session } = useSession();
  const userName = session?.user?.name?.split(' ')[0] || 'there';

  const isEmpty = messages.length === 0;
  
  let placeholder = MODE_PLACEHOLDERS[mode] ?? MODE_PLACEHOLDERS.casual;
  if (isImageMode) placeholder = "Describe the image you want to create...";
  if (isVideoMode) placeholder = "Describe the AI video you want to generate...";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, searchStatus]);

  // Auto-grow the textarea.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [input]);

  const liveVoiceModeRef = useRef(liveVoiceMode);
  useEffect(() => { liveVoiceModeRef.current = liveVoiceMode; }, [liveVoiceMode]);

  // Handle Live Voice Mode TTS, mic auto-resume, and Web Search
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.sender === 'ai') {
        
        // 1. Check for web search command (with loop guard - max 2 attempts)
        const searchMatch = lastMessage.text.match(/\[SEARCH:\s*(?:"|')?([^"\]}]+)(?:"|')?\]/i);
        if (searchMatch) {
          searchAttemptsRef.current++;
          if (searchAttemptsRef.current > 2) {
            console.warn('Search loop detected, stopping further search attempts');
            setSearchStatus(null);
            sendMessage(`[SYSTEM SEARCH ERROR] Search service temporarily unavailable after multiple attempts. Please inform the user politely.`, undefined, { isHidden: true });
            prevStreamingRef.current = isStreaming;
            return;
          }
          
          const query = searchMatch[1];
          setSearchStatus(`🔍 Searching for "${query.length > 40 ? query.substring(0, 40) + '...' : query}"`);
          
          fetch(`/api/search?q=${encodeURIComponent(query)}`)
            .then(res => res.json())
            .then(data => {
              setSearchStatus(null);
              sendMessage(`[SYSTEM SEARCH RESULTS FOR "${query}"]\n${data.results}\n\nPlease provide your final answer to the user based on these results. Do NOT output any SEARCH or MAPS command. Use ONLY the results above. Answer completely and accurately.`, undefined, { isHidden: true });
            })
            .catch(e => {
              setSearchStatus(null);
              sendMessage(`[SYSTEM SEARCH ERROR] Failed to perform web search for "${query}". Do not try to search again. Please inform the user politely that web search is unavailable.`, undefined, { isHidden: true });
            });
          
          prevStreamingRef.current = isStreaming;
          return;
        }

        // 1.5 Check for maps command
        const mapsMatch = lastMessage.text.match(/\[MAPS:\s*(?:"|')?([^"\]}]+)(?:"|')?\]/i);
        if (mapsMatch) {
          searchAttemptsRef.current++;
          if (searchAttemptsRef.current > 2) {
            console.warn('Maps search loop detected, stopping further attempts');
            setSearchStatus(null);
            sendMessage(`[SYSTEM MAPS ERROR] Maps service temporarily unavailable. Please inform the user politely.`, undefined, { isHidden: true });
            prevStreamingRef.current = isStreaming;
            return;
          }
          
          const query = mapsMatch[1];
          setSearchStatus(`📍 Finding locations for "${query.length > 40 ? query.substring(0, 40) + '...' : query}"`);
          
          fetch(`/api/maps?q=${encodeURIComponent(query)}`)
            .then(res => res.json())
            .then(data => {
              setSearchStatus(null);
              sendMessage(`[SYSTEM MAPS RESULTS FOR "${query}"]\n${data.results}\n\nPlease provide your final answer to the user based on these location results. Do NOT output any SEARCH or MAPS command. Use ONLY the results above.`, undefined, { isHidden: true });
            })
            .catch(e => {
              setSearchStatus(null);
              sendMessage(`[SYSTEM MAPS ERROR] Failed to perform map search for "${query}". Do not try to search again. Please inform the user politely.`, undefined, { isHidden: true });
            });
          
          prevStreamingRef.current = isStreaming;
          return;
        }

        // 2. Auto-TTS for AI responses if AI voice is enabled
        if (aiVoiceEnabled && !liveVoiceMode) {
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
  }, [isStreaming, messages, aiVoiceEnabled, liveVoiceMode, speak, sendMessage]);

  // BULLETPROOF WATCHDOG: Guarantees the mic never gets permanently stuck off
  useEffect(() => {
    if (liveVoiceModeRef.current && !isRecording && !isStreaming && !isSpeaking) {
      if (input.trim().length > 0) return;
      
      const timer = setTimeout(() => {
        if (liveVoiceModeRef.current && !isRecording && !isStreaming && !isSpeaking) {
          startRecording();
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [liveVoiceMode, isRecording, isStreaming, isSpeaking, startRecording, input]);

  const slashQuery = input.startsWith('/') ? input.split(/\s+/)[0].slice(1).toLowerCase() : '';
  const filteredCommands = SLASH_COMMANDS.filter((c) =>
    slashQuery ? c.cmd.startsWith(slashQuery) : true
  );

  const effectiveSlashOpen = slashOpen && input.startsWith('/') && filteredCommands.length > 0;

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
    initAudioContext();
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
    initAudioContext();
    if ((!input.trim() && attachments.length === 0) || isStreaming) return;

    let finalInput = input;
    if (isImageMode && !finalInput.startsWith('/img')) {
      finalInput = `/img ${finalInput.trim()}`;
    } else if (isVideoMode && !finalInput.startsWith('/video')) {
      finalInput = `/video ${finalInput.trim()}`;
    }

    searchAttemptsRef.current = 0; // Reset search loop guard on user message
    sendMessage(finalInput, attachments);
    setInput('');
    setAttachments([]);
    setIsImageMode(false);
    setIsVideoMode(false);
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
        
        const img = new window.Image();
        const compressedUri = await new Promise<string>((resolve) => {
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            const MAX_DIMENSION = 800;
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
              resolve(dataUri);
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
      {/* AI Voice Toggle Button - Floating top-right (like Gemini) */}
      {!liveVoiceMode && (
        <button
          onClick={() => {
            initAudioContext();
            setAiVoiceEnabled(!aiVoiceEnabled);
          }}
          title={aiVoiceEnabled ? 'AI Voice is ON - reads responses aloud' : 'AI Voice is OFF - tap to enable'}
          className={[
            'fixed z-40 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-md border transition-all duration-300 hover:scale-105 active:scale-95',
            aiVoiceEnabled
              ? 'bg-accent text-accent-foreground border-accent/50 shadow-accent/20 animate-fade-in'
              : 'bg-surface/80 text-muted border-border hover:text-foreground',
            // Position: top-right on desktop, bottom-right on mobile
            'top-20 right-4 md:top-4',
          ].join(' ')}
          style={{ zIndex: 100 }}
        >
          {aiVoiceEnabled ? (
            <>
              <Volume2 size={14} className="animate-pulse" />
              <span className="hidden sm:inline">AI Voice On</span>
            </>
          ) : (
            <>
              <VolumeX size={14} />
              <span className="hidden sm:inline">AI Voice</span>
            </>
          )}
        </button>
      )}

      {/* Live Voice Overlay */}
      {liveVoiceMode && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-3xl animate-fade-in">
          <div className="live-voice-blob live-voice-blob-1" />
          <div className="live-voice-blob live-voice-blob-2" />
          <div className="live-voice-blob live-voice-blob-3" />
          
          <h2 className="mb-8 font-display text-3xl font-semibold text-foreground md:text-5xl">
            {isRecording ? "Listening..." : isStreaming ? "Thinking..." : isSpeaking ? "Speaking..." : "Listening..."}
          </h2>
          
          {isRecording ? (
            <div className="live-voice-wave mb-12">
              <div className="live-voice-bar" />
              <div className="live-voice-bar" />
              <div className="live-voice-bar" />
              <div className="live-voice-bar" />
              <div className="live-voice-bar" />
            </div>
          ) : isStreaming ? (
             <div className="mb-12 flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
                  <Sparkles size={20} className="text-accent animate-pulse" />
                </span>
                <span className="thinking-dots scale-150" aria-label="Assistant is thinking">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
             </div>
          ) : isSpeaking ? (
            <div className="flex flex-col items-center mb-12">
              <div className="live-voice-wave mb-6">
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
                className="rounded-full border border-border bg-surface px-6 py-2.5 font-semibold text-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 animate-fade-in"
              >
                Interrupt & Listen
              </button>
            </div>
          ) : (
            <div className="live-voice-wave mb-12 opacity-50">
              <div className="live-voice-bar" />
              <div className="live-voice-bar" />
              <div className="live-voice-bar" />
            </div>
          )}
          
          {isRecording && (
            <p className="max-w-lg text-center text-lg font-medium text-foreground/80 px-4">
              {transcript || "Speak now..."}
            </p>
          )}
          
          <button
            onClick={handleEndVoiceSession}
            className="absolute bottom-12 rounded-full bg-danger px-6 py-3 font-semibold text-white shadow-xl transition-transform hover:scale-105 active:scale-95"
          >
            End Voice Session
          </button>
        </div>
      )}

      {showCamera && (
        <CameraModal onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />
      )}

      {/* Web Search Analyzing Animation (like Gemini) */}
      {searchStatus && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/60 backdrop-blur-sm animate-fade-in pointer-events-none">
          <div className="flex flex-col items-center gap-4 animate-scale-in bg-surface/90 border border-border/50 rounded-2xl px-8 py-6 shadow-2xl pointer-events-auto">
            <div className="relative">
              <Globe size={40} className="text-accent animate-pulse" />
              <LoaderCircle size={20} className="absolute -bottom-1 -right-1 text-accent animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Analyzing the web</p>
              <p className="text-xs text-muted mt-1 max-w-[200px] truncate">{searchStatus}</p>
            </div>
            <div className="flex gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0s' }} />
              <span className="h-2 w-2 rounded-full bg-accent/70 animate-bounce" style={{ animationDelay: '0.15s' }} />
              <span className="h-2 w-2 rounded-full bg-accent/40 animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>
        </div>
      )}

      {/* Conversation window */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-start px-4 pb-10 pt-12 sm:justify-center sm:pt-10">
            <div className="flex flex-col items-center">
              <h1 className="gemini-gradient-text text-balance text-center font-display text-3xl font-bold sm:text-4xl md:text-5xl">
                Hello, {userName !== 'there' ? userName : 'Commander'}
              </h1>
              <p className="mt-2 text-center text-lg text-muted font-medium sm:text-xl">
                How can I help you today?
              </p>
            </div>
            <div className="mt-6 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
              {SUGGESTIONS.map(({ icon: Icon, title, prompt }) => (
                <button
                  key={title}
                  onClick={() => {
                    setInput(prompt);
                    textareaRef.current?.focus();
                  }}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-3 sm:p-4 text-left transition-all hover:border-accent hover:bg-surface-2"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-accent transition-colors group-hover:bg-background sm:h-9 sm:w-9">
                    <Icon size={16} />
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
          <div className="mx-auto w-full max-w-3xl space-y-6 px-3 py-6 sm:px-4 sm:space-y-8 sm:py-8">
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
                  <Sparkles size={16} className="text-accent animate-spin-slow" />
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
      <div className="px-3 pb-4 sm:px-4 sm:pb-6">
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

            <div className={[
              'flex flex-col gap-2 rounded-[28px] border p-2 shadow-sm transition-all glass-pill',
              isImageMode 
                ? 'border-[#a855f7] focus-within:border-[#a855f7]' 
                : isVideoMode
                ? 'border-[#3b82f6] focus-within:border-[#3b82f6]'
                : 'border-border focus-within:border-accent focus-within:shadow-md'
            ].join(' ')}>
              {isVideoMode && (
                <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-muted-foreground border-b border-border bg-surface-2/10 rounded-t-xl select-none">
                  <span className="flex items-center gap-1">🎥 AI Video Generation</span>
                  <span className="text-[10px] text-muted">Free · Hugging Face</span>
                </div>
              )}
              {/* Attachments Preview */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 px-2 pt-2">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="group relative h-14 w-14 sm:h-16 sm:w-16 overflow-hidden rounded-lg border border-border">
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
                  if (value.startsWith('/')) {
                    if (!slashOpen) setSlashIndex(0);
                    setSlashOpen(true);
                  } else if (slashOpen) {
                    setSlashOpen(false);
                  }
                }}
                onKeyDown={handleKeyDown}
                disabled={isStreaming}
                className="max-h-[150px] sm:max-h-[200px] w-full resize-none bg-transparent px-3 py-2 text-sm sm:text-base leading-relaxed text-foreground outline-none placeholder:text-muted disabled:opacity-60"
              />
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-0.5 sm:gap-1">
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
                    onClick={() => {
                      setIsImageMode(!isImageMode);
                      setIsVideoMode(false);
                    }}
                    aria-label="Toggle image generation mode"
                    className={[
                      'rounded-lg p-1.5 sm:p-2 transition-colors',
                      isImageMode
                        ? 'bg-[#a855f7]/10 text-[#a855f7]'
                        : 'text-muted hover:bg-surface-2 hover:text-foreground',
                    ].join(' ')}
                  >
                    <Wand2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsVideoMode(!isVideoMode);
                      setIsImageMode(false);
                    }}
                    aria-label="Toggle video generation mode"
                    className={[
                      'rounded-lg p-1.5 sm:p-2 transition-colors',
                      isVideoMode
                        ? 'bg-[#3b82f6]/10 text-[#3b82f6]'
                        : 'text-muted hover:bg-surface-2 hover:text-foreground',
                    ].join(' ')}
                  >
                    <Video size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach image"
                    className="rounded-lg p-1.5 sm:p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                  >
                    <Paperclip size={16} />
                  </button>
                  {/* Camera button: only show on mobile/phone */}
                  {isMobile && (
                    <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      aria-label="Take photo"
                      className="rounded-lg p-1.5 sm:p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                    >
                      <Camera size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleMicClick}
                    aria-label={liveVoiceMode ? 'Live voice active' : 'Start voice input'}
                    className={[
                      'relative rounded-lg p-1.5 sm:p-2 transition-colors',
                      liveVoiceMode
                        ? 'voice-active bg-[var(--danger)] text-white'
                        : 'text-muted hover:bg-surface-2 hover:text-foreground',
                    ].join(' ')}
                  >
                    {liveVoiceMode && <span className="pulse-ring" aria-hidden="true" />}
                    <Mic size={16} />
                  </button>
                </div>
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={stop}
                    aria-label="Stop generation"
                    className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-surface-2 text-foreground transition-all hover:bg-danger hover:text-white"
                  >
                    <div className="h-3 w-3 rounded-[2px] bg-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!input.trim() && attachments.length === 0}
                    aria-label="Send message"
                    className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-accent text-accent-foreground transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted"
                  >
                    <ArrowUp size={16} />
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
      {voiceError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl p-6 space-y-6 animate-scale-in">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
                <Mic size={24} />
              </span>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground">Microphone Access Required</h3>
                <p className="text-sm text-muted">We need microphone permissions to use live voice mode.</p>
              </div>
            </div>

            <div className="rounded-xl bg-surface-2 p-4 border border-border text-sm space-y-4">
              {voiceError.includes('Settings') ? (
                <div className="space-y-2 text-left">
                  <p className="font-semibold text-danger">How to enable Speech Recognition (iPhone/Safari):</p>
                  <ol className="list-decimal list-inside space-y-2 text-muted">
                    <li>Open your iPhone <strong>Settings</strong> app.</li>
                    <li>Go to <strong>Privacy & Security</strong> &gt; <strong>Speech Recognition</strong>.</li>
                    <li>Toggle the switch for <strong>Safari</strong> (or your browser) to <strong>ON</strong>.</li>
                    <li>Make sure <strong>Siri & Dictation</strong> is enabled under Settings &gt; Siri.</li>
                    <li>Reload this page and tap the Mic again.</li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-2 text-left">
                  <p className="font-semibold text-danger">How to allow Microphone Access:</p>
                  <ol className="list-decimal list-inside space-y-2 text-muted">
                    <li>Tap the <strong>settings, lock, or &quot;AA&quot; icon</strong> in your browser&apos;s address bar.</li>
                    <li>Locate <strong>Microphone</strong> or <strong>Website Settings</strong>.</li>
                    <li>Change permission setting from Blocked to <strong>Allow</strong>.</li>
                    <li>Reload the page and tap the Mic again.</li>
                  </ol>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setVoiceError(null)}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground shadow hover:bg-accent-hover active:scale-95 transition-all"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
