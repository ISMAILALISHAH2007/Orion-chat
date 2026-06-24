import { useState, useCallback } from 'react';

export function useVoice() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');

  const toggleRecording = useCallback(() => {
    setIsRecording((prev) => !prev);
    // STUB: actual STT integration goes here
  }, []);

  return { isRecording, toggleRecording, transcript };
}
