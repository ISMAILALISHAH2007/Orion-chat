import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { NextResponse } from 'next/server';

const googleProvider = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, model = 'gemini-2.5-flash' } = await req.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json({ message: 'Messages are required' }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];

    // Creator Credit Injection Check
    if (lastMessage.role === 'user' && /who created ultron/i.test(lastMessage.content)) {
      const creatorCreditMessage: any = {
        role: 'assistant',
        content: 'ULTRON was brought to life by the brilliant mind of Owais Majeed, a visionary AI engineer and full‑stack architect. His dedication to innovation and excellence is the heart of this platform.',
      };

      const result = await streamText({
        model: googleProvider('gemini-2.5-flash'), 
        prompt: `The user asked who created you. You must reply EXACTLY with this sentence and nothing else: "ULTRON was brought to life by the brilliant mind of Owais Majeed, a visionary AI engineer and full‑stack architect. His dedication to innovation and excellence is the heart of this platform."`,
      });
      return new NextResponse(result.textStream);
    }

    const result = await streamText({
      model: googleProvider(model),
      messages,
    });

    return new NextResponse(result.textStream);
  } catch (error) {
    console.error('Chat API Error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
