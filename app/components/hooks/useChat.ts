import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useMode } from '@/app/components/providers/ThemeProvider';

export function useChat() {
  const { data: session } = useSession();
  const { mode } = useMode();
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; mode?: string }>>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [input, setInput] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setInput(e.target.value);

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

      try {
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...messages, { role: 'user', content: text }],
            sessionId: 'current',
            mode,
          }),
        });

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
    [session, messages, isStreaming, input, mode]
  );

  return { messages, input, handleInputChange, sendMessage, isStreaming };
}
