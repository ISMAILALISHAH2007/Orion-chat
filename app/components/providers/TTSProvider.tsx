'use client';
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export interface TTSVoice {
  uri: string;
  name: string;
  lang: string;
  voice: any;
}

const CLOUD_VOICES: TTSVoice[] = [
  { uri: 'en', name: 'English (US)', lang: 'en', voice: null },
  { uri: 'en-GB', name: 'English (UK)', lang: 'en-GB', voice: null },
  { uri: 'es', name: 'Spanish', lang: 'es', voice: null },
  { uri: 'fr', name: 'French', lang: 'fr', voice: null },
  { uri: 'de', name: 'German', lang: 'de', voice: null },
  { uri: 'it', name: 'Italian', lang: 'it', voice: null },
  { uri: 'hi', name: 'Hindi', lang: 'hi', voice: null },
  { uri: 'ar', name: 'Arabic', lang: 'ar', voice: null },
  { uri: 'zh-CN', name: 'Chinese', lang: 'zh-CN', voice: null },
  { uri: 'ja', name: 'Japanese', lang: 'ja', voice: null },
];

interface TTSContextType {
  voices: TTSVoice[];
  selectedVoiceUri: string;
  setSelectedVoiceUri: (uri: string) => void;
  speak: (text: string, voiceUriOverride?: string, onEnd?: () => void) => void;
  stopSpeaking: () => void;
  isSpeaking: boolean;
  liveVoiceMode: boolean;
  toggleLiveVoice: () => void;
  setLiveVoiceMode: (mode: boolean) => void;
}

const TTSContext = createContext<TTSContextType | undefined>(undefined);

export function TTSProvider({ children }: { children: React.ReactNode }) {
  const voices = CLOUD_VOICES;
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>('en');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [liveVoiceMode, setLiveVoiceMode] = useState(false);

  // Single global audio element attached to the DOM to bypass iOS/Safari autoplay blocks
  const globalAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingQueueRef = useRef(false);

  const stopSpeaking = useCallback(() => {
    if (globalAudioRef.current) {
      globalAudioRef.current.pause();
      globalAudioRef.current.currentTime = 0;
      globalAudioRef.current.src = '';
    }
    audioQueueRef.current = [];
    isPlayingQueueRef.current = false;
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((text: string, voiceUriOverride?: string, onEnd?: () => void) => {
    stopSpeaking();
    
    const cleanText = text
      .replace(/\[VOICE:[^\]]+\]/gi, '')
      .replace(/```[\s\S]*?```/g, ' Code block omitted. ')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/[*_#`]/g, '')
      .trim();

    if (!cleanText) {
      onEnd?.();
      return;
    }

    const requestedLang = (voiceUriOverride || selectedVoiceUri || 'en').toLowerCase();
    let langCode = 'en';
    if (requestedLang.includes('es') || requestedLang.includes('spanish')) langCode = 'es';
    else if (requestedLang.includes('fr') || requestedLang.includes('french')) langCode = 'fr';
    else if (requestedLang.includes('de') || requestedLang.includes('german')) langCode = 'de';
    else if (requestedLang.includes('it') || requestedLang.includes('italian')) langCode = 'it';
    else if (requestedLang.includes('hi') || requestedLang.includes('hindi')) langCode = 'hi';
    else if (requestedLang.includes('ar') || requestedLang.includes('arabic')) langCode = 'ar';
    else if (requestedLang.includes('zh') || requestedLang.includes('chinese')) langCode = 'zh-CN';
    else if (requestedLang.includes('ja') || requestedLang.includes('japanese')) langCode = 'ja';
    else if (requestedLang.includes('uk')) langCode = 'en-GB';

    const chunks: string[] = [];
    let currentChunk = '';
    const words = cleanText.split(/\s+/);
    
    for (const word of words) {
      if (currentChunk.length + word.length > 150) {
        chunks.push(currentChunk.trim());
        currentChunk = word + ' ';
      } else {
        currentChunk += word + ' ';
        if (word.match(/[.!?:]$/)) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
      }
    }
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    if (chunks.length === 0) {
      onEnd?.();
      return;
    }

    audioQueueRef.current = chunks.map(chunk => 
      `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${langCode}&q=${encodeURIComponent(chunk)}`
    );

    setIsSpeaking(true);
    isPlayingQueueRef.current = true;

    const playNext = () => {
      if (!isPlayingQueueRef.current) return; // Stopped
      if (audioQueueRef.current.length === 0) {
        setIsSpeaking(false);
        isPlayingQueueRef.current = false;
        onEnd?.();
        return;
      }
      
      const nextUrl = audioQueueRef.current.shift()!;
      if (globalAudioRef.current) {
        globalAudioRef.current.src = nextUrl;
        
        globalAudioRef.current.onended = () => {
          playNext();
        };
        
        globalAudioRef.current.onerror = () => {
          playNext(); 
        };
        
        globalAudioRef.current.play().catch(e => {
          console.error('Mobile Audio Autoplay blocked:', e);
          playNext();
        });
      }
    };

    playNext();

  }, [selectedVoiceUri, stopSpeaking]);

  const toggleLiveVoice = useCallback(() => {
    setLiveVoiceMode(prev => {
      const next = !prev;
      if (!next && isSpeaking) {
        stopSpeaking();
      } else if (next) {
        // Unlock the global audio element strictly on user tap!
        if (globalAudioRef.current) {
          globalAudioRef.current.src = 'data:audio/mp3;base64,//OExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
          globalAudioRef.current.play().catch(() => {});
        }
      }
      return next;
    });
  }, [isSpeaking, stopSpeaking]);

  return (
    <TTSContext.Provider value={{
      voices,
      selectedVoiceUri,
      setSelectedVoiceUri,
      speak,
      stopSpeaking,
      isSpeaking,
      liveVoiceMode,
      toggleLiveVoice,
      setLiveVoiceMode
    }}>
      {children}
      {/* Physically rendered hidden audio element ensures iOS Safari allows programmatic `.play()` later */}
      <audio ref={globalAudioRef} className="hidden" playsInline />
    </TTSContext.Provider>
  );
}

export function useTTS() {
  const context = useContext(TTSContext);
  if (context === undefined) {
    throw new Error('useTTS must be used within a TTSProvider');
  }
  return context;
}
