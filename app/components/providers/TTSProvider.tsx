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

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const isPlayingQueueRef = useRef(false);

  // Initialize AudioContext exactly once on user interaction
  const initAudioContext = () => {
    if (!audioCtxRef.current && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const stopSpeaking = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) {
        // ignore
      }
      sourceNodeRef.current = null;
    }
    isPlayingQueueRef.current = false;
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string, voiceUriOverride?: string, onEnd?: () => void) => {
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

    setIsSpeaking(true);
    isPlayingQueueRef.current = true;
    
    // Ensure context is alive
    initAudioContext();
    const ctx = audioCtxRef.current;
    if (!ctx) {
      setIsSpeaking(false);
      onEnd?.();
      return;
    }

    // Fetch and decode concurrently
    const playQueue = async () => {
      try {
        for (let i = 0; i < chunks.length; i++) {
          if (!isPlayingQueueRef.current) break; // aborted

          const url = `/api/voice/tts?lang=${langCode}&text=${encodeURIComponent(chunks[i])}`;
          const res = await fetch(url);
          if (!res.ok) continue; // Skip broken chunks
          const arrayBuffer = await res.arrayBuffer();
          
          if (!isPlayingQueueRef.current) break;
          
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          
          if (!isPlayingQueueRef.current) break;
          
          await new Promise<void>((resolve) => {
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.onended = () => resolve();
            sourceNodeRef.current = source;
            source.start(0);
          });
        }
      } catch (err) {
        console.error('Web Audio API playback failed', err);
      } finally {
        if (isPlayingQueueRef.current) {
          setIsSpeaking(false);
          isPlayingQueueRef.current = false;
          onEnd?.();
        }
      }
    };

    playQueue();

  }, [selectedVoiceUri, stopSpeaking]);

  const toggleLiveVoice = useCallback(() => {
    setLiveVoiceMode(prev => {
      const next = !prev;
      if (!next && isSpeaking) {
        stopSpeaking();
      } else if (next) {
        // Unlock audio context explicitly on user tap
        initAudioContext();
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
