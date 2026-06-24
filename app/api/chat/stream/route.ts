import { streamText } from 'ai';
import { getDefaultModelForMode } from '@/app/lib/ai/provider';
import { checkRateLimit } from '@/app/lib/rate-limit';
import { retrieveRelevantMemories } from '@/app/lib/memory/embeddings';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    if (!checkRateLimit(ip, 50, 60000)) { // 50 requests per minute
      return new Response('Rate limit exceeded', { status: 429 });
    }

    const { messages, mode, sessionId } = await req.json();
    
    // In a real app, retrieve user from session
    const userId = 'placeholder-user-id'; 

    // Retrieve memories relevant to the latest message
    const latestMessage = messages[messages.length - 1];
    const memories = await retrieveRelevantMemories(userId, latestMessage.content);
    
    let systemPrompt = `You are ULTRON, a highly advanced cognitive AI assistant. Current mode: ${mode.toUpperCase()}.`;
    if (memories.length > 0) {
      systemPrompt += `\n\nRelevant memories:\n${memories.map(m => `- ${m}`).join('\n')}`;
    }

    const result = streamText({
      model: getDefaultModelForMode(mode),
      system: systemPrompt,
      messages,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat stream error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
