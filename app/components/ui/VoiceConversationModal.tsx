'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Square, Volume2, Mic, Circle, Loader2, AlertCircle } from 'lucide-react';
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const prevStreamingRef = useRef(false);
  const prevSpeakingRef = useRef(false);
  const lastTranscriptRef = useRef('');
  const spokenResponseRef = useRef('');
  const shouldListenRef = useRef(false);
  const convStateRef = useRef<ConvState>('listening');
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { speak, stopSpeaking, isSpeaking, initAudioContext, selectedVoiceUri } = useTTS();

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

  // ====== SPEECH RECOGNITION ======
  const startListening = useCallback(async () => {
    if (!shouldListenRef.current) return;

    try {
      // Clear any existing recognition sessions
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_) {}
        recognitionRef.current = null;
      }
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        setErrorMessage('Speech recognition is not supported in this browser. Please try using Chrome, Safari, or Edge.');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = recognitionLanguage;
      recognition.continuous = false; // continuous false works better on mobile for segmenting sentences
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

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
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access denied. Please click the mic icon in your address bar and allow permission.');
          shouldListenRef.current = false;
        }
      };

      recognition.onend = () => {
        const finalText = lastTranscriptRef.current.trim();
        lastTranscriptRef.current = '';
        setInterimTranscript('');

        if (finalText && shouldListenRef.current && convStateRef.current === 'listening') {
          // User spoke successfully
          setHistory((prev) => [...prev, { role: 'user', text: finalText }]);
          setConvState('processing');
          convStateRef.current = 'processing';
          
          setTimeout(() => {
            if (shouldListenRef.current) {
              sendMessage(finalText);
            }
          }, 300);
        } else if (shouldListenRef.current && convStateRef.current === 'listening') {
          // Restart listening if no speech was detected
          restartTimeoutRef.current = setTimeout(() => {
            if (shouldListenRef.current && convStateRef.current === 'listening') {
              startListening();
            }
          }, 300);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
    }
  }, [recognitionLanguage, sendMessage]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (_) {}
      recognitionRef.current = null;
    }
  }, []);

  // ====== STATE SYNCHRONIZATION & ANSWER PLAYBACK ======

  useEffect(() => {
    if (!isOpen) return;

    if (isSpeaking) {
      setConvState('speaking');
      convStateRef.current = 'speaking';
      
      // Clean and set spoken response text to display in real-time
      if (latestAiResponse) {
        const cleanText = latestAiResponse.replace(/\[REASONING\][\s\S]*?\[\/REASONING\]/gi, '').trim();
        const isSystem = cleanText.startsWith('[SYSTEM') || cleanText.startsWith('[SEARCH') || cleanText.startsWith('[MAPS');
        
        if (!isSystem && cleanText !== spokenResponseRef.current) {
          setSpokenResponse(cleanText);
          spokenResponseRef.current = cleanText;
          setHistory((prev) => {
            // Avoid duplicates
            const exists = prev.some(h => h.role === 'ai' && h.text === cleanText);
            if (exists) return prev;
            return [...prev, { role: 'ai', text: cleanText }];
          });
        }
      }
    } else if (isStreaming) {
      setConvState('processing');
      convStateRef.current = 'processing';
    } else {
      // Both isSpeaking and isStreaming are false -> transition back to listening if we were active
      const wasActive = prevSpeakingRef.current || prevStreamingRef.current;
      if (wasActive && convStateRef.current !== 'listening') {
        setConvState('listening');
        convStateRef.current = 'listening';
        
        const restartTimer = setTimeout(() => {
          if (shouldListenRef.current && convStateRef.current === 'listening') {
            startListening();
          }
        }, 600); // 600ms pause for natural conversational pacing
        return () => clearTimeout(restartTimer);
      }
    }

    prevSpeakingRef.current = isSpeaking;
    prevStreamingRef.current = isStreaming;
  }, [isSpeaking, isStreaming, isOpen, latestAiResponse, startListening]);

  // ====== INTERRUPT ======
  const handleInterrupt = useCallback(() => {
    stopSpeaking();
    setConvState('listening');
    convStateRef.current = 'listening';
    setTimeout(() => {
      if (shouldListenRef.current) {
        startListening();
      }
    }, 200);
  }, [stopSpeaking, startListening]);

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

  // ====== INITIALIZATION ON OPEN ======
  useEffect(() => {
    if (!isOpen) return;

    setConvState('listening');
    convStateRef.current = 'listening';
    shouldListenRef.current = true;
    setLastTranscript('');
    setSpokenResponse('');
    setInterimTranscript('');
    setHistory([]);
    setErrorMessage(null);
    lastTranscriptRef.current = '';
    spokenResponseRef.current = '';

    // Initialize/unlock Web Audio context (important for Safari/iOS)
    initAudioContext();

    const requestPermissionAndListen = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // close the stream tracks immediately
        
        if (shouldListenRef.current) {
          startListening();
        }
      } catch (err) {
        console.warn('Microphone access denied:', err);
        setErrorMessage('Microphone access denied. Please click the camera/microphone icon in your browser address bar to allow mic access.');
      }
    };

    // Wait a brief moment for modal transition to finish, then request permission and start
    const startTimer = setTimeout(requestPermissionAndListen, 400);

    return () => {
      clearTimeout(startTimer);
      shouldListenRef.current = false;
      stopListening();
      stopSpeaking();
    };
  }, [isOpen, startListening, stopListening, stopSpeaking, initAudioContext]);

  if (!isOpen) return null;

  const lastUserText = history.filter((h) => h.role === 'user').slice(-1)[0]?.text || '';

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

        {/* Error Message Display */}
        {errorMessage && (
          <div className="absolute top-16 left-6 right-6 z-20 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200 animate-fade-in max-w-lg mx-auto">
            <AlertCircle className="shrink-0 text-red-400 mt-0.5" size={18} />
            <div className="flex-1 space-y-1">
              <p className="font-semibold">Voice Mode Issue</p>
              <p className="text-xs text-red-300/95 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

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
            <div className="voice-conv-transcript-item ai animate-fade-in">
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
