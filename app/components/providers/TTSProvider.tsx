'use client';
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

export interface TTSVoice {
  uri: string;
  name: string;
  lang: string;
  voice: SpeechSynthesisVoice | null;
}

// Find a matching voice for a given language code
function findVoiceForLang(lang: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  
  // Try exact match first
  const exact = voices.find(v => v.lang.toLowerCase().startsWith(lang.toLowerCase()));
  if (exact) return exact;
  
  // Try base language match
  const baseLang = lang.split('-')[0].toLowerCase();
  const base = voices.find(v => v.lang.toLowerCase().startsWith(baseLang));
  if (base) return base;
  
  // Return any English voice as fallback
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

interface TTSContextType {
  voices: TTSVoice[];
  selectedVoiceUri: string;
  setSelectedVoiceUri: (uri: string) => void;
  voiceGender: 'female' | 'male';
  setVoiceGender: (gender: 'female' | 'male') => void;
  speak: (text: string) => void;
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

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Initialize speech synthesis and load voices
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    
    // Chrome loads voices asynchronously
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        // Force re-render by no-op state update
      }, { once: true });
    }
  }, []);

  const initAudioContext = useCallback(() => {
    // Just a no-op for SpeechSynthesis - no AudioContext needed
    // But kept for backwards compatibility
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      // Cancel any stale utterances
      window.speechSynthesis.cancel();
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    setIsSpeaking(false);
  }, []);

  // Clean text for natural speech
  const cleanTextForSpeech = (text: string): string => {
    return text
      .replace(/\[VOICE:[^\]]+\]/gi, '')
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
      .replace(/[*_#`>|~]/g, '') // Remove markdown formatting
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Auto-detect language code from text content
  const detectLanguage = (text: string): string => {
    if (/[\u0600-\u06FF]/.test(text)) return 'ur'; // Arabic/Urdu
    if (/[\u0900-\u097F]/.test(text)) return 'hi'; // Hindi
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN'; // Chinese
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja'; // Japanese
    if (/[\u0400-\u04FF]/.test(text)) return 'ru'; // Russian
    return selectedVoiceUri; // Default to selected voice
  };

  const speak = useCallback((text: string) => {
    // Stop any current speech
    stopSpeaking();

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('SpeechSynthesis not available in this browser');
      return;
    }

    const cleanText = cleanTextForSpeech(text);
    if (!cleanText) return;

    // Detect language from text content
    const detectedLang = detectLanguage(cleanText);

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Set language - try detected first, then selected
    utterance.lang = detectedLang === 'ur' ? 'ur-PK' 
      : detectedLang === 'hi' ? 'hi-IN'
      : detectedLang === 'zh-CN' ? 'zh-CN'
      : detectedLang === 'ja' ? 'ja-JP'
      : detectedLang === 'en-GB' ? 'en-GB'
      : 'en-US';

    // Find best matching voice
    const voice = findVoiceForLang(utterance.lang);
    if (voice) {
      utterance.voice = voice;
    }

    // Natural speech settings
    utterance.rate = 1.0; // Normal speed
    utterance.pitch = 1.0; // Normal pitch
    utterance.volume = 1.0;

    // Handle events
    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      utteranceRef.current = null;
    };

    utterance.onerror = (event) => {
      console.warn('SpeechSynthesis error:', event.error);
      setIsSpeaking(false);
      utteranceRef.current = null;
      
      // Fallback to server TTS if SpeechSynthesis fails
      if (event.error === 'voice-unavailable' || event.error === 'language-unavailable') {
        console.log('Falling back to server-side TTS...');
        speakViaServer(cleanText, detectedLang);
      }
    };

    utteranceRef.current = utterance;
    
    // Chrome has a bug where speech stops after ~15s. This workaround keeps it alive.
    const synthesis = window.speechSynthesis;
    synthesis.speak(utterance);

    // Chrome workaround: re-trigger speech if it gets stuck
    const checkInterval = setInterval(() => {
      if (!synthesis.speaking) {
        clearInterval(checkInterval);
      } else {
        synthesis.pause();
        synthesis.resume();
      }
    }, 10000);

    // Clean up interval when speech ends
    utterance.onend = () => {
      clearInterval(checkInterval);
      setIsSpeaking(false);
      utteranceRef.current = null;
    };

  }, [selectedVoiceUri, voiceGender, stopSpeaking]);

  // Fallback: use server-side TTS via API route
  const speakViaServer = async (text: string, lang: string) => {
    try {
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lang: lang || selectedVoiceUri, 
          gender: voiceGender, 
          text 
        })
      });
      
      if (!res.ok) throw new Error('Server TTS failed');
      
      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();
    } catch (err) {
      console.warn('Server TTS fallback also failed:', err);
      setIsSpeaking(false);
    }
  };

  const toggleLiveVoice = useCallback(() => {
    setLiveVoiceMode(prev => !prev);
  }, []);

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
