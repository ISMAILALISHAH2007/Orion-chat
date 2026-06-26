import { streamText } from 'ai';
import { getDefaultModelForMode } from '@/app/lib/ai/provider';
import { checkRateLimit } from '@/app/lib/rate-limit';
import { retrieveRelevantMemories } from '@/app/lib/memory/embeddings';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/db';
import { NextResponse } from 'next/server';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    if (!checkRateLimit(ip, 50, 60000)) {
      return new NextResponse('Rate limit exceeded', { status: 429 });
    }

    const { messages, mode, sessionId } = await req.json();
    
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!messages || messages.length === 0) {
      return new NextResponse('Messages are required', { status: 400 });
    }

    let activeSessionId = sessionId;

    // Create a new session if needed
    if (userId && (!activeSessionId || activeSessionId === 'current')) {
      const chatSession = await prisma.chatSession.create({
        data: {
          userId,
          mode: mode || 'casual',
          title: 'New Chat',
        },
      });
      activeSessionId = chatSession.id;
    }

    // Resilient memory retrieval
    let memories: string[] = [];
    if (userId) {
      try {
        const latestMessage = messages[messages.length - 1];
        if (latestMessage && latestMessage.content) {
          memories = await retrieveRelevantMemories(userId, latestMessage.content);
        }
      } catch (memError) {
        console.error('Failed to retrieve memories:', memError);
      }
    }
    
    let systemPrompt = `You are ULTRON, a highly advanced cognitive AI assistant. Current mode: ${mode.toUpperCase()}. Response style should be precise, intelligent, and highly capable.`;
    if (memories.length > 0) {
      systemPrompt += `\n\nRelevant operator history/memories:\n${memories.map(m => `- ${m}`).join('\n')}`;
    }

    const latestUserMessage = messages[messages.length - 1];

    const result = await streamText({
      model: getDefaultModelForMode(mode),
      system: systemPrompt,
      messages,
      async onFinish({ text }) {
        if (userId && activeSessionId && activeSessionId !== 'current') {
          try {
            // Save user message
            await prisma.message.create({
              data: {
                chatSessionId: activeSessionId,
                role: 'user',
                content: latestUserMessage.content,
              }
            });
            // Save assistant message
            await prisma.message.create({
              data: {
                chatSessionId: activeSessionId,
                role: 'assistant',
                content: text,
              }
            });
          } catch (e) {
            console.error('Error saving messages to DB:', e);
          }
        }
      }
    });

    // Return the text stream directly so the custom hook can parse it,
    // and include the session ID so the client can track it.
    return new NextResponse(result.textStream, {
      headers: {
        'x-session-id': activeSessionId || 'current',
      },
    });
  } catch (error) {
    console.error('Chat stream API error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
