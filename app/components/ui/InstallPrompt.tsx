'use client';
import { useState, useEffect } from 'react';
import { DownloadCloud, X } from 'lucide-react';

export default function InstallPrompt() {
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
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
      setInstallPromptEvent(e);
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
      alert('To install ULTRON as a native app on this device, tap your browser menu (the 3 dots or Share icon) and select "Add to Home Screen" or "Install App".');
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
    <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between bg-accent px-4 py-3 text-accent-foreground shadow-lg animate-fade-in-down sm:left-auto sm:right-4 sm:top-4 sm:rounded-2xl sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-md">
          <DownloadCloud size={20} />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-white">Get the ULTRON App</span>
          <span className="text-xs text-white/80">Add to home screen for a native experience.</span>
        </div>
      </div>
      
      <div className="ml-6 flex items-center gap-3">
        <button
          onClick={handleInstallClick}
          className="rounded-full bg-white px-4 py-1.5 text-sm font-bold text-accent shadow-sm transition-transform hover:scale-105 active:scale-95"
        >
          Install
        </button>
        <button onClick={handleDismiss} className="text-white/60 hover:text-white" aria-label="Dismiss">
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
