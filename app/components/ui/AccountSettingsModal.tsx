'use client';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from '@/app/components/providers/ThemeProvider';
import { X, Sun, Moon, LogOut, Check, Settings, ArrowLeftRight, Monitor } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface AccountSettingsModalProps {
  onClose: () => void;
}

export default function AccountSettingsModal({ onClose }: AccountSettingsModalProps) {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
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

  const themes: { id: 'light' | 'dark' | 'oled'; label: string; icon: typeof Sun; preview: string; accent: string }[] = [
    { id: 'light', label: 'Light', icon: Sun, preview: 'bg-white', accent: 'text-amber-500' },
    { id: 'dark', label: 'Dark', icon: Moon, preview: 'bg-zinc-800', accent: 'text-blue-400' },
    { id: 'oled', label: 'Nebula', icon: Monitor, preview: 'bg-black', accent: 'text-fuchsia-400' },
  ];

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
            {/* Theme Toggle — Now with 3 themes! */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Theme</label>
              <div className="grid grid-cols-3 gap-2">
                {themes.map((t) => {
                  const Icon = t.icon;
                  const active = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={[
                        'flex flex-col items-center justify-center gap-1.5 rounded-xl border py-3 text-xs font-medium transition-all',
                        active
                          ? 'border-accent bg-accent/10 text-accent ring-1 ring-accent/30'
                          : 'border-border bg-transparent text-muted hover:bg-surface-2 hover:text-foreground',
                      ].join(' ')}
                    >
                      <div className={[
                        'w-8 h-8 rounded-lg border flex items-center justify-center transition-transform',
                        active ? 'scale-110' : '',
                        t.preview,
                        active ? 'border-accent/50' : 'border-border',
                      ].join(' ')}>
                        <Icon size={14} className={active ? t.accent : 'text-muted'} />
                      </div>
                      <span className="flex items-center gap-1">
                        {t.label}
                        {active && <Check size={10} className="shrink-0" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 p-4 flex flex-col gap-2">
          <button
            onClick={() => signOut({ callbackUrl: '/sign-in' })}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-2"
          >
            <ArrowLeftRight size={18} />
            Switch Account
          </button>
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
