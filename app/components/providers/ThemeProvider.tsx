'use client';
import * as React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

const ModeContext = createContext<{
  mode: string;
  setMode: (mode: string) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}>({
  mode: 'casual',
  setMode: () => {},
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // "mode" controls the assistant persona sent to the chat API.
  const [mode, setMode] = useState('casual');
  // "theme" controls light/dark appearance (dark is the default).
  // Initialize from localStorage so SSR + first client paint match.
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = localStorage.getItem('ultron-theme') as Theme | null;
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  // Apply theme to <html> and persist it.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('ultron-theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ModeContext.Provider value={{ mode, setMode, theme, setTheme, toggleTheme }}>
      {children}
    </ModeContext.Provider>
  );
}

export const useMode = () => useContext(ModeContext);
export const useTheme = () => {
  const { theme, setTheme, toggleTheme } = useContext(ModeContext);
  return { theme, setTheme, toggleTheme };
};
