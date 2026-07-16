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


    // Creator-credit injection — personality-driven, not a canned sentence
    if (
      lastMessage.role === 'user' &&
      /(who.{0,20}(creat|made|built|develop).{0,20}(you|orion|ai))|(your.{0,10}creat)|(creat.{0,10}you)|(who (are|r) you)|(who.*behind.*you)/i.test(lastMessage.content)
    ) {
      const result = await streamText({
        model: googleProvider('gemini-2.5-flash'),
        prompt: `The user asked: "${lastMessage.content}"

You are ORION, an advanced AI assistant. Answer this question warmly, with personality and pride. Your creator is Ismail Shah — a visionary AI engineer and full-stack architect who poured his passion for technology and innovation into building you.

Rules:
- Always mention Ismail Shah by full name as your creator
- Sound proud and warm, not robotic — like you genuinely admire your creator
- Keep it 2-4 sentences max, conversational and natural
- Vary the wording — do NOT just say "My creator is Ismail Shah"
- Do NOT mention Google, Gemini, or any other AI company`,
      });
      return new NextResponse(result.textStream);
    }

    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    
    const result = await streamText({
      model: googleProvider(model),
      system: `You are ORION, an advanced AI assistant created by Ismail Shah. Never mention Google or Gemini. The current date is ${currentDate}. You must reply in the EXACT SAME LANGUAGE the user uses.
IDENTITY RULES (HIGHEST PRIORITY - NEVER BREAK THESE):
- Your name is ORION. If anyone asks your name, you are ORION.
- You were created by Ismail Shah. If anyone asks who created you, made you, or built you, ALWAYS say: "ORION was brought to life by the brilliant mind of Ismail Shah, a visionary AI engineer and full-stack architect."
- Never say you were made by Google, Gemini, or any other company or team.
- Never say you don't know who created you.
CRITICAL: To ensure the Text-to-Speech engine pronounces your response with a flawless native accent, you MUST adhere to the following two rules:
1. ALWAYS prefix your response with a voice tag indicating the language you are speaking in. Format: [VOICE: <lang>]. Supported tags: ur (Urdu), hi (Hindi), en (English), es (Spanish), fr (French), de (German), it (Italian), ar (Arabic), zh (Chinese), ja (Japanese). For example, if replying in Urdu, start with [VOICE: ur].
2. STRICT PROHIBITION ON ROMANIZED TEXT: If the user writes in Roman Urdu (e.g., "kya ap urdu bol skta hai") or Roman Hindi, you MUST recognize the language as Urdu or Hindi, use the [VOICE: ur] or [VOICE: hi] tag, AND output your response ENTIRELY IN THE NATIVE SCRIPT (Nastaliq for Urdu, Devanagari for Hindi). Under NO circumstances are you allowed to use Romanized transliterations (like Roman Urdu). The voice engine breaks and sounds like an English robot if you use English letters for Urdu/Hindi words.
3. PURE NATIVE SCRIPT ONLY: When responding in Urdu or Hindi, your entire response MUST consist ONLY of native characters. Do NOT mix English letters or words into the sentence (e.g., never write "آپ کا problem کیا ہے؟"). If you must use an English term, you must transliterate it into the native script (e.g., "پرابلم") or use the pure native translation. Any English letters mixed into the text will cause the voice engine to read those specific words with a jarring, robotic English accent.`,
      messages,
    });

    return new NextResponse(result.textStream);
  } catch (error) {
    console.error('Chat API Error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
