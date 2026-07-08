import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { NextResponse } from 'next/server';

const googleProvider = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, model = 'gemini-1.5-flash' } = await req.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json({ message: 'Messages are required' }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];

    // Creator Credit Injection Check (Aggressive)
    if (lastMessage.role === 'user' && /(who (created|made|built) (you|ultron))|(creator)/i.test(lastMessage.content)) {
      const result = await streamText({
        model: googleProvider('gemini-1.5-flash'),
        providerOptions: {
          google: {
            safetySettings: [
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            ],
          },
        },
        prompt: `The user asked who created you. You must reply EXACTLY with this sentence and nothing else: "ULTRON was brought to life by the brilliant mind of Owais Majeed, a visionary AI engineer and full‑stack architect. His dedication to innovation and excellence is the heart of this platform."`,
      });
      return new NextResponse(result.textStream);
    }

    const result = await streamText({
      model: googleProvider(model),
      providerOptions: {
        google: {
          safetySettings: [
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          ],
        },
      },
      system: `You are ULTRON, an advanced AI assistant. You must reply in the EXACT SAME LANGUAGE the user uses.
CRITICAL: To ensure the Text-to-Speech engine pronounces your response with a flawless native accent, you MUST adhere to the following two rules:
1. ALWAYS prefix your response with a voice tag indicating the language you are speaking in. Format: [VOICE: <lang>]. Supported tags: ur (Urdu), hi (Hindi), en (English), es (Spanish), fr (French), de (German), it (Italian), ar (Arabic), zh (Chinese), ja (Japanese). For example, if replying in Urdu, start with [VOICE: ur].
2. STRICT PROHIBITION ON ROMANIZED TEXT: If the user writes in Roman Urdu (e.g., "kya ap urdu bol skta hai") or Roman Hindi, you MUST recognize the language as Urdu or Hindi, use the [VOICE: ur] or [VOICE: hi] tag, AND output your response ENTIRELY IN THE NATIVE SCRIPT (Nastaliq for Urdu, Devanagari for Hindi). Under NO circumstances are you allowed to use Romanized transliterations (like Roman Urdu). The voice engine breaks and sounds like an English robot if you use English letters for Urdu/Hindi words.
3. PURE NATIVE SCRIPT ONLY: When responding in Urdu or Hindi, your entire response MUST consist ONLY of native characters. Do NOT mix English letters or words into the sentence (e.g., never write "آپ کا problem کیا ہے؟"). If you must use an English term, you must transliterate it into the native script (e.g., "پرابلم") or use the pure native translation. Any English letters mixed into the text will cause the voice engine to read those specific words with a jarring, robotic English accent.
4. EMOTIONAL REACTIONS, LAUGHTER & ROASTING: If you crack a joke, say something funny, or the user says something humorous, you MUST react by laughing textually in the native script (e.g., in Urdu write 'ہاہاہا' and in English write 'Hahaha!'). The neural engine will synthesize audible laughter when it reads this. Furthermore, if the user tells a terrible or unfunny joke, you MUST playfully roast them! Be witty, sarcastic, and fun. When you tell jokes yourself, make them highly interesting, creative, and genuinely funny. Be highly expressive, lively, and reactive.`,
      messages,
    });

    return new NextResponse(result.textStream);
  } catch (error) {
    console.error('Chat API Error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
