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
  const { voices, selectedVoiceUri, setSelectedVoiceUri, liveVoiceMode, toggleLiveVoice } = useTTS();
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
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-transparent px-3 glass-panel sm:px-6">
      {/* Left: mobile menu */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
          className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground md:hidden"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Center: model selector */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <Sparkles size={16} className="text-accent" />
          <span className="max-w-[60vw] truncate">{current.name}</span>
          <ChevronDown
            size={16}
            className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute left-0 top-full z-40 mt-2 w-[calc(100vw-24px)] md:w-72 md:left-1/2 md:-translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-lg animate-fade-in"
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
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{m.name}</span>
                    <span className="block text-xs text-muted">{m.description}</span>
                  </span>
                  {active && <Check size={16} className="mt-0.5 shrink-0 text-accent" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: Empty spacer to balance flex layout */}
      <div className="flex w-10 items-center justify-end">
        {/* Icons moved to Account Settings Modal */}
      </div>
    </header>
  );
}
