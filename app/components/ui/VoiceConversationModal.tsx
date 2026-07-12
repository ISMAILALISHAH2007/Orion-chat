'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Square, Volume2, Mic, Circle, Loader2, AlertCircle } from 'lucide-react';
import { AudioStreamer } from '@/app/lib/audio-streamer';

type ConvState = 'listening' | 'processing' | 'speaking';

interface VoiceConversationModalProps {
  isOpen: boolean;
  onEndSession: () => void;
  sendMessage: (text: string) => void;
  isStreaming: boolean;
  latestAiResponse: string;
  voiceGender?: 'male' | 'female';
  onSwitchVoice?: (gender: 'male' | 'female') => void;
}

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="voice-conv-overlay flex items-center justify-center p-4">
          <div className="bg-red-900/90 text-white p-6 rounded-2xl max-w-lg shadow-2xl border border-red-500 w-full relative z-50 overflow-hidden">
            <div className="flex items-center gap-3 mb-4 text-red-200">
              <AlertCircle size={28} />
              <h2 className="text-xl font-bold">Fatal React Crash Caught</h2>
            </div>
            <div className="bg-black/50 p-4 rounded-lg overflow-auto max-h-64 mb-6">
              <p className="font-mono text-sm text-red-300 break-words whitespace-pre-wrap">
                {this.state.error?.name}: {this.state.error?.message}
              </p>
              <p className="font-mono text-xs text-red-400/80 mt-2 break-words whitespace-pre-wrap">
                {this.state.error?.stack}
              </p>
            </div>
            <button onClick={() => window.location.reload()} className="w-full py-3 bg-red-600 hover:bg-red-500 font-bold rounded-lg transition-colors">
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function VoiceConversationModalInner({
  isOpen,
  onEndSession,
  sendMessage,
  isStreaming,
  latestAiResponse,
  voiceGender = 'female',
  onSwitchVoice,
}: VoiceConversationModalProps) {
  const [convState, setConvState] = useState<ConvState>('listening');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [turnCount, setTurnCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const streamerRef = useRef<AudioStreamer | null>(null);
  const sessionActiveRef = useRef(false);

  // Handle incoming Gemini messages
  const handleGeminiMessage = useCallback((msg: any) => {
    try {
      // Check for setupComplete
      if (msg.setupComplete) {
        console.log('Gemini Live Setup Complete');
        return;
      }

      // Check for serverContent
      if (msg.serverContent) {
        const { interrupted, turnComplete, modelTurn } = msg.serverContent;

        if (interrupted) {
          streamerRef.current?.interruptPlayback();
          setConvState('listening');
        }

        if (modelTurn) {
          setConvState('speaking');
          const parts = modelTurn.parts || [];
          for (const part of parts) {
            if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/pcm')) {
              streamerRef.current?.addPlaybackData(part.inlineData.data);
            }

            if (part.text) {
              setTranscript(prev => prev + part.text);
            }
          }
        }

        if (turnComplete) {
          setConvState('listening');
          setTurnCount(prev => prev + 1);
          setTranscript(''); // Clear transcript on turn complete
        }
      }
    } catch (err) {
      console.error('Error handling Gemini message:', err);
    }
  }, [onSwitchVoice]);

  // Initialize the stream and WebSocket
  const startLiveSession = useCallback(async () => {
    try {
      setErrorMessage(null);
      setConvState('processing');

      // 1. Fetch Token securely from backend
      const res = await fetch('/api/voice-token');
      if (!res.ok) {
        throw new Error('Failed to fetch voice token. Ensure GEMINI_API_KEY is in .env.local');
      }
      const data = await res.json();
      const token = data.token;

      // 2. Setup Audio Streamer
      const streamer = new AudioStreamer();
      streamerRef.current = streamer;

      // 3. Setup WebSocket directly to Gemini Bidi API
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const identityText = voiceGender === 'male' 
          ? 'You are currently adopting a MALE persona. When speaking in Urdu or Hindi, you MUST use grammatically correct MALE pronouns and verb endings (e.g. "main kar sakta hoon", "main ja raha hoon"). This is critical.'
          : 'You are currently adopting a FEMALE persona. When speaking in Urdu or Hindi, you MUST use grammatically correct FEMALE pronouns and verb endings (e.g. "main kar sakti hoon", "main ja rahi hoon"). This is critical.';

        const setupMsg = {
          setup: {
            model: "models/gemini-3.1-flash-live-preview",
            systemInstruction: {
              parts: [{
                text: `You are ULTRON, a highly advanced cognitive AI assistant. You are in LIVE VOICE mode. You must speak clearly, concisely, and conversationally. Do not use markdown. ${identityText} If the user speaks in English, reply in English. Be warm, natural, and helpful.`
              }]
            },
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: voiceGender === 'male' ? "Puck" : "Aoede" // Puck = Male, Aoede = Female
                  }
                }
              }
            }
          }
        };
        ws.send(JSON.stringify(setupMsg));
      };

      ws.onmessage = (event) => {
        if (!sessionActiveRef.current) return;
        
        try {
          if (event.data instanceof Blob) {
            const reader = new FileReader();
            reader.onload = () => {
              handleGeminiMessage(JSON.parse(reader.result as string));
            };
            reader.readAsText(event.data);
          } else {
            handleGeminiMessage(JSON.parse(event.data));
          }
        } catch (e) {
          console.error("Error parsing Gemini message", e);
        }
      };

      ws.onclose = (event) => {
        console.log("WebSocket closed", event.code, event.reason);
        if (sessionActiveRef.current) {
          setErrorMessage(`Connection to Gemini Live lost. Code: ${event.code} Reason: ${event.reason || 'Unknown'}`);
          setConvState('listening');
          // DO NOT call handleEndSession() here, so the modal stays open and the user can see the error!
        }
      };

      ws.onerror = (e) => {
        console.error("WebSocket Error", e);
        setErrorMessage('WebSocket connection error. See console for details.');
        setConvState('listening');
      };

      // 4. Start Microphone and Stream to WebSocket
      streamer.setOnAudioData((base64Pcm: string) => {
        if (ws.readyState === WebSocket.OPEN && sessionActiveRef.current) {
          ws.send(JSON.stringify({
            realtimeInput: {
              audio: {
                mimeType: "audio/pcm;rate=16000",
                data: base64Pcm
              }
            }
          }));
        }
      });

      await streamer.startRecording();
      setConvState('listening');

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to initialize live voice session.');
      setConvState('listening');
    }
  }, [voiceGender, handleGeminiMessage]);


  const stopAll = useCallback(() => {
    sessionActiveRef.current = false;
    if (streamerRef.current) {
      streamerRef.current.stopRecording();
      streamerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const handleEndSession = useCallback(() => {
    stopAll();
    onEndSession();
  }, [stopAll, onEndSession]);

  const handleInterrupt = useCallback(() => {
    // Send a client content to interrupt natively if possible, or just flush local queue
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
       // A client message forces the server to process new input and interrupt its playback
       wsRef.current.send(JSON.stringify({
         clientContent: {
           turns: [{
             role: "user",
             parts: [] // empty part can trigger an interrupt on some implementations
           }],
           turnComplete: true
         }
       }));
    }
    streamerRef.current?.interruptPlayback();
    setConvState('listening');
  }, []);

  // ====== INITIALIZATION ON OPEN ======
  useEffect(() => {
    if (isOpen) {
      sessionActiveRef.current = true;
      // eslint-disable-next-line
      setTranscript('');
      // eslint-disable-next-line
      setTurnCount(0);
      startLiveSession();
    } else {
      stopAll();
    }
    return () => {
      stopAll();
    };
  }, [isOpen, startLiveSession, stopAll]);



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

  if (!isOpen) return null;

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
              <div 
                className="voice-conv-orb listening cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                onClick={handleInterrupt}
                title="Tap to reset"
              >
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
              <div 
                className="voice-conv-orb processing cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                onClick={handleInterrupt}
                title="Tap to cancel and speak"
              >
                <div className="voice-conv-orb-inner">
                  <Loader2 size={28} className="text-white animate-spin" />
                </div>
              </div>
              <span className="voice-conv-status-text">Connecting to Ultron...</span>
            </div>
          )}

          {convState === 'speaking' && (
            <div className="flex flex-col items-center gap-4">
              {/* Speaking orb with sound bars */}
              <div 
                className="voice-conv-orb speaking cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                onClick={handleInterrupt}
                title="Tap to interrupt"
              >
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
              <span className="voice-conv-status-text">Ultron is speaking...</span>
            </div>
          )}
        </div>

        {/* Transcript display */}
        <div className="voice-conv-transcript-area">
          {transcript && (
            <div className="voice-conv-transcript-item ai animate-fade-in">
              <span className="voice-conv-label">ULTRON</span>
              <p className="voice-conv-text">{transcript}</p>
            </div>
          )}

          {/* Show history count */}
          {turnCount > 0 && (
            <div className="voice-conv-turn-count">
              {turnCount} exchanges so far
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

export default function VoiceConversationModal(props: VoiceConversationModalProps) {
  return (
    <ErrorBoundary>
      <VoiceConversationModalInner {...props} />
    </ErrorBoundary>
  );
}
