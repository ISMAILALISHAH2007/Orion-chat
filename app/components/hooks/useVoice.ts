import { useState, useCallback, useRef, useEffect } from 'react';

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

export function useVoice(options?: { onSpeechEnd?: (text: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRecognition = w.SpeechRecognition ?? w.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not supported in this browser.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';

    let currentTranscript = '';

    rec.onstart = () => {
      currentTranscript = '';
      setIsRecording(true);
    };

    rec.onend = () => {
      setIsRecording(false);
      if (optionsRef.current?.onSpeechEnd && currentTranscript.trim()) {
        optionsRef.current.onSpeechEnd(currentTranscript);
      }
    };

    rec.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
    };

    rec.onresult = (event) => {
      const resultText = event.results[0]?.[0]?.transcript;
      if (resultText) {
        currentTranscript = resultText;
        setTranscript(resultText);
      }
    };

    recognitionRef.current = rec;
  }, []);

  const startRecording = useCallback(() => {
    if (!recognitionRef.current) return;
    setTranscript('');
    try {
      recognitionRef.current.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (err) {
      console.error('Failed to stop speech recognition:', err);
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return { isRecording, toggleRecording, startRecording, stopRecording, transcript };
}
