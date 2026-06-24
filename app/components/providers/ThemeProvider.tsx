'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { UltronAnimations } from '@/app/lib/animations';

const ModeContext = createContext<{
  mode: string;
  setMode: (mode: string) => void;
}>({ mode: 'casual', setMode: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState('casual');

  useEffect(() => {
    const oldMode = document.body.className.replace('mode-', '') || 'casual';
    document.body.className = `mode-${mode}`;
    UltronAnimations.sweepThemeTransition(oldMode, mode);
  }, [mode]);

  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export const useMode = () => useContext(ModeContext);
