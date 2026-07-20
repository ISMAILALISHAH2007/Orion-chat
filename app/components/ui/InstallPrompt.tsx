'use client';
import { useState, useEffect } from 'react';
import { DownloadCloud, X } from 'lucide-react';
import { showInstallInstructions } from '@/app/lib/utils/install';

const DISMISSED_KEY = 'orion-install-dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function InstallPrompt() {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isAndroid, setIsAndroid] = useState(() => {
    if (typeof window === 'undefined') return false;
    return /Android/i.test(navigator.userAgent);
  });

  // Check if already dismissed — only show once
  const wasDismissed = () => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem(DISMISSED_KEY);
  };

  const markDismissed = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch {}
  };

  useEffect(() => {
    // Skip entirely if already dismissed once
    if (wasDismissed()) return;

    // Register Service Worker for PWA if supported
    // Skipped in development to avoid Turbopack/HTTPS redirect issues
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.error('ServiceWorker registration failed: ', err);
        });
      });
    }

    // Listen for the native install prompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Fallback: If on mobile, show the prompt manually after 3 seconds
    // but only if NOT already dismissed
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    let fallbackTimer: NodeJS.Timeout;
    if (isMobile) {
      fallbackTimer = setTimeout(() => {
        if (!installPromptEvent && !wasDismissed()) {
          setShowPrompt(true);
        }
      }, 3000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPromptEvent) {
      showInstallInstructions(isAndroid);
      markDismissed();
      setShowPrompt(false);
      return;
    }
    
    // Show the native install prompt
    installPromptEvent.prompt();
    
    const { outcome } = await installPromptEvent.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      markDismissed();
    }
    
    setInstallPromptEvent(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    markDismissed();
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed left-3 right-3 top-4 z-50 flex items-center justify-between rounded-2xl px-4 py-3 shadow-2xl animate-fade-in-down sm:left-auto sm:right-6 sm:top-6 sm:w-[380px]"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(16px)',
        boxShadow: 'var(--shadow-xl)'
      }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          <DownloadCloud size={20} />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">Install ORION</span>
          <span className="text-xs text-muted">{isAndroid ? 'Add to home screen' : 'Install PWA for best experience'}</span>
        </div>
      </div>
      
      <div className="ml-4 flex items-center gap-2">
        <button
          onClick={handleInstallClick}
          className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground shadow-sm transition-all hover:scale-105 active:scale-95 whitespace-nowrap hover:opacity-90"
        >
          {installPromptEvent ? 'Install' : 'How to Install'}
        </button>
        <button onClick={handleDismiss} className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-2 text-muted hover:text-foreground hover:bg-surface-hover transition-colors" aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
