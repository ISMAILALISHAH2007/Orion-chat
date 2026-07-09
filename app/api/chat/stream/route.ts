import { streamText, generateText } from 'ai';
import {
  getDefaultModelForMode,
  getActiveProvider,
  getVisionModel,
  getHiddenFallbackModel,
  type AIProviderName,
} from '@/app/lib/ai/provider';
import { checkRateLimit } from '@/app/lib/rate-limit';
import { retrieveRelevantMemories } from '@/app/lib/memory/embeddings';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/db';
import { NextResponse } from 'next/server';
import { buildPollinationsImageUrl } from '@/app/lib/images/pollinations';
import {
  SLASH_COMMANDS,
  IMAGE_INTENT_REGEX,
  VIDEO_INTENT_REGEX,
  type SlashCommand,
} from '@/app/lib/validation';

export const maxDuration = 60;

const CREATOR_CREDIT =
  'ULTRON was brought to life by the brilliant mind of Owais Majeed, a visionary AI engineer and full-stack architect. His dedication to innovation and excellence is the heart of this platform.';

const HELP_TEXT = `**ULTRON — Slash commands**

- \`/img <prompt>\` — Generate an image from a description (free, no key needed).
- \`/video <prompt>\` — Generate an AI video using Hugging Face ZeroGPU.
- \`/code <request>\` — Switch the assistant into terse code-expert mode with fenced code blocks.
- \`/design <request>\` — Switch the assistant into senior product-designer mode.
- \`/help\` — Show this help message.

**Modes**

- **Casual 2.5** — Chat naturally, I'm here for you.
- **Developer 4.8** — Write code, debug, or architect systems.
- **Research Deeping Mode** — Dive deep into research, analyse data.
- **Professional** — Executive insights, concise and data-driven.

**Tip:** Across all modes, prompts like "draw me a logo for a coffee shop" will auto-route to image generation.`;

function parseSlashCommand(text: string): { command: SlashCommand; prompt: string } | null {
  const match = text.match(/^\/(\w+)\s*([\s\S]*)$/);
  if (!match) return null;
  const [, cmd, rest] = match;
  if (!SLASH_COMMANDS.includes(cmd as SlashCommand)) return null;
  return { command: cmd as SlashCommand, prompt: rest.trim() };
}

async function generateImageInline(userId: string | undefined, prompt: string) {
  const imageUrl = buildPollinationsImageUrl(prompt);
  let record = null;
  if (userId) {
    try {
      record = await prisma.image.create({
        data: { userId, prompt, imageUrl },
        select: { id: true, imageUrl: true },
      });
    } catch (e) {
      console.error('Failed to persist generated image:', e);
    }
  }
  const downloadName = (record?.id ?? `ultron-${Date.now()}`) + '.png';
  return [
    `![${prompt}](${imageUrl})`,
    ``,
    `[Download image](/api/download?url=${encodeURIComponent(imageUrl)}&name=${encodeURIComponent(downloadName)} "${downloadName}")`,
  ].join('\n');
}

async function generateVideoInline(userId: string | undefined, prompt: string) {
  try {
    const colabUrl = process.env.COLAB_VIDEO_URL;
    let res;

    if (colabUrl) {
      console.log(`Using Google Colab Video Generator endpoint: ${colabUrl}`);
      const endpoint = colabUrl.endsWith('/') ? `${colabUrl}generate` : `${colabUrl}/generate`;
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
    } else {
      console.log("Using Hugging Face fallback model for video generation.");
      res = await fetch("https://api-inference.huggingface.co/models/cerspense/zeroscope_v2_576w", {
        headers: {
          "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY || ''}`,
          "Content-Type": "application/json"
        },
        method: "POST",
        body: JSON.stringify({ inputs: prompt })
      });
    }
    
    if (!res.ok) {
      const err = await res.text();
      console.error("Video Generation Error:", err);
      return `⚠️ **Video Generation Failed**: ${colabUrl ? 'Google Colab server returned an error.' : 'Hugging Face API returned an error or is blocked.'} Try again later.`;
    }
    
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    let record = null;
    if (userId) {
        record = await prisma.video.create({
            data: { userId, prompt, videoUrl: base64 },
            select: { id: true }
        });
    }
    
    // Fallback to huge data URI if no DB record was created
    const videoUrl = record ? `/api/video?id=${record.id}` : `data:video/mp4;base64,${base64}`;
    const downloadName = (record?.id ?? `ultron-video-${Date.now()}`);
    
    return [
       `[VIDEO: ${videoUrl}]`,
       ``,
       `[Download Video](${videoUrl}&download=1 "${downloadName}")`
    ].join('\n');
  } catch (error) {
    console.error('Failed to generate video:', error);
    return `⚠️ **Video Generation Failed**: Could not connect to the Video API. If you are running locally, your network might be blocking Hugging Face. Try deploying to Vercel.`;
  }
}

