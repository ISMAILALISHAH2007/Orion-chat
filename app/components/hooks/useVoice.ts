import { useState, useCallback, useRef, useEffect } from 'react';

export function useVoice() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not supported in this browser.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onstart = () => {
      setIsRecording(true);
    };

    rec.onend = () => {
      setIsRecording(false);
    };

    rec.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
    };

    rec.onresult = (event: any) => {
      const resultText = event.results[0]?.[0]?.transcript;
      if (resultText) {
        setTranscript(resultText);
      }
    };

    recognitionRef.current = rec;
  }, []);

  const toggleRecording = useCallback(() => {
    if (!recognitionRef.current) {
      console.warn('Voice recognition not available on this browser.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      setTranscript('');
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
  }, [isRecording]);

  return { isRecording, toggleRecording, transcript };
}
