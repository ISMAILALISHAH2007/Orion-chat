'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

export default function SplashLoader({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [mounted, setMounted] = useState(false);
  const [loadingText, setLoadingText] = useState('Initializing Cognitive Core...');
  const [fadeOut, setFadeOut] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cycle loading texts to make the boot feel advanced and dynamic
  useEffect(() => {
    if (status === 'loading') {
      const texts = [
        'Connecting Secure Core...',
        'Syncing Memory Bank...',
        'Optimizing Neural Channels...',
        'Booting ORION...'
      ];
      let idx = 0;
      const interval = setInterval(() => {
        setLoadingText(texts[idx % texts.length]);
        idx++;
      }, 900);
      return () => clearInterval(interval);
    }
  }, [status]);

  // Smooth fade-out transition when loading finishes
  useEffect(() => {
    if (status !== 'loading' && mounted) {
      setFadeOut(true);
      const timer = setTimeout(() => {
        setDone(true);
      }, 600); // matches transition time
      return () => clearTimeout(timer);
    }
  }, [status, mounted]);

  if (!mounted) return null;

  if (done) {
    return <>{children}</>;
  }

  return (
    <>
      <div 
        className={[
          'fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#07090e] transition-opacity duration-500 ease-out select-none',
          fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
        ].join(' ')}
      >
        {/* Animated Background Ring */}
        <div className="absolute w-[220px] h-[220px] rounded-full border border-accent/10 animate-ping opacity-25" />
        
        {/* Pulse Logo Core */}
        <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-tr from-accent/10 to-purple-500/10 border border-accent/20 animate-pulse">
          <Sparkles size={38} className="text-accent animate-spin-slow" />
          <div className="absolute inset-0.5 rounded-full border border-dashed border-accent/30 animate-spin-slow" style={{ animationDirection: 'reverse' }} />
        </div>

        {/* ORION Branding */}
        <h1 className="text-2xl font-extrabold tracking-[0.25em] mt-8 text-foreground uppercase animate-pulse">
          ORION
        </h1>

        {/* Fluid Loading Progress Bar */}
        <div className="w-[180px] h-1 bg-surface-3 rounded-full overflow-hidden mt-6 border border-border/20">
          <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-accent animate-progress-bar rounded-full" />
        </div>

        {/* Dynamic subtext */}
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted/80 mt-4 h-4">
          {loadingText}
        </p>
      </div>

      {/* Render children in background to prevent blank page flashes */}
      <div className={status === 'loading' ? 'invisible' : 'visible'}>
        {children}
      </div>
    </>
  );
}
