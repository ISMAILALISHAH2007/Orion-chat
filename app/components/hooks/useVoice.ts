import { useState, useCallback, useRef, useEffect } from 'react';

export function useVoice(options?: { onSpeechEnd?: (text: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Set up VAD using native SpeechRecognition for flawless silence detection
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      let recognition: any = null;
      let checkInterval: any = null;
      let nativeVadActive = false;

      if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onend = () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
          }
        };
        try {
          recognition.start();
          nativeVadActive = true;
        } catch (e) {
          console.warn('Native VAD start failed (likely no user gesture). Using AudioContext fallback.');
        }
      } 
      
      // If SpeechRecognition isn't supported or failed to start, use AudioContext VAD
      if (!nativeVadActive) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        let silenceStart: number | null = null;
        let maxSeenVol = 0;
        let hasSpoken = false; // Track if the user has actually started speaking
        const startTime = Date.now();

        const checkSilence = () => {
          if (mediaRecorder.state !== 'recording') return;
          
          analyser.getByteFrequencyData(dataArray);
          const maxVol = Math.max(...Array.from(dataArray));
          
          if (maxVol > maxSeenVol) maxSeenVol = maxVol;

          // A higher threshold (e.g., 40) for absolute silence, 
          // or a dynamic drop (less than 30% of max volume if they were loud).
          const isSilent = maxVol < 40 || (maxSeenVol > 120 && maxVol < maxSeenVol * 0.3);

          if (!isSilent) {
            hasSpoken = true;
            silenceStart = null;
          } else {
            if (silenceStart === null) {
              silenceStart = Date.now();
            } else {
              const silenceDuration = Date.now() - silenceStart;
              const totalDuration = Date.now() - startTime;
              
              // If they haven't spoken yet, wait up to 10 seconds before giving up.
              // If they HAVE spoken, wait 2.5 seconds of silence before cutting them off.
              const timeoutThreshold = hasSpoken ? 2500 : 10000;
              
              if (silenceDuration > timeoutThreshold) {
                clearInterval(checkInterval);
                mediaRecorder.stop();
                setIsRecording(false);
              }
            }
          }
        };

        checkInterval = setInterval(checkSilence, 100);
      }

      mediaRecorder.onstop = async () => {
        if (checkInterval) clearInterval(checkInterval);
        if (recognition) {
          recognition.onend = null;
          recognition.stop();
        }
        setIsRecording(false);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Clean up stream
        stream.getTracks().forEach((track) => track.stop());

        if (audioBlob.size === 0) {
          console.warn('Audio blob is empty. Skipping STT.');
          setTranscript('No audio recorded.');
          setIsRecording(false);
          return;
        }

        // Process audio via backend STT
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        try {
          const response = await fetch('/api/voice/stt', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Failed to transcribe: ${response.statusText}`);
          }

          const data = await response.json();
          if (data.text) {
            setTranscript(data.text);
            optionsRef.current?.onSpeechEnd?.(data.text);
          }
        } catch (error) {
          console.error('Error sending audio to STT:', error);
          setTranscript('Error understanding audio.');
        } finally {
          // Add a safety catch to ensure state isn't stuck
          if (mediaRecorderRef.current?.state !== 'recording') {
            setIsRecording(false);
          }
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTranscript('');
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
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

  return { isRecording, toggleRecording, startRecording, stopRecording, transcript };
}
