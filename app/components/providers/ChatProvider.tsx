'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useMode } from '@/app/components/providers/ThemeProvider';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTTS } from '@/app/components/providers/TTSProvider';

export type ChatSessionItem = {
  id: string;
  title: string;
  mode: string;
  updatedAt: string;
};

export type ChatAttachment = {
  url: string;
  mimeType: string;
  name: string;
};

export type ChatMessage = {
  sender: 'user' | 'ai';
  text: string;
  mode?: string;
  image?: boolean;
  attachments?: ChatAttachment[];
  isHidden?: boolean;
};

interface ChatContextType {
  messages: ChatMessage[];
  input: string;
  isStreaming: boolean;
  isResearching: boolean;
  sessionId: string;
  sessionsList: ChatSessionItem[];
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  startNewSession: () => void;
  loadSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  sendMessage: (textOrEvent?: string | React.FormEvent, attachments?: ChatAttachment[], options?: { isHidden?: boolean }) => Promise<void>;
  fetchSessionsList: () => Promise<void>;
  stop: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { mode } = useMode();
  const { selectedVoiceUri, voiceGender, voiceConversationOpen } = useTTS();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [input, setInput] = useState('');
  const [sessionId, setSessionIdState] = useState<string>('current');
  const [sessionsList, setSessionsList] = useState<ChatSessionItem[]>([]);
  const [hasFetchedSessions, setHasFetchedSessions] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasInitializedFromUrl = useRef(false);

  const setSessionId = useCallback((id: string) => {
    setSessionIdState(id);
    if (pathname === '/') {
      if (id === 'current') {
        window.history.replaceState(null, '', '/');
      } else {
        window.history.replaceState(null, '', `/?c=${id}`);
      }
    }
  }, [pathname]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setInput(e.target.value);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const fetchSessionsList = useCallback(async () => {
    if (!session?.user) return;
    try {
      const res = await fetch('/api/chat/history');
      if (res.ok) {
        const data = await res.json();
        setSessionsList(data.sessions || []);
        setHasFetchedSessions(true);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  }, [session]);

  // Initial fetch: wait until we know whether we're logged in, then fetch once.
  useEffect(() => {
    if (session?.user && !hasFetchedSessions) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot session bootstrap on auth state change
      void fetchSessionsList();
    }
  }, [session?.user, hasFetchedSessions, fetchSessionsList]);



  const startNewSession = useCallback(() => {
    stop();
    setSessionId('current');
    setMessages([]);
  }, [stop]);

  const loadSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/chat/history?sessionId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setSessionId(id);
        const mapped: ChatMessage[] = (data.messages || []).map((m: { role: string; content: string }) => ({
          sender: m.role === 'assistant' ? 'ai' : 'user',
          text: m.content,
          mode: data.mode,
        }));
        setMessages(mapped);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  }, [setSessionId]);

