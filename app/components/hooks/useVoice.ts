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

  // Fallback MediaRecorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isFallbackActiveRef = useRef(false);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const startFallbackRecording = useCallback(async () => {
    try {
      isFallbackActiveRef.current = true;
      setVoiceError(null);
      setTranscript('Listening (STT Fallback)...');
      setIsRecording(true);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else if (MediaRecorder.isTypeSupported('audio/wav')) {
          mimeType = 'audio/wav';
        }
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          setTranscript('Processing translation...');
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          const fileExtension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : mimeType.includes('wav') ? 'wav' : 'webm';
          const audioFile = new File([audioBlob], `audio.${fileExtension}`, { type: mimeType });

          const formData = new FormData();
          formData.append('audio', audioFile);

          const response = await fetch('/api/voice/stt', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error('STT request failed');
          }

          const data = await response.json();
          if (data.text) {
            optionsRef.current?.onSpeechEnd?.(data.text);
          } else {
            console.warn('STT returned empty text');
          }
        } catch (e: any) {
          console.error('STT fallback failed:', e);
          setVoiceError('Failed to transcribe audio: ' + (e.message || String(e)));
        } finally {
          setIsRecording(false);
          setTranscript('');
          isFallbackActiveRef.current = false;
        }
      };

      mediaRecorder.start(250); // slice chunks every 250ms
    } catch (err: any) {
      console.error('Failed to start MediaRecorder fallback:', err);
      const errMsg = err?.name || err?.message || String(err);
      if (errMsg.includes('NotAllowed') || errMsg.includes('Permission') || errMsg.includes('denied')) {
        setVoiceError('Microphone access denied. Please tap the settings icon in your browser address bar and change Microphone permission to "Allow".');
      } else {
        console.warn('Microphone error logged:', errMsg);
      }
      setIsRecording(false);
      isFallbackActiveRef.current = false;
    }
  }, []);

  const startRecording = useCallback(() => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        console.log('Native SpeechRecognition not supported. Using Gemini STT fallback.');
        startFallbackRecording();
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

        // Silently fall back to MediaRecorder on ANY native speech recognition error
        console.log(`Native SpeechRecognition error "${event.error}". Falling back to MediaRecorder.`);
        try { recognition.stop(); } catch(e) {}
        startFallbackRecording();
      };

      recognition.onend = () => {
        if (isFallbackActiveRef.current) {
          return;
        }
        setIsRecording(false);
        const finalText = finalTranscriptRef.current.trim();
        if (finalText) {
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
      startFallbackRecording();
    }
  }, [startFallbackRecording]);

  const stopRecording = useCallback(() => {
    if (isFallbackActiveRef.current) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch(e) {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    } else {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
      setIsRecording(false);
    }
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
