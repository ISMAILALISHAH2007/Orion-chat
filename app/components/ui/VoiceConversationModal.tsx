'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Square, Volume2, Mic, Circle, Loader2 } from 'lucide-react';
import { useTTS } from '@/app/components/providers/TTSProvider';

type ConvState = 'listening' | 'processing' | 'speaking';

interface VoiceConversationModalProps {
  isOpen: boolean;
  onEndSession: () => void;
  sendMessage: (text: string) => void;
  isStreaming: boolean;
  latestAiResponse: string;
}

export default function VoiceConversationModal({
  isOpen,
  onEndSession,
  sendMessage,
  isStreaming,
  latestAiResponse,
}: VoiceConversationModalProps) {
  const [convState, setConvState] = useState<ConvState>('listening');
  const [lastTranscript, setLastTranscript] = useState('');
  const [spokenResponse, setSpokenResponse] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [history, setHistory] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([]);

  const recognitionRef = useRef<any>(null);
  const prevStreamingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const lastTranscriptRef = useRef('');
  const spokenResponseRef = useRef('');
  const shouldListenRef = useRef(false);
  const convStateRef = useRef<ConvState>('listening');

  // Keep refs in sync
  const { speak, stopSpeaking, isSpeaking, initAudioContext, selectedVoiceUri } = useTTS();
  const isSpeakingFromTts = useRef(false);

  // Map selectedVoiceUri to BCP-47 speech recognition language code
  const recognitionLanguage = (() => {
    if (selectedVoiceUri === 'ur') return 'ur-PK';
    if (selectedVoiceUri === 'hi') return 'hi-IN';
    if (selectedVoiceUri === 'zh-CN') return 'zh-CN';
    if (selectedVoiceUri === 'ja') return 'ja-JP';
    if (selectedVoiceUri === 'en-GB') return 'en-GB';
    if (selectedVoiceUri === 'ar') return 'ar-SA';
    if (selectedVoiceUri === 'es') return 'es-ES';
    if (selectedVoiceUri === 'fr') return 'fr-FR';
    if (selectedVoiceUri === 'de') return 'de-DE';
    if (selectedVoiceUri === 'it') return 'it-IT';
    return 'en-US';
  })();

  // Track isSpeaking
  useEffect(() => {
    isSpeakingFromTts.current = isSpeaking;
  }, [isSpeaking]);

  // ====== SPEECH RECOGNITION ======
  const buildRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.lang = recognitionLanguage;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    return recognition;
  }, [recognitionLanguage]);

  const startListening = useCallback(() => {
    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
      }
      const recognition = buildRecognition();
      if (!recognition) return;

      setConvState('listening');
      convStateRef.current = 'listening';
      shouldListenRef.current = true;
      setInterimTranscript('');

      recognition.onresult = (event: any) => {
        let final = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        if (final) lastTranscriptRef.current += final + ' ';
        const display = (lastTranscriptRef.current + interim).trim();
        setInterimTranscript(interim);
        if (display) setLastTranscript(display);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        console.error('Voice conv recognition error:', event.error);
      };

      recognition.onend = () => {
        const finalText = lastTranscriptRef.current.trim();
        lastTranscriptRef.current = '';
        setInterimTranscript('');

        if (finalText && shouldListenRef.current && convStateRef.current === 'listening') {
          // User spoke — send message
          setHistory((prev) => [...prev, { role: 'user', text: finalText }]);
          setConvState('processing');
          convStateRef.current = 'processing';
          // Brief delay to show the transcript before processing
          setTimeout(() => {
            if (shouldListenRef.current) {
              sendMessage(finalText);
            }
          }, 300);
        } else if (shouldListenRef.current && convStateRef.current === 'listening') {
          // No speech detected, restart listening
          setTimeout(() => {
            if (shouldListenRef.current && convStateRef.current === 'listening') {
              startListeningViaBuild();
            }
          }, 300);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start voice conv listening:', err);
    }
  }, [buildRecognition, sendMessage]);

  const startListeningViaBuild = useCallback(() => {
    try {
      const recognition = buildRecognition();
      if (!recognition) return;

      setConvState('listening');
      convStateRef.current = 'listening';
      setInterimTranscript('');

      recognition.onresult = (event: any) => {
        let final = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        if (final) lastTranscriptRef.current += final + ' ';
        const display = (lastTranscriptRef.current + interim).trim();
        setInterimTranscript(interim);
        if (display) setLastTranscript(display);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
      };

      recognition.onend = () => {
        const finalText = lastTranscriptRef.current.trim();
        lastTranscriptRef.current = '';
        setInterimTranscript('');

        if (finalText && shouldListenRef.current && convStateRef.current === 'listening') {
          setHistory((prev) => [...prev, { role: 'user', text: finalText }]);
          setConvState('processing');
          convStateRef.current = 'processing';
          setTimeout(() => {
            if (shouldListenRef.current) {
              sendMessage(finalText);
            }
          }, 300);
        } else if (shouldListenRef.current && convStateRef.current === 'listening') {
          setTimeout(() => {
            if (shouldListenRef.current && convStateRef.current === 'listening') {
              startListeningViaBuild();
            }
          }, 300);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to restart voice conv:', err);
    }
  }, [buildRecognition, sendMessage]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }
  }, []);

  // ====== HUMAN-LIKE VOICE SPEAKING ======
  const speakNaturally = useCallback((text: string, onDone?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      onDone?.();
      return;
    }

    // Use the provider's speak for consistency but we control the flow
    // The provider handles cleaning text and detecting language
    speak(text, onDone);
  }, [speak]);

  // ====== RESPONSE SPEAKING ======
  useEffect(() => {
    if (!isOpen) return;
    // Detect when streaming finishes
    if (prevStreamingRef.current && !isStreaming) {
      const text = latestAiResponse;
      if (text && convStateRef.current === 'processing' && shouldListenRef.current) {
        setSpokenResponse(text);
        spokenResponseRef.current = text;
        setHistory((prev) => [...prev, { role: 'ai', text }]);
        setConvState('speaking');
        convStateRef.current = 'speaking';

        initAudioContext();
        // Speak the response naturally, then listen again
        speakNaturally(text, () => {
          // When speaking finishes, auto-listen again
          if (shouldListenRef.current) {
            setTimeout(() => {
              if (shouldListenRef.current) {
                startListeningViaBuild();
              }
            }, 600); // Slightly longer pause before re-listening (human-like)
          }
        });
      }
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming, latestAiResponse, isOpen, initAudioContext, startListeningViaBuild, speakNaturally]);

  // ====== INTERRUPT ======
  const handleInterrupt = useCallback(() => {
    stopSpeaking();
    setConvState('listening');
    convStateRef.current = 'listening';
    // Start listening immediately
    setTimeout(() => startListeningViaBuild(), 200);
  }, [stopSpeaking, startListeningViaBuild]);

  // ====== END SESSION ======
  const handleEndSession = useCallback(() => {
    shouldListenRef.current = false;
    stopListening();
    stopSpeaking();
    setConvState('listening');
    onEndSession();
  }, [stopListening, stopSpeaking, onEndSession]);

  // ====== ESCAPE KEY ======
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleEndSession();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, handleEndSession]);

  // ====== OPEN / CLOSE ======
  useEffect(() => {
    if (isOpen) {
      setConvState('listening');
      convStateRef.current = 'listening';
      shouldListenRef.current = true;
      setLastTranscript('');
      setSpokenResponse('');
      setInterimTranscript('');
      setHistory([]);
      lastTranscriptRef.current = '';
      spokenResponseRef.current = '';

      // Start listening after a brief delay
      const timer = setTimeout(() => startListening(), 600);
      return () => {
        clearTimeout(timer);
        shouldListenRef.current = false;
        stopListening();
        stopSpeaking();
      };
    }
  }, [isOpen, startListening, stopListening, stopSpeaking]);

  if (!isOpen) return null;

  const lastUserText = history.filter((h) => h.role === 'user').slice(-1)[0]?.text || '';
  const lastAiText = history.filter((h) => h.role === 'ai').slice(-1)[0]?.text || '';

  return (
    <div className="voice-conv-overlay">
      {/* Background gradient */}
      <div className="voice-conv-bg" />

      {/* Content */}
      <div className="voice-conv-content">
        {/* Close button */}
        <button
          onClick={handleEndSession}
          className="voice-conv-close"
          title="End voice conversation"
        >
          <X size={20} />
        </button>

        {/* Status indicator */}
        <div className="voice-conv-status">
          {convState === 'listening' && (
            <div className="flex flex-col items-center gap-4">
              {/* Large animated listening orb */}
              <div className="voice-conv-orb listening">
                <div className="voice-conv-orb-inner">
                  <Mic size={32} className="text-white" />
                </div>
              </div>
              {/* Sound wave bars */}
              <div className="voice-conv-waves">
                <span className="voice-wave" />
                <span className="voice-wave" />
                <span className="voice-wave" />
                <span className="voice-wave" />
                <span className="voice-wave" />
              </div>
              <span className="voice-conv-status-text">Listening...</span>
            </div>
          )}

          {convState === 'processing' && (
            <div className="flex flex-col items-center gap-4">
              {/* Spinning gradient orb */}
              <div className="voice-conv-orb processing">
                <div className="voice-conv-orb-inner">
                  <Loader2 size={28} className="text-white animate-spin" />
                </div>
              </div>
              <span className="voice-conv-status-text">Thinking...</span>
            </div>
          )}

          {convState === 'speaking' && (
            <div className="flex flex-col items-center gap-4">
              {/* Speaking orb with sound bars */}
              <div className="voice-conv-orb speaking">
                <div className="voice-conv-orb-inner">
                  <Volume2 size={28} className="text-white" />
                </div>
              </div>
              {/* Speaking sound bars */}
              <div className="voice-conv-waves speaking">
                <span className="voice-wave speak" />
                <span className="voice-wave speak" />
                <span className="voice-wave speak" />
                <span className="voice-wave speak" />
                <span className="voice-wave speak" />
              </div>
              <span className="voice-conv-status-text">ULTRON is speaking...</span>
            </div>
          )}
        </div>

        {/* Transcript display */}
        <div className="voice-conv-transcript-area">
          {convState === 'listening' && lastTranscript && (
            <div className="voice-conv-transcript-item user">
              <span className="voice-conv-label">YOU</span>
              <p className="voice-conv-text">
                {lastTranscript}
                {interimTranscript && (
                  <span className="voice-conv-interim">{interimTranscript}</span>
                )}
              </p>
            </div>
          )}

          {convState === 'processing' && lastUserText && (
            <div className="voice-conv-transcript-item user sent">
              <span className="voice-conv-label">YOU SAID</span>
              <p className="voice-conv-text">{lastUserText}</p>
            </div>
          )}

          {spokenResponse && (
            <div className="voice-conv-transcript-item ai">
              <span className="voice-conv-label">ULTRON</span>
              <p className="voice-conv-text">{spokenResponse}</p>
            </div>
          )}

          {/* Show history count */}
          {history.filter(h => h.role === 'ai').length > 0 && (
            <div className="voice-conv-turn-count">
              {history.filter(h => h.role === 'ai').length} exchanges so far
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="voice-conv-controls">
          {convState === 'speaking' && (
            <button
              onClick={handleInterrupt}
              className="voice-conv-btn interrupt"
            >
              <Square size={16} />
              <span>Interrupt</span>
            </button>
          )}

          <button
            onClick={handleEndSession}
            className="voice-conv-btn end"
          >
            <Circle size={16} />
            <span>End Session</span>
          </button>
        </div>
      </div>
    </div>
  );
}
