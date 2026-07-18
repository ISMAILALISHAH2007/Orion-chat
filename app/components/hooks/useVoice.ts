import { useState, useCallback, useRef, useEffect } from 'react';

interface ISpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: ISpeechRecognitionEvent) => void;
  onerror: (event: ISpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

interface ISpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [key: number]: {
      isFinal: boolean;
      [key: number]: {
        transcript: string;
      };
    };
  };
}

interface ISpeechRecognitionErrorEvent {
  error: string;
}

export function useVoice(options?: { 
  language?: string; 
  onSpeechEnd?: (text: string) => void;
  continuous?: boolean; // If true, auto-restart listening after speech ends
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const optionsRef = useRef(options);
  const finalTranscriptRef = useRef('');
  const shouldRestartRef = useRef(false);
  const startRecordingViaBuildRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Core recognition setup - builds a SpeechRecognition instance with all handlers
  const buildRecognition = useCallback((resetState: boolean) => {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => ISpeechRecognition; webkitSpeechRecognition?: new () => ISpeechRecognition }).SpeechRecognition || (window as unknown as { SpeechRecognition?: new () => ISpeechRecognition; webkitSpeechRecognition?: new () => ISpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    
    // Map language to BCP-47 code
    let langCode = 'en-US';
    const userLang = optionsRef.current?.language?.toLowerCase() || '';
    if (userLang.includes('ur')) langCode = 'ur-PK';
    else if (userLang.includes('hi')) langCode = 'hi-IN';
    else if (userLang.includes('es')) langCode = 'es-ES';
    else if (userLang.includes('fr')) langCode = 'fr-FR';
    else if (userLang.includes('de')) langCode = 'de-DE';
    else if (userLang.includes('ar')) langCode = 'ar-SA';
    else if (userLang.includes('zh')) langCode = 'zh-CN';
    else if (userLang.includes('uk')) langCode = 'en-GB';

    const recognition = new SpeechRecognition();
    recognition.lang = langCode;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    return recognition;
  }, []);

  // Internal start for auto-restart (shorter, skips error state reset)
  const startRecordingViaBuild = useCallback(() => {
    try {
      const recognition = buildRecognition(false);
      if (!recognition) return;

      finalTranscriptRef.current = '';
      setIsRecording(true);

      recognition.onresult = (event: ISpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalSegment = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalSegment += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        if (finalSegment) finalTranscriptRef.current += finalSegment + ' ';
        setTranscript((finalTranscriptRef.current + interimTranscript).trim());
      };

      recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        console.error('Recognition error:', event.error);
      };

      recognition.onend = () => {
        setIsRecording(false);
        const finalText = finalTranscriptRef.current.trim();
        if (finalText) {
          setTimeout(() => optionsRef.current?.onSpeechEnd?.(finalText), 100);
        }
        if (shouldRestartRef.current) {
          setTimeout(() => { if (shouldRestartRef.current) startRecordingViaBuildRef.current?.(); }, 400);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to restart recording:', err);
      setIsRecording(false);
    }
  }, [buildRecognition]);

  // Keep ref up to date
  useEffect(() => {
    startRecordingViaBuildRef.current = startRecordingViaBuild;
  }, [startRecordingViaBuild]);

  const startRecording = useCallback(() => {
    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }

      const recognition = buildRecognition(true);
      if (!recognition) {
        setTranscript('Error: Your browser does not support native speech recognition. Please use Google Chrome or Safari.');
        return;
      }

      finalTranscriptRef.current = '';
      setTranscript('');
      setVoiceError(null);
      setIsRecording(true);

      recognition.onresult = (event: ISpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalSegment = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalSegment += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        if (finalSegment) finalTranscriptRef.current += finalSegment + ' ';
        setTranscript((finalTranscriptRef.current + interimTranscript).trim());
      };

      recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
        console.error('Speech Recognition Error:', event.error);
        if (event.error === 'no-speech') return;
        let userMessage = `Error: ${event.error}`;
        if (event.error === 'service-not-allowed') userMessage = 'Speech recognition service not allowed on Safari/iOS. Please go to your iPhone Settings > Privacy & Security > Speech Recognition, toggle Safari ON.';
        else if (event.error === 'not-allowed') userMessage = 'Microphone access denied. Please tap the settings icon in your browser address bar and change Microphone permission to "Allow".';
        else if (event.error === 'network') userMessage = 'Speech recognition failed due to a network issue. Please check your internet connection.';
        else if (event.error === 'language-not-supported') userMessage = 'The selected language is not supported by your device for native voice recognition.';
        setTranscript(userMessage);
        setVoiceError(userMessage);
      };

      recognition.onend = () => {
        setIsRecording(false);
        const finalText = finalTranscriptRef.current.trim();
        if (finalText) {
          setTimeout(() => optionsRef.current?.onSpeechEnd?.(finalText), 100);
        } else {
          setTranscript('');
        }
        // Auto-restart for continuous conversation mode
        if (shouldRestartRef.current) {
          setTimeout(() => {
            if (shouldRestartRef.current) startRecordingViaBuildRef.current?.();
          }, 400);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start recording:', err);
      setIsRecording(false);
    }
  }, [buildRecognition]);

  const stopRecording = useCallback(() => {
    shouldRestartRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Enable/disable continuous conversation mode
  const setContinuousMode = useCallback((enabled: boolean) => {
    shouldRestartRef.current = enabled;
    if (!enabled && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
  }, []);

  return { isRecording, toggleRecording, startRecording, stopRecording, transcript, voiceError, setVoiceError, setContinuousMode };
}
