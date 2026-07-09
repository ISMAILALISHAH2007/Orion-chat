import { useState, useCallback, useRef, useEffect } from 'react';

export function useVoice(options?: { 
  language?: string; 
  onSpeechEnd?: (text: string) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const optionsRef = useRef(options);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const startRecording = useCallback(() => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        setTranscript('Error: Your browser does not support native speech recognition. Please use Google Chrome or Safari.');
        return;
      }

      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }

      const recognition = new SpeechRecognition();
      
      // Map TTS voice URIs (e.g. ur, hi, en) to proper SpeechRecognition BCP-47 language codes
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

      recognition.lang = langCode;
      recognition.continuous = false; // Auto-stop when the user finishes their sentence
      recognition.interimResults = true; // Show text as they speak
      recognition.maxAlternatives = 1;

      finalTranscriptRef.current = '';
      setTranscript('');
      setVoiceError(null);
      setIsRecording(true);

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalSegment = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalSegment += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalSegment) {
          finalTranscriptRef.current += finalSegment + ' ';
        }
        
        setTranscript((finalTranscriptRef.current + interimTranscript).trim());
      };

      recognition.onerror = (event: any) => {
        console.error('Speech Recognition Error:', event.error);
        if (event.error === 'no-speech') {
          return;
        }

        let userMessage = `Error: ${event.error}`;
        if (event.error === 'service-not-allowed') {
          userMessage = 'Speech recognition service not allowed on Safari/iOS. Please go to your iPhone Settings > Privacy & Security > Speech Recognition, toggle Safari ON, and ensure Siri and Dictation are enabled in settings.';
        } else if (event.error === 'not-allowed') {
          userMessage = 'Microphone access denied. Please tap the settings icon in your browser address bar and change Microphone permission to "Allow".';
        } else if (event.error === 'network') {
          userMessage = 'Speech recognition failed due to a network issue. Please check your internet connection.';
        } else if (event.error === 'language-not-supported') {
          userMessage = 'The selected language is not supported by your device for native voice recognition.';
        }
        
        setTranscript(userMessage);
        setVoiceError(userMessage);
      };

      recognition.onend = () => {
        setIsRecording(false);
        const finalText = finalTranscriptRef.current.trim();
        if (finalText) {
          // Defer the callback to ensure state updates smoothly
          setTimeout(() => {
            optionsRef.current?.onSpeechEnd?.(finalText);
          }, 100);
        } else {
          setTranscript(''); // Clear UI if nothing was heard
        }
      };

      recognitionRef.current = recognition;
      recognition.start();

    } catch (err) {
      console.error('Failed to start native recording:', err);
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
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

  return { isRecording, toggleRecording, startRecording, stopRecording, transcript, voiceError, setVoiceError };
}
