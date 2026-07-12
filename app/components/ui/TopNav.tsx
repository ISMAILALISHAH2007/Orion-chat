'use client';
import { useMode, useTheme } from '@/app/components/providers/ThemeProvider';
import { useTTS } from '@/app/components/providers/TTSProvider';
import { useState, useRef, useEffect } from 'react';
import { Menu, ChevronDown, Check, Sun, Moon, Sparkles, Headphones } from 'lucide-react';

const MODELS: { id: string; name: string; description: string; placeholder: string }[] = [
  {
    id: 'casual',
    name: 'Flash 2.5',
    description: "Fast, everyday conversations — chat naturally, I'm here for you.",
    placeholder: "Chat naturally, I'm here for you.",
  },
  {
    id: 'developer',
    name: 'Pro 4.8',
    description: 'Technical, code-oriented — write code, debug, or architect systems.',
    placeholder: 'Write code, debug, or architect systems.',
  },
  {
    id: 'research',
    name: 'Deep Think',
    description: 'Deep analysis, long-form answers — dive deep into research, analyse data.',
    placeholder: 'Dive deep into research, analyse data.',
  },
  {
    id: 'professional',
    name: 'Ultra',
    description: 'Executive, concise, formal — data-driven insights.',
    placeholder: 'Executive insights, concise and data-driven.',
  },
];

interface TopNavProps {
  onOpenSidebar: () => void;
}

export default function TopNav({ onOpenSidebar }: TopNavProps) {
  const { mode, setMode } = useMode();
  const { theme, toggleTheme } = useTheme();
  const {
    liveVoiceMode,
    setLiveVoiceMode,
    aiVoiceEnabled,
    setAiVoiceEnabled,
    voiceConversationOpen,
    setVoiceConversationOpen,
    isSpeaking,
    initAudioContext,
    stopSpeaking,
    voices,
    selectedVoiceUri,
    setSelectedVoiceUri,
    voiceGender,
    setVoiceGender,
  } = useTTS();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = MODELS.find((m) => m.id === mode) ?? MODELS[0];

  const handleAiVoiceToggle = () => {
    if (voiceConversationOpen) {
      // This should be handled by the modal's End Session
      stopSpeaking();
      setVoiceConversationOpen(false);
      setAiVoiceEnabled(false);
    } else {
      initAudioContext();
      setAiVoiceEnabled(true);
      setVoiceConversationOpen(true);
    }
  };

  const handleLiveVoiceToggle = () => {
    setLiveVoiceMode(!liveVoiceMode);
  };

  return (
    <header className="gemini-topnav">
      {/* Left: mobile menu */}
      <button
        onClick={onOpenSidebar}
        aria-label="Open sidebar"
        className="md:hidden gemini-icon-btn"
      >
        <Menu size={18} />
      </button>

      {/* Spacer for mobile */}
      <div className="md:hidden w-9" />

      {/* Center: model selector */}
      <div className="relative flex items-center justify-center" ref={menuRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="gemini-model-btn"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <Sparkles size={15} className="shrink-0 text-accent" />
          <span>{current.name}</span>
          <ChevronDown size={14} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {/* Model Dropdown */}
        {open && (
          <div className="gemini-model-dropdown animate-scale-in">
            {/* Models */}
            {MODELS.map((m) => {
              const active = m.id === mode;
              return (
                <button
                  key={m.id}
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    setMode(m.id);
                    setOpen(false);
                  }}
                  className={[
                    'gemini-model-option',
                    active ? 'active' : '',
                  ].join(' ')}
                >
                  <div className="flex-1">
                    <div className="gemini-model-option-name">{m.name}</div>
                    <div className="gemini-model-option-desc">{m.description}</div>
                  </div>
                  {active && <Check size={16} className="mt-0.5 shrink-0 text-accent" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: Live Voice (real-time voice conversation) + Theme Toggle */}
      <div className="flex items-center gap-1">
        {/* Live Voice Button */}
        <button
          onClick={() => {
            initAudioContext();
            setVoiceConversationOpen(true);
          }}
          title={voiceConversationOpen ? 'Live voice active' : 'Start live voice conversation'}
          className={[
            'gemini-live-voice-btn flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider transition-all',
            voiceConversationOpen ? 'active bg-accent text-accent-foreground shadow-lg shadow-accent/20' : '',
          ].join(' ')}
        >
          <Headphones size={13} className={voiceConversationOpen ? 'animate-bounce' : ''} />
          <span>LIVE</span>
          {voiceConversationOpen && (
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-ping" />
          )}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          className="gemini-icon-btn"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
