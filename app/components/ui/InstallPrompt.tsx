'use client';
import { useState, useEffect } from 'react';
import { DownloadCloud, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function InstallPrompt() {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Register Service Worker for PWA if supported
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.error('ServiceWorker registration failed: ', err);
        });
      });
    }

    // Listen for the native install prompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
      // Show our custom UI
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Fallback: If on mobile, show the prompt manually after 2 seconds in case the network blocks the native event
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    let fallbackTimer: NodeJS.Timeout;
    if (isMobile) {
      fallbackTimer = setTimeout(() => {
        setShowPrompt(true);
      }, 2000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPromptEvent) {
      alert("As a modern Web App, ULTRON doesn't use an APK file! To install it natively, just tap your browser's menu (the 3 dots or Share icon) and select 'Add to Home Screen' or 'Install App'.");
      setShowPrompt(false);
      return;
    }
    
    // Show the native install prompt
    installPromptEvent.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await installPromptEvent.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    // Clear the saved prompt since it can't be used again
    setInstallPromptEvent(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed left-3 right-3 top-4 z-50 flex items-center justify-between rounded-2xl px-4 py-3 shadow-2xl animate-fade-in-down glass-panel border border-white/20 sm:left-auto sm:right-6 sm:top-6 sm:w-[380px]">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-accent/20 text-accent backdrop-blur-md">
          <DownloadCloud size={20} />
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold text-foreground">Get the ULTRON App</span>
          <span className="text-[13px] text-muted">Add to home screen for a native experience.</span>
        </div>
      </div>
      
      <div className="ml-6 flex items-center gap-3">
        <button
          onClick={handleInstallClick}
          className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
        >
          Install
        </button>
        <button onClick={handleDismiss} className="rounded-full bg-surface-2 p-1.5 text-muted hover:text-foreground transition-colors" aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
