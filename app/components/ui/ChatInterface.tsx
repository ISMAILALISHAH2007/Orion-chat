'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import {
  Paperclip,
  Mic,
  MicOff,
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
  FileText,
  File,
  FileSpreadsheet,
  FileArchive,
  File as FileIcon,
  Globe,
  Headphones,
} from 'lucide-react';
import { useChat, type ChatAttachment } from '@/app/components/providers/ChatProvider';
import CameraModal from './CameraModal';
import VoiceConversationModal from './VoiceConversationModal';
import { useMode } from '@/app/components/providers/ThemeProvider';
import { useVoice } from '@/app/components/hooks/useVoice';
import { useTTS } from '@/app/components/providers/TTSProvider';
import MessageBubble from './MessageBubble';
import JSZip from 'jszip';
import { IMAGE_INTENT_REGEX } from '@/app/lib/validation';

const SUGGESTIONS = [
  { icon: PenLine, title: 'Help me write', prompt: 'Help me write a professional email to reschedule a meeting.' },
  { icon: Dumbbell, title: 'Create a workout plan', prompt: 'Create a 4-day workout plan for building strength at home.' },
  { icon: BarChart3, title: 'Analyze a dataset', prompt: 'How should I approach analyzing a sales dataset to find trends?' },
  { icon: Code2, title: 'Explain some code', prompt: 'Explain how async/await works in JavaScript with an example.' },
];

const MODE_PLACEHOLDERS: Record<string, string> = {
  casual: "Ask me anything...",
  developer: "Write code, debug, or architect systems...",
  research: "Dive deep into research, analyse data...",
  professional: "Executive insights, concise and data-driven...",
};

const SLASH_COMMANDS = [
  { cmd: 'img', label: 'Generate image', desc: 'Render a free image from a description.', icon: ImageIcon },
  { cmd: 'code', label: 'Code expert', desc: 'Switch into terse code-expert mode.', icon: Code2 },
  { cmd: 'design', label: 'Design concept', desc: 'Senior product-designer UI/UX response.', icon: Paintbrush },
  { cmd: 'help', label: 'Show help', desc: 'List all slash commands and modes.', icon: HelpCircle },
];

// --- File type icon + color ---
function getFileIcon(mimeType: string, name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (mimeType.startsWith('image/')) return { Icon: ImageIcon, color: '#a855f7' };
  if (mimeType.includes('pdf') || ext === 'pdf') return { Icon: FileText, color: '#ef4444' };
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || ext === 'xlsx' || ext === 'xls' || ext === 'csv') return { Icon: FileSpreadsheet, color: '#22c55e' };
  if (mimeType.includes('zip') || mimeType.includes('rar') || ext === 'zip' || ext === 'rar') return { Icon: FileArchive, color: '#f59e0b' };
  if (mimeType.includes('text') || ext === 'txt' || ext === 'md') return { Icon: FileText, color: '#6366f1' };
  if (mimeType.includes('document') || mimeType.includes('word') || ext === 'doc' || ext === 'docx') return { Icon: FileText, color: '#3b82f6' };
  return { Icon: FileIcon, color: '#6b7280' };
}

const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.zip,.rar,.json,.xml,.html,.css,.js,.ts,.tsx,.py,.java,.cpp,.hpp,.go,.rb,.php,.png,.jpg,.jpeg,.gif,.webp,.svg,.ico,.bmp';

function isSearchQuery(query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  
  // ONLY trigger web search for highly dynamic, local, or specific lookup requests.
  // General knowledge questions ("who is", "what is") will be answered by the AI directly.
  const strictLookupRegex = /(contact|hospital|phone number|address|near me|location|news|weather|stock|price of|restaurant|store|clinic|directions|latest update)/i;
  
  return strictLookupRegex.test(trimmed);
}

