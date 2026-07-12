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
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Detect if Android
    setIsAndroid(/Android/i.test(navigator.userAgent));

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
      e.preventDefault();
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Fallback: If on mobile, show the prompt manually after 2 seconds
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    let fallbackTimer: NodeJS.Timeout;
    if (isMobile) {
      fallbackTimer = setTimeout(() => {
        if (!installPromptEvent) {
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
      // On Android Chrome, if no install prompt, guide to use browser menu
      if (isAndroid) {
        alert(
          '📱 To install ULTRON on your Android device:\n\n' +
          '1. Tap the ⋮ (three dots) menu in your browser\n' +
          '2. Select "Install app" or "Add to Home screen"\n' +
          '3. Follow the on-screen instructions\n\n' +
          'This installs the Progressive Web App (PWA) - no APK file needed!'
        );
      } else {
        alert(
          '📱 To install ULTRON:\n\n' +
          '• On iPhone/iPad: Tap the Share icon (📤) → "Add to Home Screen"\n' +
          '• On Android: Tap the browser menu (⋮) → "Install App" or "Add to Home Screen"\n' +
          '• On Desktop: Look for the install icon (➕) in the address bar'
        );
      }
      setShowPrompt(false);
      return;
    }
    
    // Show the native install prompt
    installPromptEvent.prompt();
    
    const { outcome } = await installPromptEvent.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setShowPrompt(false);
    }
    
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
          <span className="text-[15px] font-semibold text-foreground">Install ULTRON</span>
          <span className="text-[13px] text-muted">{isAndroid ? 'Add to home screen' : 'Install PWA for best experience'}</span>
        </div>
      </div>
      
      <div className="ml-4 flex items-center gap-2">
        <button
          onClick={handleInstallClick}
          className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-105 active:scale-95 whitespace-nowrap"
        >
          {installPromptEvent ? 'Install' : 'How to Install'}
        </button>
        <button onClick={handleDismiss} className="rounded-full bg-surface-2 p-1.5 text-muted hover:text-foreground transition-colors" aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
