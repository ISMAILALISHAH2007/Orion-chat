'use client';
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

export interface TTSVoice {
  uri: string;
  name: string;
  lang: string;
  voice: SpeechSynthesisVoice | null;
}

function findVoiceForLang(lang: string, gender?: 'female' | 'male'): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const langLower = lang.toLowerCase();
  
  // Find matches for target lang
  const exact = voices.filter(v => v.lang.toLowerCase().startsWith(langLower));
  const baseLang = langLower.split('-')[0];
  const fallback = exact.length > 0 ? exact : voices.filter(v => v.lang.toLowerCase().startsWith(baseLang));
  
  const candidates = fallback.length > 0 ? fallback : voices.filter(v => v.lang.toLowerCase().startsWith('en'));
  const finalCandidates = candidates.length > 0 ? candidates : voices;
  
  if (gender) {
    const isFemale = gender === 'female';
    const femaleKeywords = ['female', 'zira', 'hazel', 'susan', 'karen', 'moira', 'tessa', 'veena', 'samantha', 'siri', 'elsa', 'serena', 'yating', 'ting-ting', 'sin-ji', 'google', 'natural'];
    const maleKeywords = ['male', 'david', 'mark', 'george', 'ravi', 'microsoft david', 'daniel', 'premium'];
    
    const sorted = [...finalCandidates].sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      
      const matchA = isFemale 
        ? (femaleKeywords.some(kw => nameA.includes(kw)) && !maleKeywords.some(kw => nameA.includes(kw)))
        : (maleKeywords.some(kw => nameA.includes(kw)) && !femaleKeywords.some(kw => nameA.includes(kw)));
        
      const matchB = isFemale
        ? (femaleKeywords.some(kw => nameB.includes(kw)) && !maleKeywords.some(kw => nameB.includes(kw)))
        : (maleKeywords.some(kw => nameB.includes(kw)) && !femaleKeywords.some(kw => nameB.includes(kw)));
        
      if (matchA && !matchB) return -1;
      if (!matchA && matchB) return 1;
      return 0;
    });
    
    return sorted[0] || null;
  }
  
  return finalCandidates[0] || null;
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

// Clean text for natural speech — strip reasoning, markdown, code, and punctuation so TTS doesn't read them
function cleanTextForSpeech(text: string): string {
  return text
    .replace(/\[VOICE:[^\]]+\]/gi, '')
    .replace(/\[REASONING\][\s\S]*?\[\/REASONING\]/gi, '')
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

// Detect if text is written in Romanized Urdu or Hindi to avoid English accent playback
function isRomanUrduHindi(text: string): boolean {
  const words = text.toLowerCase().split(/\s+/);
  const commonUrduHindiWords = new Set([
    'main', 'aap', 'tum', 'ho', 'hai', 'hain', 'kya', 'kaise', 'theek', 'haan', 'na', 
    'bhai', 'yaar', 'mujhe', 'mera', 'meri', 'apna', 'apni', 'kar', 'raha', 'rahi', 
    'gaya', 'gayi', 'acha', 'shukriya', 'aur', 'toh', 'se', 'ko', 'ki', 'ka', 'ke',
    'kuch', 'hote', 'hota', 'hoti', 'gaye', 'nahin', 'nahi', 'karo', 'karne', 'kiya',
    'diya', 'liya', 'rahe', 'sath', 'paas', 'baat', 'ab', 'tak', 'jab', 'kab', 'par',
    'hi', 'bhi', 'ek', 'do', 'teen', 'chaar', 'paanch', 'chah', 'saat', 'aath', 'nau', 'das'
  ]);
  
  let matches = 0;
  for (const word of words) {
    const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    if (commonUrduHindiWords.has(cleanWord)) {
      matches++;
    }
  }
  
  return matches >= 2 || (words.length > 0 && matches / words.length >= 0.25);
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onDoneRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.addEventListener('voiceschanged', () => {}, { once: true });
    }
  }, []);

  const initAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    // 1. Cancel SpeechSynthesis
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    // 2. Play a short silent sound to unlock Safari / iOS audio engine
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (context.state === 'suspended') {
        context.resume();
      }
      
      const buffer = context.createBuffer(1, 1, 22050);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start(0);
    } catch (e) {
      console.warn('AudioContext unlock failed:', e);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = '';
      } catch (_) {}
      audioRef.current = null;
    }
    utteranceRef.current = null;
    onDoneRef.current = null;
    setIsSpeaking(false);
  }, []);

  // Browser local TTS fallback
  const speakLocalFallback = useCallback((text: string, lang: string, onDone?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      onDone?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getVoiceCode(lang);
    const voice = findVoiceForLang(utterance.lang, voiceGender);
    if (voice) utterance.voice = voice;

    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utteranceRef.current = utterance;
    onDoneRef.current = onDone || null;

    const synthesis = window.speechSynthesis;
    
    const checkInterval = setInterval(() => {
      if (!synthesis.speaking) {
        clearInterval(checkInterval);
      } else {
        synthesis.pause();
        synthesis.resume();
      }
    }, 10000);

    utterance.onend = () => {
      clearInterval(checkInterval);
      setIsSpeaking(false);
      utteranceRef.current = null;
      const cb = onDoneRef.current;
      onDoneRef.current = null;
      cb?.();
    };

    utterance.onerror = () => {
      clearInterval(checkInterval);
      setIsSpeaking(false);
      utteranceRef.current = null;
      const cb = onDoneRef.current;
      onDoneRef.current = null;
      cb?.();
    };

    utterance.onstart = () => setIsSpeaking(true);
    synthesis.speak(utterance);
  }, [voiceGender]);

  // Server-side Edge TTS (primary speaking method for high quality neural voices)
  const speakViaServer = useCallback(async (text: string, lang: string, onDone?: () => void) => {
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
      audioRef.current = audio;
      
      audio.onplay = () => setIsSpeaking(true);
      
      const cleanup = () => {
        setIsSpeaking(false);
        try { URL.revokeObjectURL(audioUrl); } catch (_) {}
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
      };

      audio.onended = () => {
        cleanup();
        onDone?.();
      };
      
      audio.onerror = () => {
        cleanup();
        console.warn('Audio playback error, falling back to local SpeechSynthesis');
        speakLocalFallback(text, lang, onDone);
      };
      
      await audio.play();
    } catch (err) {
      console.warn('Server TTS failed, calling local fallback:', err);
      speakLocalFallback(text, lang, onDone);
    }
  }, [voiceGender, speakLocalFallback]);

  const speak = useCallback((text: string, onDone?: () => void) => {
    stopSpeaking();

    const cleanText = cleanTextForSpeech(text);
    if (!cleanText) {
      onDone?.();
      return;
    }

    let targetLang = selectedVoiceUri;
    const detectedLang = detectLanguage(cleanText);
    
    if (detectedLang !== 'en') {
      targetLang = detectedLang;
    } else if (isRomanUrduHindi(cleanText)) {
      // If Romanized Urdu/Hindi is detected, speak using the corresponding native accent
      targetLang = selectedVoiceUri === 'hi' ? 'hi' : 'ur';
    }

    // Try high-quality server-side Edge Neural TTS first!
    speakViaServer(cleanText, targetLang, onDone);
  }, [selectedVoiceUri, stopSpeaking, speakViaServer]);

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
