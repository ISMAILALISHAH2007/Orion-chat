'use client';
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

export interface TTSVoice {
  uri: string;
  name: string;
  lang: string;
  voice: SpeechSynthesisVoice | null;
}

function findVoiceForLang(lang: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const exact = voices.find(v => v.lang.toLowerCase().startsWith(lang.toLowerCase()));
  if (exact) return exact;
  const baseLang = lang.split('-')[0].toLowerCase();
  const base = voices.find(v => v.lang.toLowerCase().startsWith(baseLang));
  if (base) return base;
  return voices.find(v => v.lang.startsWith('en')) || voices[0] || null;
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

// Clean text for natural speech — strip punctuation marks so TTS doesn't read them
function cleanTextForSpeech(text: string): string {
  return text
    .replace(/\[VOICE:[^\]]+\]/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_#`>|~]/g, '')
    // Remove standalone punctuation marks (not part of words, URLs, or numbers)
    .replace(/(?<!\w)[.,!?;:](?!\w)/g, '')
    // Remove multiple dots, colons, semicolons
    .replace(/[.:;]{2,}/g, '.')
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    .trim();
}

// Detect language from Unicode blocks
function detectLanguage(text: string): string {
  if (/[\u0600-\u06FF]/.test(text)) return 'ur';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN';
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja';
  if (/[\u0400-\u04FF]/.test(text)) return 'ru';
  return 'en';
}

function getVoiceCode(lang: string): string {
  if (lang === 'ur') return 'ur-PK';
  if (lang === 'hi') return 'hi-IN';
  if (lang === 'zh-CN') return 'zh-CN';
  if (lang === 'ja') return 'ja-JP';
  if (lang === 'en-GB') return 'en-GB';
  if (lang === 'ar') return 'ar-SA';
  if (lang === 'es') return 'es-ES';
  if (lang === 'fr') return 'fr-FR';
  if (lang === 'de') return 'de-DE';
  if (lang === 'it') return 'it-IT';
  return 'en-US';
}

interface TTSContextType {
  voices: TTSVoice[];
  selectedVoiceUri: string;
  setSelectedVoiceUri: (uri: string) => void;
  voiceGender: 'female' | 'male';
  setVoiceGender: (gender: 'female' | 'male') => void;
  speak: (text: string, onDone?: () => void) => void;
  stopSpeaking: () => void;
  isSpeaking: boolean;
  liveVoiceMode: boolean;
  setLiveVoiceMode: (mode: boolean) => void;
  initAudioContext: () => void;
  aiVoiceEnabled: boolean;
  setAiVoiceEnabled: (enabled: boolean) => void;
  voiceConversationOpen: boolean;
  setVoiceConversationOpen: (open: boolean) => void;
}

const TTSContext = createContext<TTSContextType | undefined>(undefined);

export function TTSProvider({ children }: { children: React.ReactNode }) {
  const voices = CLOUD_VOICES;
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>('en');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [liveVoiceMode, setLiveVoiceMode] = useState(false);
  const [aiVoiceEnabled, setAiVoiceEnabled] = useState(false);
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>('female');
  const [voiceConversationOpen, setVoiceConversationOpen] = useState(false);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const onDoneRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.addEventListener('voiceschanged', () => {}, { once: true });
    }
  }, []);

  const initAudioContext = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    onDoneRef.current = null;
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((text: string, onDone?: () => void) => {
    stopSpeaking();

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('SpeechSynthesis not available');
      return;
    }

    const cleanText = cleanTextForSpeech(text);
    if (!cleanText) {
      onDone?.();
      return;
    }

    const detectedLang = detectLanguage(cleanText);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    utterance.lang = getVoiceCode(detectedLang);
    
    const voice = findVoiceForLang(utterance.lang);
    if (voice) utterance.voice = voice;

    // Natural human-like speech settings
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utteranceRef.current = utterance;
    onDoneRef.current = onDone || null;

    const synthesis = window.speechSynthesis;

    // Chrome workaround: prevent 15s speech cutoff — create interval BEFORE speak()
    const checkInterval = setInterval(() => {
      if (!synthesis.speaking) {
        clearInterval(checkInterval);
      } else {
        synthesis.pause();
        synthesis.resume();
      }
    }, 10000);

    // Single onend handler that also cleans up the check interval
    utterance.onend = () => {
      clearInterval(checkInterval);
      setIsSpeaking(false);
      utteranceRef.current = null;
      const cb = onDoneRef.current;
      onDoneRef.current = null;
      cb?.();
    };

    utterance.onerror = (event) => {
      clearInterval(checkInterval);
      console.warn('SpeechSynthesis error:', event.error);
      setIsSpeaking(false);
      utteranceRef.current = null;
      const cb = onDoneRef.current;
      onDoneRef.current = null;
      
      if (event.error === 'voice-unavailable' || event.error === 'language-unavailable') {
        speakViaServer(cleanText, detectedLang, cb || undefined);
      } else {
        cb?.();
      }
    };

    utterance.onstart = () => setIsSpeaking(true);

    // Call speak() AFTER all handlers and interval are set up
    synthesis.speak(utterance);

  }, [stopSpeaking]);

  // Server-side TTS fallback via API
  const speakViaServer = async (text: string, lang: string, onDone?: () => void) => {
    try {
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: lang || 'en', gender: voiceGender, text })
      });
      if (!res.ok) throw new Error('Server TTS failed');
      
      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        onDone?.();
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        onDone?.();
      };
      await audio.play();
    } catch (err) {
      console.warn('Server TTS fallback failed:', err);
      setIsSpeaking(false);
      onDone?.();
    }
  };

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
      setLiveVoiceMode,
      initAudioContext,
      aiVoiceEnabled,
      setAiVoiceEnabled,
      voiceConversationOpen,
      setVoiceConversationOpen,
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
