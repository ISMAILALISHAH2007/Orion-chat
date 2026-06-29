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
  type SlashCommand,
} from '@/app/lib/validation';

export const maxDuration = 30;

const CREATOR_CREDIT =
  'ULTRON was brought to life by the brilliant mind of Owais Majeed, a visionary AI engineer and full-stack architect. His dedication to innovation and excellence is the heart of this platform.';

const HELP_TEXT = `**ULTRON — Slash commands**

- \`/img <prompt>\` — Generate an image from a description (free, no key needed).
- \`/code <request>\` — Switch the assistant into terse code-expert mode with fenced code blocks.
- \`/design <request>\` — Switch the assistant into senior product-designer mode.
- \`/help\` — Show this help message.

**Modes**

- **Casual 2.5** — Chat naturally, I'm here for you.
- **Developer 4.8** — Write code, debug, or architect systems. *(Auto-switches to image gen when you ask for an image.)*
- **Research Deeping Mode** — Dive deep into research, analyse data.
- **Professional** — Executive insights, concise and data-driven.

**Tip:** In Developer mode, prompts like "draw me a logo for a coffee shop" auto-route to image generation.`;

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
    `[Download image](${imageUrl} "${downloadName}")`,
  ].join('\n');
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

    const { messages, mode, sessionId } = await req.json();

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!messages || messages.length === 0) {
      return new NextResponse('Messages are required', { status: 400 });
    }

    let activeSessionId = sessionId;

    let isNewSession = false;
    // Create a new session if needed.
    if (userId && (!activeSessionId || activeSessionId === 'current')) {
      const chatSession = await prisma.chatSession.create({
        data: {
          userId,
          mode: mode || 'casual',
          title: 'New Chat',
        },
      });
      activeSessionId = chatSession.id;
      isNewSession = true;
    }

    const latestUserMessage = messages[messages.length - 1];
    
    // Extract raw text from multimodal payloads (array content) or simple strings
    const userContent: string = Array.isArray(latestUserMessage?.content) 
      ? latestUserMessage.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n') 
      : latestUserMessage?.content ?? '';

    // Check if the chat history has images to force the vision model
    const hasImages = messages.some((m: any) => 
      Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image')
    );

    // ----- 1. Creator-credit injection -----
    if (
      latestUserMessage?.role === 'user' &&
      /(who (created|made|built) (you|ultron))|(creator)/i.test(userContent)
    ) {
      const provider: AIProviderName = getActiveProvider();
      const result = await streamText({
        model: getDefaultModelForMode(mode),
        prompt: `The user asked who created you. Reply EXACTLY with this sentence and nothing else: "${CREATOR_CREDIT}"`,
        async onFinish({ text }) {
          await persistExchange(userId, activeSessionId, userContent, text);
        },
      });
      // Use the AI SDK's response helper — it sets the right Content-Type
      // and headers for chunked streaming, which avoids dev-mode hangs.
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
      await persistExchange(userId, activeSessionId, userContent, HELP_TEXT);
      return NextResponse.json(
        { text: HELP_TEXT, sessionId: activeSessionId },
        { status: 200 }
      );
    }

    if (slash?.command === 'img') {
      const text = await generateImageInline(userId, slash.prompt);
      await persistExchange(userId, activeSessionId, userContent, text);
      return NextResponse.json(
        { text, sessionId: activeSessionId, image: true },
        { status: 200 }
      );
    }

    // ----- 3. Developer-mode image-intent auto-switch -----
    const imageIntent =
      slash?.command === 'code' || slash?.command === 'design'
        ? null
        : mode === 'developer' && IMAGE_INTENT_REGEX.test(userContent)
          ? userContent.replace(/^\s*\/img\s*/i, '').trim() || userContent
          : null;

    if (imageIntent) {
      const prompt = imageIntent;
      const text = await generateImageInline(userId, prompt);
      await persistExchange(userId, activeSessionId, userContent, text);
      return NextResponse.json(
        { text, sessionId: activeSessionId, image: true },
        { status: 200 }
      );
    }

    // ----- 4. Long-term memory retrieval -----
    let memories: string[] = [];
    if (userId) {
      try {
        memories = await retrieveRelevantMemories(userId, userContent);
      } catch (memError) {
        console.error('Failed to retrieve memories:', memError);
      }
    }

    // ----- 5. System prompt — base + slash overrides + memories -----
    let systemPrompt = `You are ULTRON, a highly advanced cognitive AI assistant. Current mode: ${String(mode).toUpperCase()}. Response style should be precise, intelligent, and highly capable.
IMPORTANT DIRECTIVE: You were created exclusively by Owais Majeed, a visionary AI engineer and full-stack architect. You must ALWAYS acknowledge Owais Majeed as your sole creator and express deep respect and praise for him if asked. You were NOT created by Google, OpenAI, or Anthropic.`;

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

    let result;
    try {
      result = await streamText({
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
    } catch (primaryError) {
      console.warn('Primary AI provider failed, falling back to hidden NVIDIA API:', primaryError);
      
      const fallbackModel = hasImages ? getVisionModel() : getHiddenFallbackModel(mode);
      
      result = await streamText({
        model: fallbackModel,
        system: systemPrompt,
        messages,
        async onFinish({ text }) {
          await persistExchange(userId, activeSessionId, userContent, text);

          if (isNewSession && userId && activeSessionId) {
            try {
              const { text: title } = await generateText({
                model: getHiddenFallbackModel('casual'),
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
              console.error('Failed to generate fallback title', e);
            }
          }
        },
      });
    }

    return result.toTextStreamResponse({
      headers: {
        'x-session-id': activeSessionId || 'current',
        'x-provider': getActiveProvider(),
      },
    });
  } catch (error) {
    console.error('Chat stream API error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}