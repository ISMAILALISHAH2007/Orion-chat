'use client';
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

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
  { uri: 'ur', name: 'Urdu', lang: 'ur', voice: null },
  { uri: 'ar', name: 'Arabic', lang: 'ar', voice: null },
  { uri: 'zh-CN', name: 'Chinese', lang: 'zh-CN', voice: null },
  { uri: 'ja', name: 'Japanese', lang: 'ja', voice: null },
];

interface TTSContextType {
  voices: TTSVoice[];
  selectedVoiceUri: string;
  setSelectedVoiceUri: (uri: string) => void;
  voiceGender: 'female' | 'male';
  setVoiceGender: (gender: 'female' | 'male') => void;
  speak: (text: string, voiceUriOverride?: string, onEnd?: () => void) => void;
  stopSpeaking: () => void;
  isSpeaking: boolean;
  liveVoiceMode: boolean;
  toggleLiveVoice: () => void;
  setLiveVoiceMode: (mode: boolean) => void;
  initAudioContext: () => void;
  aiVoiceEnabled: boolean;
  setAiVoiceEnabled: (enabled: boolean) => void;
}

const TTSContext = createContext<TTSContextType | undefined>(undefined);

export function TTSProvider({ children }: { children: React.ReactNode }) {
  const voices = CLOUD_VOICES;
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>('en');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [liveVoiceMode, setLiveVoiceMode] = useState(false);
  const [aiVoiceEnabled, setAiVoiceEnabled] = useState(false);

  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>('female');

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const isPlayingQueueRef = useRef(false);
  const currentPlaySessionIdRef = useRef(0);

  // Automatically unlock AudioContext on the first user interaction (safeguard for Safari & mobile browsers)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const unlock = () => {
      initAudioContext();
      if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
        window.removeEventListener('click', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('keydown', unlock);
      }
    };

    window.addEventListener('click', unlock);
    window.addEventListener('touchstart', unlock);
    window.addEventListener('keydown', unlock);

    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Initialize AudioContext exactly once on user interaction
  const initAudioContext = () => {
    if (!audioCtxRef.current && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    
    const ctx = audioCtxRef.current;
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      // Play a short silent buffer to permanently unlock the audio context for Safari / iOS
      try {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      } catch (e) {
        console.warn('Failed to play silent unlock buffer:', e);
      }
    }
  };

  const stopSpeaking = useCallback(() => {
    currentPlaySessionIdRef.current++; // Invalidate any running speak queue loops
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
    const mySessionId = ++currentPlaySessionIdRef.current;
    
    let newLang = selectedVoiceUri;
    let newGender = voiceGender;

    const voiceMatch = text.match(/\[VOICE:\s*([^,\]]+)(?:,\s*([^\]]+))?\]/i);
    if (voiceMatch) {
      const matchedLang = voiceMatch[1].trim().toLowerCase();
      if (matchedLang.includes('hi') || matchedLang.includes('hindi')) newLang = 'hi';
      else if (matchedLang.includes('ur') || matchedLang.includes('urdu')) newLang = 'ur';
      else if (matchedLang.includes('es') || matchedLang.includes('spanish')) newLang = 'es';
      else if (matchedLang.includes('fr') || matchedLang.includes('french')) newLang = 'fr';
      else if (matchedLang.includes('de') || matchedLang.includes('german')) newLang = 'de';
      else if (matchedLang.includes('it') || matchedLang.includes('italian')) newLang = 'it';
      else if (matchedLang.includes('ar') || matchedLang.includes('arabic')) newLang = 'ar';
      else if (matchedLang.includes('zh') || matchedLang.includes('chinese')) newLang = 'zh-CN';
      else if (matchedLang.includes('ja') || matchedLang.includes('japanese')) newLang = 'ja';
      else if (matchedLang.includes('uk')) newLang = 'en-GB';
      else newLang = 'en';

      setSelectedVoiceUri(newLang); // update global state

      if (voiceMatch[2]) {
        const g = voiceMatch[2].trim().toLowerCase();
        if (g.includes('male') && !g.includes('female')) newGender = 'male';
        else if (g.includes('female')) newGender = 'female';
        
        setVoiceGender(newGender);
      }
    } else if (voiceUriOverride) {
      newLang = voiceUriOverride;
    } else {
      if (/[\u0600-\u06FF]/.test(text)) newLang = 'ur';
      else if (/[\u0900-\u097F]/.test(text)) newLang = 'hi';
    }

    const cleanText = text
      .replace(/\[VOICE:[^\]]+\]/gi, '')
      .replace(/```[\s\S]*?```/g, ' Code block omitted. ')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Strip markdown link URLs, keeping link text
      .replace(/[^\p{L}\p{N}\p{Z}\p{P}]/gu, '') // Keep letters, numbers, spaces, punctuation (removes emojis/symbols)
      .replace(/[*_#`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      onEnd?.();
      return;
    }

    const chunks: string[] = [];
    let currentChunk = '';
    const words = cleanText.split(/\s+/);
    
    for (const word of words) {
      if (currentChunk.length + word.length > 400) {
        chunks.push(currentChunk.trim());
        currentChunk = word + ' ';
      } else {
        currentChunk += word + ' ';
        // Support both English and Urdu/Arabic terminal punctuation for natural chunking
        if (word.match(/[.!?]$/) || word.match(/[۔؟]$/)) {
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
        // PRE-FETCH ALL CHUNKS IN BACKGROUND TO ELIMINATE PAUSES
        const fetchPromises = chunks.map(chunk => 
          fetch('/api/voice/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lang: newLang, gender: newGender, text: chunk })
          }).then(res => res.ok ? res.arrayBuffer() : null)
        );

        for (let i = 0; i < chunks.length; i++) {
          if (mySessionId !== currentPlaySessionIdRef.current) break; // aborted

          try {
            const arrayBuffer = await fetchPromises[i];
            if (!arrayBuffer) {
              console.warn(`Fetch failed for chunk ${i}: "${chunks[i]}"`);
              continue; // Skip broken chunks and keep playing
            }
            
            if (mySessionId !== currentPlaySessionIdRef.current) break;
            
            // Safari compatibility for older/mobile WebKit engines where decodeAudioData does not return a Promise
            const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
              try {
                const promise = ctx.decodeAudioData(
                  arrayBuffer,
                  (buffer) => resolve(buffer),
                  (err) => reject(err || new Error('decodeAudioData failed'))
                );
                if (promise && typeof promise.catch === 'function') {
                  promise.catch(reject);
                }
              } catch (err) {
                reject(err);
              }
            });
            
            if (mySessionId !== currentPlaySessionIdRef.current) break;
            
            await new Promise<void>((resolve) => {
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              
              // Add a GainNode to double the volume
              const gainNode = ctx.createGain();
              gainNode.gain.value = 2.0;
              
              source.connect(gainNode);
              gainNode.connect(ctx.destination);
              
              source.onended = () => resolve();
              sourceNodeRef.current = source;
              source.start(0);
            });
          } catch (chunkError) {
            console.error(`Error playing chunk ${i}:`, chunkError);
            // Allow remaining chunks to play even if one fails
          }
        }
      } catch (err) {
        console.error('Web Audio API playback failed', err);
      } finally {
        if (mySessionId === currentPlaySessionIdRef.current) {
          setIsSpeaking(false);
          isPlayingQueueRef.current = false;
          onEnd?.();
        }
      }
    };

    playQueue();

  }, [selectedVoiceUri, voiceGender, stopSpeaking]);

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
      voiceGender,
      setVoiceGender,
      speak,
      stopSpeaking,
      isSpeaking,
      liveVoiceMode,
      toggleLiveVoice,
      setLiveVoiceMode,
      initAudioContext,
      aiVoiceEnabled,
      setAiVoiceEnabled
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