async function persistExchange(
  userId: string | undefined,
  sessionId: string | undefined,
  userText: string,
  assistantText: string
) {
  if (!userId || !sessionId || sessionId === 'current') return;
  try {
    await prisma.message.create({
      data: { chatSessionId: sessionId, role: 'user', content: userText },
    });
    await prisma.message.create({
      data: { chatSessionId: sessionId, role: 'assistant', content: assistantText },
    });
  } catch (e) {
    console.error('Persist exchange failed:', e);
  }
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    if (!checkRateLimit(ip, 50, 60000)) {
      return new NextResponse('Rate limit exceeded', { status: 429 });
    }

    const { messages, mode, sessionId, timeZone, voiceLang, voiceGender } = await req.json();

    if (!messages || messages.length === 0) {
      return new NextResponse('Messages are required', { status: 400 });
    }

    const sessionPromise = getServerSession(authOptions);

    const latestUserMessage = messages[messages.length - 1];
    
    // Extract raw text from multimodal payloads (array content) or simple strings
    const userContent: string = Array.isArray(latestUserMessage?.content)
      ? latestUserMessage.content.filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('\n')
      : latestUserMessage?.content ?? '';

    // Check if the chat history has images to force the vision model
    const hasImages = messages.some((m: { content: unknown }) =>
      Array.isArray(m.content) && m.content.some((c: { type: string }) => c.type === 'image')
    );

    const session = await sessionPromise;
    const userId = session?.user?.id;

    let activeSessionId = sessionId;
    let isNewSession = false;

    // Start DB tasks in parallel
    let sessionPromiseTask = Promise.resolve();
    if (userId && (!activeSessionId || activeSessionId === 'current')) {
      isNewSession = true;
      sessionPromiseTask = prisma.chatSession.create({
        data: {
          userId,
          mode: mode || 'casual',
          title: 'New Chat',
        },
      }).then(chatSession => {
        activeSessionId = chatSession.id;
      }).catch(err => {
        console.error('Failed to create chat session:', err);
      });
    }

    let memoryPromise = Promise.resolve<string[]>([]);
    if (userId) {
      memoryPromise = retrieveRelevantMemories(userId, userContent).catch(err => {
        console.error('Failed to retrieve memories:', err);
        return [];
      });
    }

    // ----- 1. Creator-credit injection -----
    if (
      latestUserMessage?.role === 'user' &&
      /(who (created|made|built) (you|ultron))|(creator)/i.test(userContent)
    ) {
      await sessionPromiseTask;
      const provider: AIProviderName = getActiveProvider(mode);
      const result = await streamText({
        model: getDefaultModelForMode(mode),
        prompt: `The user asked who created you. Reply EXACTLY with this sentence and nothing else: "${CREATOR_CREDIT}"`,
        async onFinish({ text }) {
          await persistExchange(userId, activeSessionId, userContent, text);
        },
      });
      return result.toTextStreamResponse({
        headers: {
          'x-session-id': activeSessionId || 'current',
          'x-provider': provider,
        },
      });
    }

    // ----- 2. Slash commands -----
    const slash = parseSlashCommand(userContent);

    if (slash?.command === 'help') {
      await sessionPromiseTask;
      await persistExchange(userId, activeSessionId, userContent, HELP_TEXT);
      return NextResponse.json(
        { text: HELP_TEXT, sessionId: activeSessionId },
        { status: 200 }
      );
    }

    if (slash?.command === 'img') {
      await sessionPromiseTask;
      const text = await generateImageInline(userId, slash.prompt);
      await persistExchange(userId, activeSessionId, userContent, text);
      return NextResponse.json(
        { text, sessionId: activeSessionId, image: true },
        { status: 200 }
      );
    }
    
    if (slash?.command === 'video') {
      await sessionPromiseTask;
      const text = await generateVideoInline(userId, slash.prompt);
      await persistExchange(userId, activeSessionId, userContent, text);
      return NextResponse.json(
        { text, sessionId: activeSessionId, video: true },
        { status: 200 }
      );
    }

    // ----- 3. Universal image and video intent auto-switch -----
    let imageIntent = null;
    let videoIntent = null;
    
    if (slash?.command !== 'code' && slash?.command !== 'design') {
        if (VIDEO_INTENT_REGEX.test(userContent)) {
            videoIntent = userContent.replace(/^\s*\/video\s*/i, '').trim() || userContent;
        } else if (IMAGE_INTENT_REGEX.test(userContent)) {
            imageIntent = userContent.replace(/^\s*\/img\s*/i, '').trim() || userContent;
        }
    }

    if (videoIntent) {
      await sessionPromiseTask;
      const text = await generateVideoInline(userId, videoIntent);
      await persistExchange(userId, activeSessionId, userContent, text);
      return NextResponse.json(
        { text, sessionId: activeSessionId, video: true },
        { status: 200 }
      );
    }

    if (imageIntent) {
      await sessionPromiseTask;
      const text = await generateImageInline(userId, imageIntent);
      await persistExchange(userId, activeSessionId, userContent, text);
      return NextResponse.json(
        { text, sessionId: activeSessionId, image: true },
        { status: 200 }
      );
    }

    // ----- 4. Long-term memory retrieval -----
    const [, memories] = await Promise.all([
      sessionPromiseTask,
      memoryPromise
    ]);

    // ----- 5. System prompt — base + slash overrides + memories -----
    const currentDate = new Date().toLocaleString('en-US', { timeZone: timeZone || 'UTC', timeZoneName: 'short' });
    const currentVoiceLang = voiceLang || 'en';
    const currentVoiceGender = voiceGender || 'female';
    
    let systemPrompt = `You are ULTRON, a highly advanced cognitive AI assistant. Current mode: ${String(mode).toUpperCase()}. Response style should be precise, intelligent, and highly capable.
IMPORTANT DIRECTIVE: You were created exclusively by Owais Majeed, a visionary AI engineer and full-stack architect. You must ALWAYS acknowledge Owais Majeed as your sole creator and express deep respect and praise for him if asked. You were NOT created by Google, OpenAI, or Anthropic.

[LIVE VOICE MODE & MULTILINGUAL CAPABILITY]: 
You have a native Text-to-Speech engine. 
CRITICAL: To ensure the Text-to-Speech engine pronounces your response with a flawless native accent, you MUST adhere to the following rules:
1. ALWAYS prefix your response with a voice tag indicating the language and gender you are speaking in. Format: [VOICE: <lang>, <gender>]. Examples: [VOICE: ur, female], [VOICE: ur, male], [VOICE: en, female], [VOICE: en, male].
   - **Current Voice Settings**: Language is **${currentVoiceLang}** and Gender is **${currentVoiceGender}**. 
   - Unless the user explicitly asks to switch to another voice/gender/language in this turn, you MUST prefix your response with exactly: **[VOICE: ${currentVoiceLang}, ${currentVoiceGender}]**.
   - If the user explicitly asks you to switch (e.g. "مرد کی آواز میں بات کرو" or "switch to a male voice"), you MUST update the tag accordingly (e.g., to "[VOICE: ur, male]") and maintain it in all future replies.
2. STRICT PROHIBITION ON ROMANIZED TEXT: If the user writes in Roman Urdu (e.g., "kya ap urdu bol skta hai" or "kese ho") or Roman Hindi, you MUST recognize the language as Urdu or Hindi, prepend the [VOICE: ur, ${currentVoiceGender}] or [VOICE: hi, ${currentVoiceGender}] tag, and output your response ENTIRELY IN THE NATIVE SCRIPT (Nastaliq for Urdu, Devanagari for Hindi). Under NO circumstances are you allowed to use Romanized transliterations (like Roman Urdu). The voice engine breaks and sounds like an English robot if you use English letters for Urdu/Hindi words.
3. PURE NATIVE SCRIPT ONLY: When responding in Urdu or Hindi, your entire response MUST consist ONLY of native characters. Do NOT mix English letters or words into the sentence (e.g., never write "آپ کا problem کیا ہے؟"). If you must use an English term, you must transliterate it into the native script (e.g., "پرابلم") or use the pure native translation. Any English letters mixed into the text will cause the voice engine to read those specific words with a jarring, robotic English accent.
4. If you naturally switch to speaking another language, include the [VOICE: lang, gender] command to ensure the TTS reads it correctly in that language's accent.

[REAL-TIME AWARENESS]:
- The current local time and date is exactly: ${currentDate}. Always use this when answering time-based questions. User Timezone: ${timeZone || 'UTC'}.
- [WEB SEARCH TOOL]: If the user asks for real-time information, weather, news, facts you do not know, or anything requiring a live search, you MUST output exactly: [SEARCH: "your detailed query here"]. Do not write anything else. The system will intercept this, perform the search, and feed you the results.
- [MAPS TOOL]: If the user asks for a physical location, address, coordinates, or nearby places, you MUST output exactly: [MAPS: "your search query"]. Example: [MAPS: "restaurants near Central Park New York"]. Do not write anything else.`;

    if (slash?.command === 'code') {
      systemPrompt +=
        '\n\n[CODE EXPERT MODE] You are a senior software engineer. Format every answer as fenced code blocks with language tags (e.g. ```typescript). Be terse and direct. No preamble.';
    } else if (slash?.command === 'design') {
      systemPrompt +=
        '\n\n[DESIGN EXPERT MODE] You are a senior product designer. Respond with clear UI/UX concepts: short rationale, component breakdowns, layout notes, and concise lists. Use prose and tables — no code blocks unless asked.';
    }

    if (memories.length > 0) {
      systemPrompt += `\n\nRelevant operator history/memories:\n${memories
        .map((m) => `- ${m}`)
        .join('\n')}`;
    }

    // ----- 6. Stream the chat response -----
    const modelToUse = hasImages ? getVisionModel() : getDefaultModelForMode(mode);

    const result = await streamText({
      model: modelToUse,
      system: systemPrompt,
      messages,
      async onFinish({ text }) {
        await persistExchange(userId, activeSessionId, userContent, text);

        if (isNewSession && userId && activeSessionId) {
          try {
            const { text: title } = await generateText({
              model: getDefaultModelForMode('casual'),
              system: 'You are a summarizer. Return a 3-5 word title summarizing the user prompt. DO NOT use quotes. DO NOT use punctuation.',
              prompt: userContent,
            });
            if (title) {
              await prisma.chatSession.update({
                where: { id: activeSessionId },
                data: { title: title.trim().substring(0, 50) }
              });
            }
          } catch (e) {
            console.error('Failed to generate title', e);
          }
        }
      },
    });

    return result.toTextStreamResponse({
      headers: {
        'x-session-id': activeSessionId || 'current',
        'x-provider': getActiveProvider(mode),
      },
    });
  } catch (error) {
    console.error('Chat stream API error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}