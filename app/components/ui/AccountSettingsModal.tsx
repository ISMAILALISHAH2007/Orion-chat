'use client';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from '@/app/components/providers/ThemeProvider';
import { useTTS } from '@/app/components/providers/TTSProvider';
import { X, Sun, Moon, Volume2, LogOut, User, Check, Settings } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface AccountSettingsModalProps {
  onClose: () => void;
}

export default function AccountSettingsModal({ onClose }: AccountSettingsModalProps) {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const { voices, selectedVoiceUri, setSelectedVoiceUri } = useTTS();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const userName = session?.user?.name || 'Commander';
  const userEmail = session?.user?.email || '';
  const initial = (userName || 'U').charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in px-4">
      <div 
        ref={modalRef} 
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl animate-slide-up"
      >
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Settings size={20} className="text-muted" /> Settings
          </h2>
          <button 
            onClick={onClose} 
            className="rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Profile Section */}
          <div className="flex items-center gap-4 rounded-xl border border-border bg-surface-2 p-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-xl font-bold text-accent-foreground shadow-sm">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-semibold text-foreground">{userName}</h3>
              <p className="truncate text-sm text-muted">{userEmail}</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Theme Toggle */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Theme</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTheme('light')}
                  className={['flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-all', theme === 'light' ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-transparent text-muted hover:bg-surface-2'].join(' ')}
                >
                  <Sun size={16} /> Light
                  {theme === 'light' && <Check size={14} className="ml-1" />}
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={['flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-all', theme === 'dark' ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-transparent text-muted hover:bg-surface-2'].join(' ')}
                >
                  <Moon size={16} /> Dark
                  {theme === 'dark' && <Check size={14} className="ml-1" />}
                </button>
              </div>
            </div>

            {/* AI Voice Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Volume2 size={16} className="text-muted" /> AI Voice Model
              </label>
              <div className="relative">
                <select
                  value={selectedVoiceUri}
                  onChange={(e) => setSelectedVoiceUri(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent"
                >
                  {voices.map(v => (
                    <option key={v.uri} value={v.uri}>{v.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
                  <svg className="h-4 w-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-muted">Select the language and accent for live voice mode.</p>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 p-4">
          <button
            onClick={() => signOut()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-danger/10 py-3 text-sm font-semibold text-danger transition-colors hover:bg-danger/20"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
