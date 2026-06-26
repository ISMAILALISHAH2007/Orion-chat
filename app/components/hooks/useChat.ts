import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useMode } from '@/app/components/providers/ThemeProvider';

export function useChat() {
  const { data: session } = useSession();
  const { mode } = useMode();
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; mode?: string }>>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string>('current');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setInput(e.target.value);

  const startNewSession = useCallback(() => {
    setSessionId('current');
    setMessages([]);
  }, []);

  const loadSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/chat/history?sessionId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setSessionId(id);
        const mapped = data.messages.map((m: any) => ({
          sender: m.role === 'assistant' ? 'ai' : 'user',
          text: m.content,
          mode: data.mode
        }));
        setMessages(mapped);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  }, []);

  const sendMessage = useCallback(
    async (textOrEvent?: string | React.FormEvent) => {
      if (typeof textOrEvent === 'object' && textOrEvent.preventDefault) {
        textOrEvent.preventDefault();
      }
      
      const text = typeof textOrEvent === 'string' ? textOrEvent : input;
      if (!text.trim() || isStreaming) return;

      setIsStreaming(true);
      setInput('');
      setMessages((prev) => [...prev, { sender: 'user', text }]);

      // Map local messages to API structure for payload
      const payloadMessages = messages.map(m => ({
        role: m.sender === 'ai' ? 'assistant' : 'user',
        content: m.text
      }));
      payloadMessages.push({ role: 'user', content: text });

      try {
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: payloadMessages,
            sessionId,
            mode,
          }),
        });

        const newSessionId = response.headers.get('x-session-id');
        if (newSessionId && newSessionId !== 'current') {
          setSessionId(newSessionId);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.sender === 'ai') {
              return [...prev.slice(0, -1), { ...last, text: accumulated }];
            } else {
              return [...prev, { sender: 'ai', text: accumulated, mode }];
            }
          });
        }
      } catch (error) {
        console.error('Chat stream error:', error);
        setMessages((prev) => [...prev, { sender: 'ai', text: '⚠️ Connection error.', mode: 'system' }]);
      } finally {
        setIsStreaming(false);
      }
    },
    [session, messages, isStreaming, input, mode, sessionId]
  );

  // Initialize with latest session if none is loaded (optional auto-load logic)
  useEffect(() => {
    if (session?.user && sessionId === 'current' && messages.length === 0) {
      fetch('/api/chat/history')
        .then(res => res.json())
        .then(data => {
          if (data.sessions && data.sessions.length > 0) {
            loadSession(data.sessions[0].id);
          }
        })
        .catch(console.error);
    }
  }, [session, sessionId, messages.length, loadSession]);

  return { messages, input, handleInputChange, sendMessage, isStreaming, startNewSession, loadSession };
}