function ThinkingAnimation({ isSearch }: { isSearch?: boolean }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (isSearch) return; // Keep it static on "Searching" if search is active
    const timer = setInterval(() => setStage((prev) => (prev + 1) % 3), 800);
    return () => clearInterval(timer);
  }, [isSearch]);
  
  const stages = ['Analyzing...', 'Thinking...', 'Answering...'];
  const text = isSearch ? 'Searching the live web...' : stages[stage];

  return (
    <div className="flex items-center gap-3 mt-4 mb-2 p-3 bg-surface border border-border/50 rounded-2xl w-max shadow-sm animate-in fade-in slide-in-from-bottom-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 via-purple-500/20 to-accent/20 animate-spin-slow" />
        {isSearch ? <Globe size={16} className="text-accent relative z-10 animate-pulse" /> : <Sparkles size={16} className="text-accent relative z-10" />}
      </span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium bg-gradient-to-r from-blue-500 via-purple-500 to-accent bg-clip-text text-transparent animate-pulse">
          {text}
        </span>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

export default function ChatInterface() {
  const [input, setInput] = useState('');
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [isImageMode, setIsImageMode] = useState(false);
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [isMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  });
  const { messages, sendMessage, isStreaming, isResearching, stop } = useChat();
  const { mode } = useMode();
  const { liveVoiceMode, setLiveVoiceMode, speak, aiVoiceEnabled, initAudioContext, voiceConversationOpen, setVoiceConversationOpen, voiceGender, setVoiceGender } = useTTS();
  const { isRecording, startRecording, stopRecording, transcript, voiceError, setVoiceError, setContinuousMode } = useVoice({
    language: 'en',
    onSpeechEnd: (finalText) => {
      if (micActive || liveVoiceMode) {
        if (liveVoiceMode) {
          setInput('');
          setTimeout(() => { sendMessage(finalText); }, 50);
        } else {
          setInput('');
          setMicActive(false);
          setTimeout(() => { sendMessage(finalText); }, 50);
        }
      }
    }
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const slashRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const prevStreamingRef = useRef(false);
  const searchAttemptsRef = useRef(0);
  const { data: session } = useSession();
  const userName = session?.user?.name?.split(' ')[0] || 'there';

  const isEmpty = messages.length === 0;

  let placeholder = MODE_PLACEHOLDERS[mode as keyof typeof MODE_PLACEHOLDERS] ?? MODE_PLACEHOLDERS.casual;
  if (isImageMode) placeholder = "Describe the image you want to create...";
  if (isVideoMode) placeholder = "Describe the AI video you want to generate...";
  if (isSearchMode) placeholder = "Ask anything to search the web...";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [input]);



  // === LATEST AI RESPONSE FOR VOICE CONVERSATION MODE ===
  const lastAiMsg = messages.filter(m => m.sender === 'ai' && !m.isHidden).slice(-1)[0];
  const latestAiResponse = lastAiMsg?.text || '';

  // === AI VOICE SPEAKING + WEB SEARCH HANDLER ===
  const lastSpokenMessageRef = useRef('');

  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.sender === 'ai' && !lastMessage.isHidden) {
        const text = lastMessage.text;
        
        // Clean reasoning tags for natural speech output
        const cleanText = text.replace(/\[REASONING\][\s\S]*?\[\/REASONING\]/gi, '').trim();

        // Speak if the normal AI voice settings are enabled OR if the Live Voice modal session is active
        const shouldSpeak = aiVoiceEnabled || voiceConversationOpen;

        if (shouldSpeak && cleanText && text !== lastSpokenMessageRef.current) {
          lastSpokenMessageRef.current = text;
          initAudioContext();
          speak(cleanText);
        }
      }
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming, messages, aiVoiceEnabled, speak, initAudioContext, voiceConversationOpen]);

  // Live Voice mode
  useEffect(() => {
    if (liveVoiceMode) { setContinuousMode(true); startRecording(); }
    else { setContinuousMode(false); stopRecording(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveVoiceMode]);

  // Slash commands
  const slashQuery = input.startsWith('/') ? input.split(/\s+/)[0].slice(1).toLowerCase() : '';
  const filteredCommands = SLASH_COMMANDS.filter(c => slashQuery ? c.cmd.startsWith(slashQuery) : true);
  const effectiveSlashOpen = slashOpen && input.startsWith('/') && filteredCommands.length > 0;

  const noticeText = (() => {
    const imageIntent = IMAGE_INTENT_REGEX.test(input);
    if (imageIntent && input.trim()) return 'Image intent detected — routing to image generation.';
    if (input.startsWith('/img ')) return 'Slash command /img — generating image.';
    return null;
  })();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (slashRef.current && !slashRef.current.contains(e.target as Node)) setSlashOpen(false);
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
    if (micActive) { stopRecording(); setMicActive(false); }
    else { setMicActive(true); startRecording(); }
  };

  const handleSend = () => {
    if ((!input.trim() && attachments.length === 0) || isStreaming) return;
    let finalInput = input;
    if (isImageMode && !finalInput.startsWith('/img')) {
      finalInput = `/img ${finalInput.trim()}`;
    } else if (isVideoMode && !finalInput.startsWith('/video')) {
      finalInput = `/video ${finalInput.trim()}`;
    }
    const hasNonImageFiles = attachments.some(a => !a.mimeType.startsWith('image/'));
    if (hasNonImageFiles && !finalInput.trim()) finalInput = 'Please analyze the attached file(s).';
    searchAttemptsRef.current = 0;
    sendMessage(finalInput, attachments);
    setInput(''); setAttachments([]); setIsImageMode(false); setIsVideoMode(false); setIsSearchMode(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (effectiveSlashOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex(i => (i + 1) % filteredCommands.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex(i => (i - 1 + filteredCommands.length) % filteredCommands.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { if (filteredCommands[slashIndex]) { e.preventDefault(); applyCommand(filteredCommands[slashIndex].cmd); return; } }
      if (e.key === 'Escape') { setSlashOpen(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // --- File processing with ZIP extraction ---
  const processFile = async (file: File): Promise<ChatAttachment | null> => {
    const maxSize = 1500 * 1024 * 1024; // 1.5GB limit
    if (file.size > maxSize) {
      setNotice(`File too large (${(file.size / 1024 / 1024 / 1024).toFixed(2)}GB). Max is 1.5GB.`);
      window.setTimeout(() => setNotice(null), 4000);
      return null;
    }
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      const dataUri = await new Promise<string>(resolve => { reader.onload = ev => resolve(ev.target?.result as string); reader.readAsDataURL(file); });
      const img = new window.Image();
      const compressedUri = await new Promise<string>(resolve => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          const MAX_DIMENSION = 800;
          if (width > height && width > MAX_DIMENSION) { height *= MAX_DIMENSION / width; width = MAX_DIMENSION; }
          else if (height > MAX_DIMENSION) { width *= MAX_DIMENSION / height; height = MAX_DIMENSION; }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) { ctx.drawImage(img, 0, 0, width, height); resolve(canvas.toDataURL('image/jpeg', 0.8)); }
          else resolve(dataUri);
        };
        img.src = dataUri;
      });
      return { url: compressedUri, mimeType: 'image/jpeg', name: file.name };
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (ext === 'zip') {
      try {
        if (file.size > 50 * 1024 * 1024) {
          // For massive zip files (up to 1.5GB), skip JSZip extraction to prevent browser RAM crash
          return { url: `data:text/plain;charset=utf-8,${encodeURIComponent(`📦 Large Archive Attached: ${file.name} (${(file.size/1024/1024).toFixed(1)} MB). Note: Due to size, contents are referenced but not fully extracted to text.`)}`, mimeType: 'text/plain', name: file.name };
        }
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        const extractedContents: string[] = []; let fileCount = 0;
        const filePromises: Promise<void>[] = [];
        zip.forEach((relativePath, zipEntry) => {
          if (!zipEntry.dir) { fileCount++; filePromises.push(zipEntry.async('text').then((content) => { extractedContents.push(`=== ${relativePath.split('/').pop() || relativePath} ===\n${content}`); }).catch(() => {})); }
        });
        await Promise.all(filePromises);
        if (extractedContents.length > 0) {
          const combinedContent = extractedContents.join('\n\n');
          const maxContentSize = 50000;
          const finalContent = combinedContent.length > maxContentSize ? combinedContent.substring(0, maxContentSize) + `\n\n... [truncated: ${fileCount} files, first ${maxContentSize} chars]` : combinedContent;
          return { url: `data:text/plain;charset=utf-8,${encodeURIComponent(`📦 Zip: ${file.name} (${fileCount} files)\n\n${finalContent}`)}`, mimeType: 'text/plain', name: file.name.replace('.zip', ' (extracted)') };
        }
        return { url: `data:text/plain;charset=utf-8,${encodeURIComponent(`📦 Zip: ${file.name} — ${fileCount} files, no readable text.`)}`, mimeType: 'text/plain', name: file.name };
      } catch (err) {
        return { url: `data:text/plain;charset=utf-8,${encodeURIComponent(`📦 Zip: ${file.name} — extraction failed.`)}`, mimeType: 'text/plain', name: file.name };
      }
    }
    if (/^(rar|7z|tar|gz)$/i.test(ext)) {
      return { url: `data:text/plain;charset=utf-8,${encodeURIComponent(`📦 Archive: ${file.name} (${(file.size/1024/1024).toFixed(1)} MB) — cannot extract in-browser.`)}`, mimeType: 'text/plain', name: file.name };
    }
    const reader = new FileReader();
    const content = await new Promise<string>(resolve => {
      reader.onload = ev => resolve(ev.target?.result as string);
      if (file.type.startsWith('text/') || file.name.match(/\.(txt|md|json|xml|html|css|js|ts|tsx|py|java|cpp|hpp|go|rb|php|csv)$/i)) reader.readAsText(file);
      else reader.readAsDataURL(file);
    });
    return { url: content, mimeType: file.type || 'application/octet-stream', name: file.name };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newAttachments: ChatAttachment[] = [];
    for (const file of files) { const result = await processFile(file); if (result) newAttachments.push(result); }
    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); dragCounterRef.current++; if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); dragCounterRef.current--; if (dragCounterRef.current === 0) setDragOver(false); }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false); dragCounterRef.current = 0;
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    const newAttachments: ChatAttachment[] = [];
    for (const file of files) { const result = await processFile(file); if (result) newAttachments.push(result); }
    setAttachments(prev => [...prev, ...newAttachments]);
  }, []);
  const handleCameraCapture = (dataUri: string) => { setAttachments(prev => [...prev, { url: dataUri, mimeType: 'image/jpeg', name: `camera-${Date.now()}.jpg` }]); setShowCamera(false); };
  const removeAttachment = (idx: number) => setAttachments(prev => prev.filter((_, i) => i !== idx));

  const handleVoiceConvSend = useCallback((text: string) => {
    searchAttemptsRef.current = 0;
    sendMessage(text, undefined, { isHidden: false });
  }, [sendMessage]);

  const handleEndVoiceConv = useCallback(() => {
    setVoiceConversationOpen(false);
  }, [setVoiceConversationOpen]);



  return (
    <div className="gemini-chat-container" onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}>
      {showCamera && <CameraModal onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />}



      {/* === DRAG & DROP OVERLAY === */}
      {dragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm animate-fade-in">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-accent bg-surface/80 px-8 py-10 shadow-xl">
            <Paperclip size={36} className="text-accent animate-bounce" />
            <p className="text-sm font-semibold text-foreground">Drop files here</p>
            <p className="text-xs text-muted">PDFs, images, documents, code files</p>
          </div>
        </div>
      )}

      {/* === CONVERSATION WINDOW === */}
      <div className="gemini-messages-scroll">
        <div className="gemini-messages-inner">
          {isEmpty ? (
            <div className="gemini-empty-state">
              <h1 className="gemini-greeting gemini-gradient-text">
                Hello, {userName !== 'there' ? userName : 'Commander'}
              </h1>
              <p className="gemini-subtitle">How can I help you today?</p>
              <div className="gemini-suggestion-grid">
                {SUGGESTIONS.map(({ icon: Icon, title, prompt }) => (
                  <button key={title} onClick={() => { setInput(prompt); textareaRef.current?.focus(); }} className="gemini-suggestion-chip">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-accent"><Icon size={15} /></span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{title}</span>
                      <span className="mt-0.5 block text-xs text-muted line-clamp-2">{prompt}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.filter(m => !m.isHidden).map((msg, idx, arr) => (
                <MessageBubble key={idx} sender={msg.sender} text={msg.text} mode={msg.mode} attachments={msg.attachments}
                  isStreaming={isStreaming && idx === arr.length - 1 && msg.sender === 'ai'} />
              ))}
              {isResearching && <ThinkingAnimation isSearch={isSearchQuery(messages.filter(m => m.sender === 'user').slice(-1)[0]?.text || '')} />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* === INPUT AREA === */}
      <div className="gemini-input-wrapper mobile-input-safe">
        {/* Notice */}
        {(noticeText ?? notice) && (
          <div className="mb-2 text-center">
            <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-xs text-accent border border-accent/20 animate-fade-in">{noticeText ?? notice}</span>
          </div>
        )}

        <div ref={slashRef} className="relative">
          {/* Slash Commands Dropdown */}
          {effectiveSlashOpen && (
            <div className="absolute bottom-full left-0 right-0 z-40 mb-2 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-lg animate-scale-in">
              {filteredCommands.map((c, i) => {
                const Icon = c.icon;
                return (
                  <button key={c.cmd} role="option" aria-selected={i === slashIndex}
                    onMouseEnter={() => setSlashIndex(i)} onClick={() => applyCommand(c.cmd)}
                    className={['flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors', i === slashIndex ? 'bg-surface-2' : 'hover:bg-surface-2'].join(' ')}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-accent"><Icon size={15} /></span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">/{c.cmd}</span>
                      <span className="block text-xs text-muted">{c.desc}</span>
                    </span>
                  </button>
                );
              })}
              <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted">↑↓ navigate · Enter select · Esc dismiss</div>
            </div>
          )}

          <div className="gemini-input-container">
            {/* Attachments preview */}
            {attachments.length > 0 && (
              <div className="gemini-attachment-preview">
                {attachments.map((att, idx) => {
                  const { Icon: FileTypeIcon, color } = getFileIcon(att.mimeType, att.name);
                  const isImage = att.mimeType.startsWith('image/');
                  return (
                    <div key={idx} className="gemini-attachment-item">
                      {isImage ? <Image src={att.url} alt={att.name} fill className="object-cover" unoptimized />
                        : <div className="flex h-full w-full items-center justify-center" style={{ color }}><FileTypeIcon size={18} /></div>}
                      <button type="button" onClick={() => removeAttachment(idx)} className="gemini-attachment-remove"><X size={10} /></button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Input row */}
            <div className="gemini-input-row">
              <textarea ref={textareaRef} value={input} rows={1} placeholder={placeholder}
                onChange={e => { 
                  const v = e.target.value; 
                  setInput(v); 
                  if (v.startsWith('/')) { if (!slashOpen) setSlashIndex(0); setSlashOpen(true); } else if (slashOpen) setSlashOpen(false); 
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                }}
                onKeyDown={handleKeyDown} disabled={isStreaming} className="gemini-textarea" />
              <div className="flex items-end pb-0.5 gap-1 shrink-0">
                <button type="button" onClick={handleMicClick} className={['gemini-icon-btn', micActive ? 'text-red-500 bg-red-500/10' : '', liveVoiceMode ? 'gemini-mic-live' : ''].join(' ')} title={micActive ? 'Stop recording' : 'Voice input'}>
                  {micActive ? (
                    <div className="flex items-center justify-center gap-[3px] h-full">
                      <span className="w-[3px] h-[10px] bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0ms', animationDuration: '0.8s' }} />
                      <span className="w-[3px] h-[16px] bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '150ms', animationDuration: '0.8s' }} />
                      <span className="w-[3px] h-[12px] bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '300ms', animationDuration: '0.8s' }} />
                    </div>
                  ) : <Mic size={16} />}
                </button>
                {isStreaming ? (
                  <button type="button" onClick={stop} className="gemini-stop-btn" title="Stop"><div className="h-3 w-3 rounded-[2px] bg-current" /></button>
                ) : (
                  <button type="button" onClick={handleSend} disabled={!input.trim() && attachments.length === 0} className="gemini-send-btn" title="Send"><ArrowUp size={16} /></button>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="gemini-input-actions">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept={ACCEPTED_FILE_TYPES} multiple className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="gemini-icon-btn" title="Attach files"><Paperclip size={16} /></button>
              <button type="button" onClick={() => { setIsSearchMode(!isSearchMode); setIsImageMode(false); setIsVideoMode(false); }} className={['gemini-icon-btn', isSearchMode ? 'active text-accent' : ''].join(' ')} title="Web Search"><Globe size={16} /></button>
              <button type="button" onClick={() => { setIsImageMode(!isImageMode); setIsVideoMode(false); setIsSearchMode(false); }} className={['gemini-icon-btn', isImageMode ? 'active' : ''].join(' ')} title="Image"><Wand2 size={16} /></button>
              {isMobile && <button type="button" onClick={() => setShowCamera(true)} className="gemini-icon-btn" title="Camera"><Camera size={16} /></button>}
            </div>
          </div>
        </div>
      </div>

      {/* === FOOTER — Gemini-style disclaimer === */}
      <div className="gemini-footer">ULTRON can make mistakes. Verify important information.</div>

      {/* === VOICE CONVERSATION MODAL (full-screen) === */}
      <VoiceConversationModal
        isOpen={voiceConversationOpen}
        onEndSession={handleEndVoiceConv}
        sendMessage={handleVoiceConvSend}
        isStreaming={isStreaming}
        latestAiResponse={latestAiResponse}
        voiceGender={voiceGender}
        onSwitchVoice={setVoiceGender}
      />

      {/* Voice Error Modal */}
      {voiceError && (
        <div className="gemini-modal-overlay">
          <div className="gemini-modal">
            <div className="gemini-modal-header">
              <h3 className="gemini-modal-title">Microphone Access Required</h3>
              <button onClick={() => setVoiceError(null)} className="gemini-icon-btn"><X size={16} /></button>
            </div>
            <div className="gemini-modal-body space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger"><Mic size={20} /></span>
                <div>
                  <p className="text-sm text-muted">We need microphone permissions for voice input.</p>
                  <div className="mt-3 rounded-lg bg-surface-2 p-3 text-xs space-y-2">
                    {voiceError.includes('Settings') ? (
                      <>
                        <p className="font-semibold text-danger">iPhone/Safari:</p>
                        <ol className="list-decimal list-inside space-y-1 text-muted"><li>Open <strong>Settings</strong> app</li><li>Privacy & Security &gt; Speech Recognition</li><li>Toggle Safari <strong>ON</strong></li><li>Reload page</li></ol>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-danger">Enable Microphone:</p>
                        <ol className="list-decimal list-inside space-y-1 text-muted"><li>Tap address bar settings icon</li><li>Change to <strong>Allow</strong></li><li>Reload page</li></ol>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="gemini-modal-footer flex justify-end">
              <button onClick={() => setVoiceError(null)} className="auth-button" style={{ width: 'auto', padding: '8px 20px' }}>Got it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
