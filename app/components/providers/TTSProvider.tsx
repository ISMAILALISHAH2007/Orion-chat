'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface TTSVoice {
  uri: string;
  name: string;
  lang: string;
  voice: SpeechSynthesisVoice;
}

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
  const [voices, setVoices] = useState<TTSVoice[]>([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [liveVoiceMode, setLiveVoiceMode] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        const mapped = availableVoices.map(v => ({
          uri: v.voiceURI,
          name: v.name,
          lang: v.lang,
          voice: v,
        }));
        
        // Priority logic: sort Google voices first
        mapped.sort((a, b) => {
          const aGoogle = a.name.toLowerCase().includes('google');
          const bGoogle = b.name.toLowerCase().includes('google');
          if (aGoogle && !bGoogle) return -1;
          if (!aGoogle && bGoogle) return 1;
          return 0;
        });

        setVoices(mapped);
        
        // Set default voice if none selected
        setSelectedVoiceUri(prev => {
          if (!prev) {
            const googleEn = mapped.find(v => v.name.toLowerCase().includes('google') && v.lang.startsWith('en'));
            const anyEn = mapped.find(v => v.lang.startsWith('en'));
            return (googleEn || anyEn || mapped[0])?.uri || '';
          }
          return prev;
        });
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const speak = useCallback((text: string, voiceUriOverride?: string, onEnd?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    
    // Clean up text (remove markdown, special tags)
    const cleanText = text
      .replace(/\[VOICE:[^\]]+\]/gi, '')
      .replace(/```[\s\S]*?```/g, ' Code block omitted. ')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/[*_#`]/g, '');

    if (!cleanText.trim()) {
      onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    const uriToUse = voiceUriOverride || selectedVoiceUri;
    if (uriToUse) {
      // 1. Try exact URI
      let voice = voices.find(v => v.uri === uriToUse);
      // 2. Try Exact Lang (e.g., 'es-ES')
      if (!voice) voice = voices.find(v => v.lang.toLowerCase() === uriToUse.toLowerCase());
      // 3. Try Name Inclusion (e.g., 'Google français')
      if (!voice) voice = voices.find(v => v.name.toLowerCase().includes(uriToUse.toLowerCase()));
      // 4. Try Lang Prefix (e.g., 'es' for 'es-ES' or 'es-MX')
      if (!voice) voice = voices.find(v => v.lang.toLowerCase().startsWith(uriToUse.toLowerCase()));

      if (voice) {
        utterance.voice = voice.voice;
        utterance.lang = voice.lang;
      }
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      onEnd?.();
      // Clear the reference when done
      if (typeof window !== 'undefined') {
        (window as any).__tts_utterance = null;
      }
    };
    utterance.onerror = (e) => {
      console.error('TTS Error', e);
      setIsSpeaking(false);
      onEnd?.();
      if (typeof window !== 'undefined') {
        (window as any).__tts_utterance = null;
      }
    };

    // CRITICAL FIX: Prevent the browser's Garbage Collector from destroying 
    // the utterance object mid-speech, which causes onend to never fire
    // and permanently breaks the loop after ~3 uses.
    if (typeof window !== 'undefined') {
      (window as any).__tts_utterance = utterance;
    }

    window.speechSynthesis.speak(utterance);
  }, [selectedVoiceUri, voices]);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const toggleLiveVoice = useCallback(() => {
    setLiveVoiceMode(prev => {
      const next = !prev;
      if (!next && isSpeaking) {
        stopSpeaking();
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
