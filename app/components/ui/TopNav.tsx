'use client';
import { useMode, useTheme } from '@/app/components/providers/ThemeProvider';
import { useTTS } from '@/app/components/providers/TTSProvider';
import { useState, useRef, useEffect } from 'react';
import { Menu, ChevronDown, Check, Sun, Moon, Sparkles, Volume2, VolumeX } from 'lucide-react';

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

            {/* Voice Language Separator */}
            <div className="gemini-dropdown-separator">Voice Language</div>
            {voices.map((v) => {
              const active = v.uri === selectedVoiceUri;
              return (
                <button
                  key={v.uri}
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    setSelectedVoiceUri(v.uri);
                    setOpen(false);
                  }}
                  className={[
                    'gemini-model-option',
                    active ? 'active' : '',
                  ].join(' ')}
                >
                  <div className="flex-1">
                    <div className="gemini-model-option-name">{v.name}</div>
                    <div className="gemini-model-option-desc">{v.lang}</div>
                  </div>
                  {active && <Check size={16} className="mt-0.5 shrink-0 text-accent" />}
                </button>
              );
            })}

            {/* Voice Gender Separator */}
            <div className="gemini-dropdown-separator">Voice Gender</div>
            {(['female', 'male'] as const).map((g) => {
              const active = g === voiceGender;
              return (
                <button
                  key={g}
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    setVoiceGender(g);
                    setOpen(false);
                  }}
                  className={[
                    'gemini-model-option',
                    active ? 'active' : '',
                  ].join(' ')}
                >
                  <div className="flex-1">
                    <div className="gemini-model-option-name">{g === 'female' ? 'Female' : 'Male'}</div>
                    <div className="gemini-model-option-desc">{g === 'female' ? 'Natural feminine voice' : 'Natural masculine voice'}</div>
                  </div>
                  {active && <Check size={16} className="mt-0.5 shrink-0 text-accent" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: AI Voice + Theme + Live Voice */}
      <div className="flex items-center gap-0.5">
        {/* AI Voice Toggle */}
        <button
          onClick={handleAiVoiceToggle}
          title={voiceConversationOpen ? 'Voice conversation active' : 'Start voice conversation'}
          className={[
            'gemini-icon-btn relative',
            voiceConversationOpen ? 'text-accent voice-conv-active' : '',
          ].join(' ')}
        >
          {voiceConversationOpen && isSpeaking ? (
            <div className="flex items-center gap-[1.5px]">
              <span className="sound-bar h-2.5 w-[2px] rounded-full bg-accent" />
              <span className="sound-bar h-3.5 w-[2px] rounded-full bg-accent" style={{ animationDelay: '0.15s' }} />
              <span className="sound-bar h-2 w-[2px] rounded-full bg-accent" style={{ animationDelay: '0.3s' }} />
              <span className="sound-bar h-3 w-[2px] rounded-full bg-accent" style={{ animationDelay: '0.1s' }} />
            </div>
          ) : voiceConversationOpen ? (
            <div className="relative">
              <Volume2 size={16} />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-green-500 animate-ping" />
            </div>
          ) : (
            <Volume2 size={16} />
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

        {/* Live Voice */}
        <button
          onClick={handleLiveVoiceToggle}
          title={liveVoiceMode ? 'Stop Live Voice' : 'Start Live Voice'}
          className={[
            'gemini-live-voice-btn',
            liveVoiceMode ? 'active' : '',
          ].join(' ')}
        >
          <span className={`${liveVoiceMode ? 'text-white' : 'text-muted'}`}>
            {liveVoiceMode ? '●' : '○'}
          </span>
          <span className="hidden sm:inline">{liveVoiceMode ? 'LIVE' : 'Live'}</span>
        </button>
      </div>
    </header>
  );
}
