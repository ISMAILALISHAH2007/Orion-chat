import { useState, useCallback, useRef } from 'react';

export function useVoice(options?: { onSpeechEnd?: (text: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

      // Voice Activity Detection (VAD) setup
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.minDecibels = -60;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let silenceStart: number | null = null;
      let checkInterval: any;

      const checkSilence = () => {
        if (mediaRecorder.state !== 'recording') return;
        
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        // If very quiet
        if (average < 10) {
          if (silenceStart === null) {
            silenceStart = Date.now();
          } else if (Date.now() - silenceStart > 1500) {
            // 1.5 seconds of silence detected, auto-stop
            clearInterval(checkInterval);
            mediaRecorder.stop();
          }
        } else {
          // Reset silence timer if noise is detected
          silenceStart = null;
        }
      };

      checkInterval = setInterval(checkSilence, 100);

      mediaRecorder.onstop = async () => {
        clearInterval(checkInterval);
        audioContext.close();
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
            options?.onSpeechEnd?.(data.text);
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
  }, [options]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
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

  return { isRecording, toggleRecording, startRecording, stopRecording, transcript };
}