  // Sync from URL on mount
  useEffect(() => {
    const urlSessionId = searchParams.get('c');
    if (urlSessionId && !hasInitializedFromUrl.current && session?.user) {
      hasInitializedFromUrl.current = true;
      loadSession(urlSessionId);
    }
  }, [searchParams, session?.user, loadSession]);

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/chat/history?sessionId=${id}`, { method: 'DELETE' });
        if (res.ok) {
          setSessionsList((prev) => prev.filter((s) => s.id !== id));
          if (sessionId === id) {
            startNewSession();
          }
        }
      } catch (err) {
        console.error('Failed to delete session:', err);
      }
    },
    [sessionId, startNewSession]
  );

  const sendMessage = useCallback(
    async (textOrEvent?: string | React.FormEvent, attachments: ChatAttachment[] = [], options?: { isHidden?: boolean }) => {
      if (textOrEvent && typeof textOrEvent === 'object' && 'preventDefault' in textOrEvent) {
        textOrEvent.preventDefault();
      }

      const text = typeof textOrEvent === 'string' ? textOrEvent : input;
      if (!text.trim() && attachments.length === 0) return;
      if (isStreaming) return;

      setIsStreaming(true);
      setIsResearching(true);
      if (!options?.isHidden) setInput('');
      
      setMessages((prev) => [...prev, { sender: 'user', text, attachments, isHidden: options?.isHidden }]);
      
      abortControllerRef.current = new AbortController();

      const processAttachments = (msgText: string, atts: ChatAttachment[]) => {
        let finalString = msgText || 'Attached file';
        const finalImages: any[] = [];
        
        atts.forEach(att => {
          if (att.mimeType.startsWith('image/')) {
            finalImages.push({ type: 'image', image: att.url });
          } else if (att.mimeType === 'text/plain' && att.url.startsWith('data:text/plain;')) {
            try {
              const textData = att.url.split(',').slice(1).join(',');
              const decoded = decodeURIComponent(textData);
              finalString += '\n\n' + decoded;
            } catch (e) {
              console.error('Failed to decode text attachment', e);
            }
          }
        });

        if (finalImages.length > 0) {
          return [
            { type: 'text', text: finalString },
            ...finalImages
          ];
        }
        return finalString;
      };

      const payloadMessages = messages.map((m) => {
        if (m.sender === 'user' && m.attachments && m.attachments.length > 0) {
          return {
            role: 'user',
            content: processAttachments(m.text, m.attachments)
          };
        }
        return {
          role: m.sender === 'ai' ? 'assistant' : 'user',
          content: m.text,
        };
      });
      
      if (attachments && attachments.length > 0) {
        payloadMessages.push({
          role: 'user',
          content: processAttachments(text, attachments)
        });
      } else {
        payloadMessages.push({ role: 'user', content: text });
      }

      try {
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: payloadMessages,
            sessionId,
            mode,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            voiceLang: selectedVoiceUri,
            voiceGender: voiceGender,
            isVoiceMode: voiceConversationOpen,
          }),
          signal: abortControllerRef.current.signal,
        });

        const newSessionId = response.headers.get('x-session-id');
        let justCreated = false;
        if (newSessionId && newSessionId !== 'current') {
          if (sessionId === 'current') justCreated = true;
          setSessionId(newSessionId);
        }

        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          // Slash-command / image-intent response.
          const data = await response.json();
          const reply: ChatMessage = {
            sender: 'ai',
            text: data.text ?? '',
            mode,
            image: Boolean(data.image),
          };
          setMessages((prev) => [...prev, reply]);
          if (justCreated) {
            fetchSessionsList();
            setTimeout(fetchSessionsList, 3000);
          }
          if (reply.image) {
            window.dispatchEvent(new Event('images-updated'));
          }
          setIsResearching(false);
          return;
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          
          if (accumulated.length > 0) setIsResearching(false);

          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.sender === 'ai') {
              return [...prev.slice(0, -1), { ...last, text: accumulated }];
            } else {
              return [...prev, { sender: 'ai', text: accumulated, mode }];
            }
          });
        }

        if (justCreated) {
          fetchSessionsList();
          setTimeout(fetchSessionsList, 3000);
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Stream aborted by user');
        } else {
          console.error('Chat stream error:', error);
          setMessages((prev) => [
            ...prev,
            { sender: 'ai', text: '⚠️ Connection error.', mode: 'system' },
          ]);
        }
      } finally {
        setIsStreaming(false);
        setIsResearching(false);
        abortControllerRef.current = null;
      }
    },
    [messages, isStreaming, input, mode, sessionId, fetchSessionsList, setSessionId, selectedVoiceUri, voiceGender]
  );

  return (
    <ChatContext.Provider
      value={{
        messages,
        input,
        isStreaming,
        isResearching,
        sessionId,
        sessionsList,
        handleInputChange,
        setInput,
        startNewSession,
        loadSession,
        deleteSession,
        sendMessage,
        fetchSessionsList,
        stop,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}