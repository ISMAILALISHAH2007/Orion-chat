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
        // Keep track of the highest volume seen so we can dynamically calculate silence
        let maxSeenVol = 0;

        const checkSilence = () => {
          if (mediaRecorder.state !== 'recording') return;
          
          analyser.getByteFrequencyData(dataArray);
          const maxVol = Math.max(...Array.from(dataArray));
          
          if (maxVol > maxSeenVol) maxSeenVol = maxVol;

          // If volume is low compared to max seen (or very low absolutely)
          const isSilent = maxVol < 30 || (maxSeenVol > 100 && maxVol < maxSeenVol * 0.3);

          if (isSilent) {
            if (silenceStart === null) {
              silenceStart = Date.now();
            } else if (Date.now() - silenceStart > 1500) {
              clearInterval(checkInterval);
              mediaRecorder.stop();
              setIsRecording(false);
            }
          } else {
            silenceStart = null;
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
