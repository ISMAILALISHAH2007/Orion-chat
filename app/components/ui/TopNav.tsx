'use client';
import { useMode, useTheme } from '@/app/components/providers/ThemeProvider';
import { useTTS } from '@/app/components/providers/TTSProvider';
import { useState, useRef, useEffect } from 'react';
import { Menu, ChevronDown, Check, Sun, Moon, Sparkles, Volume2, VolumeX } from 'lucide-react';

const MODELS: { id: string; name: string; description: string; placeholder: string }[] = [
  {
    id: 'casual',
    name: 'Casual 2.5',
    description: "Friendly, everyday conversations — chat naturally, I'm here for you.",
    placeholder: "Chat naturally, I'm here for you.",
  },
  {
    id: 'developer',
    name: 'Developer 4.8',
    description: 'Technical, code-oriented — write code, debug, or architect systems.',
    placeholder: 'Write code, debug, or architect systems.',
  },
  {
    id: 'research',
    name: 'Research Deeping Mode',
    description: 'Deep analysis, long-form answers — dive deep into research, analyse data.',
    placeholder: 'Dive deep into research, analyse data.',
  },
  {
    id: 'professional',
    name: 'Professional',
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
  const { voices, selectedVoiceUri, setSelectedVoiceUri, liveVoiceMode, setLiveVoiceMode } = useTTS();
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

  return (
    <header className="sticky top-0 z-30 flex h-12 sm:h-14 items-center justify-between border-b border-white/10 bg-transparent px-2 sm:px-3 glass-panel">
      {/* Left: mobile menu */}
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
          className="rounded-lg p-1.5 sm:p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground md:hidden"
        >
          <Menu size={18} />
        </button>
      </div>

      {/* Center: model selector */}
      <div className="relative flex-1 flex justify-center max-w-[60%] sm:max-w-none mx-auto" ref={menuRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 sm:gap-2 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-foreground transition-colors hover:bg-surface-2 max-w-full"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <Sparkles size={14} className="shrink-0 text-accent" />
          <span className="truncate max-w-[35vw] sm:max-w-none">{current.name}</span>
          <ChevronDown
            size={14}
            className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div
            role="menu"
            className="fixed left-1/2 top-14 sm:top-16 -translate-x-1/2 z-40 mt-1 w-[calc(100vw-32px)] max-w-sm sm:w-72 sm:absolute sm:left-1/2 sm:-translate-x-1/2 sm:top-full sm:mt-2 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-lg animate-fade-in"
          >
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
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 sm:py-2 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{m.name}</span>
                    <span className="block text-xs text-muted leading-tight mt-0.5">{m.description}</span>
                  </span>
                  {active && <Check size={16} className="mt-0.5 shrink-0 text-accent" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: Live Voice button */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setLiveVoiceMode(!liveVoiceMode)}
          title={liveVoiceMode ? 'Live Voice ON — tap to stop' : 'Live Voice — tap to start conversation'}
          className={[
            'flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-[11px] font-semibold transition-all duration-200 border',
            liveVoiceMode
              ? 'bg-[#22c55e] text-white border-[#22c55e] shadow-sm shadow-[#22c55e]/30 animate-pulse'
              : 'bg-surface text-muted border-border hover:text-foreground hover:border-[#22c55e]/50',
          ].join(' ')}
        >
          <span className={liveVoiceMode ? 'animate-pulse' : ''}>
            {liveVoiceMode ? '○' : '○'}
          </span>
          <span className="hidden sm:inline">{liveVoiceMode ? 'LIVE' : 'Voice'}</span>
        </button>
      </div>
    </header>
  );
}
