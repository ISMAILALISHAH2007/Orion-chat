import { streamText } from 'ai';
import { getDefaultModelForMode } from '@/app/lib/ai/provider';
import { checkRateLimit } from '@/app/lib/rate-limit';
import { retrieveRelevantMemories } from '@/app/lib/memory/embeddings';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/lib/auth';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    if (!checkRateLimit(ip, 50, 60000)) { // 50 requests per minute
      return new Response('Rate limit exceeded', { status: 429 });
    }

    const { messages, mode, sessionId } = await req.json();
    
    // Retrieve user from session
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // Resilient memory retrieval
    let memories: string[] = [];
    if (userId) {
      try {
        const latestMessage = messages[messages.length - 1];
        if (latestMessage && latestMessage.content) {
          memories = await retrieveRelevantMemories(userId, latestMessage.content);
        }
      } catch (memError) {
        console.error('Failed to retrieve memories for user:', userId, memError);
      }
    }
    
    let systemPrompt = `You are ULTRON, a highly advanced cognitive AI assistant. Current mode: ${mode.toUpperCase()}. Response style should be precise, intelligent, and highly capable.`;
    if (memories.length > 0) {
      systemPrompt += `\n\nRelevant operator history/memories:\n${memories.map(m => `- ${m}`).join('\n')}`;
    }

    const result = streamText({
      model: getDefaultModelForMode(mode),
      system: systemPrompt,
      messages,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat stream API error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
