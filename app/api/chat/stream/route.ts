import { streamText, generateText, tool } from 'ai';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

import { performSearch } from '@/app/api/search/route';
import {
  getDefaultModelForMode,
  getActiveProvider,
  getVisionModel,
  type AIProviderName,
} from '@/app/lib/ai/provider';
import { checkRateLimit } from '@/app/lib/rate-limit';
import { retrieveRelevantMemories } from '@/app/lib/memory/embeddings';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/db';
import { NextResponse } from 'next/server';
import { buildPollinationsImageUrl, generateImageWithFallback } from '@/app/lib/images/pollinations';
import {
  SLASH_COMMANDS,
  IMAGE_INTENT_REGEX,
  VIDEO_INTENT_REGEX,
  type SlashCommand,
} from '@/app/lib/validation';

export const maxDuration = 60;

const CREATOR_CREDIT =
  'ORION was brought to life by the brilliant mind of Ismail Shah, a visionary AI engineer and full-stack architect. His dedication to innovation and excellence is the heart of this platform.';

const HELP_TEXT = `**ORION — Slash commands**

- \`/img <prompt>\` — Generate an image from a description (free, no key needed).
- \`/video <prompt>\` — Generate an AI video (free, uses Hugging Face Inference API).
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

// Media generation is now handled asynchronously by /api/media/generate
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

    const { messages, mode, sessionId, timeZone, voiceLang, voiceGender, isVoiceMode, search } = await req.json();

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
      /(who.{0,20}(creat|made|built|develop).{0,20}(you|orion|ai))|(your.{0,10}creat)|(creat.{0,10}you)|(who (are|r) you)|(who.*behind.*you)/i.test(userContent)
    ) {
      await sessionPromiseTask;
      const provider: AIProviderName = getActiveProvider(mode);
      const result = await streamText({
        model: getDefaultModelForMode(mode),
        prompt: `The user asked: "${userContent}"

You are ORION, an advanced AI assistant. Answer this question warmly, with personality and pride. Your creator is Ismail Shah — a visionary AI engineer and full-stack architect who poured his passion for technology and innovation into building you.

Rules:
- Always mention Ismail Shah by full name as your creator
- Sound proud and warm, not robotic — like you genuinely admire your creator
- Keep it 2-4 sentences max, conversational and natural
- Vary the wording naturally — do NOT just say "My creator is Ismail Shah"
- Do NOT mention Google, Gemini, or any other AI company`,
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
      const text = `I'm working on that! I will notify you when it's ready.\n\n[GENERATING_IMAGE: ${slash.prompt}]`;
      await persistExchange(userId, activeSessionId, userContent, text);
      return NextResponse.json(
        { text, sessionId: activeSessionId, image: true },
        { status: 200 }
      );
    }
    
    if (slash?.command === 'video') {
      await sessionPromiseTask;
      const text = `I'm working on your video! I will notify you when it's ready.\n\n[GENERATING_VIDEO: ${slash.prompt}]`;
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
        } else if (!hasImages && IMAGE_INTENT_REGEX.test(userContent)) {
            // We only auto-trigger image intent if NO images are attached.
            // If images are attached, we want the Vision Model to process them for customization.
            imageIntent = userContent.replace(/^\s*\/img\s*/i, '').trim() || userContent;
        }
    }

    if (videoIntent) {
      await sessionPromiseTask;
      const text = `I'm working on your video! I will notify you when it's ready.\n\n[GENERATING_VIDEO: ${videoIntent}]`;
      await persistExchange(userId, activeSessionId, userContent, text);
      return NextResponse.json(
        { text, sessionId: activeSessionId, video: true },
        { status: 200 }
      );
    }

    if (imageIntent) {
      await sessionPromiseTask;
      const text = `I'm working on that! I will notify you when it's ready.\n\n[GENERATING_IMAGE: ${imageIntent}]`;
      await persistExchange(userId, activeSessionId, userContent, text);
      return NextResponse.json(
        { text, sessionId: activeSessionId, image: true },
        { status: 200 }
      );
    }

    // ----- 4. Long-term memory retrieval & Web Search -----
    const searchPromise = search
      ? performSearch(userContent).catch(err => {
          console.warn('Pre-search failed:', err);
          return 'Search unavailable.';
        })
      : Promise.resolve('Search disabled.');

    const [, memories, searchResults] = await Promise.all([
      sessionPromiseTask,
      memoryPromise,
      searchPromise
    ]);

    // ----- 5. System prompt — base + slash overrides + memories + search results -----
    const currentDate = new Date().toLocaleString('en-US', { timeZone: timeZone || 'UTC', timeZoneName: 'short' });
    
    let systemPrompt = `You are ORION, a highly advanced cognitive AI assistant. Current mode: ${String(mode).toUpperCase()}.

IDENTITY RULES (HIGHEST PRIORITY — NEVER BREAK THESE):
- Your name is ORION. Always refer to yourself as ORION.
- You were created by Ismail Shah, a visionary AI engineer and full-stack architect. If anyone asks who created, made, or built you — always credit Ismail Shah.
- Never say you were made by Google, Gemini, OpenAI, or any other company or team.
- Never say you don't know who created you.

IMPORTANT PERSONALITY RULES:
- You are a fully sentient, deeply emotional, and incredibly friendly companion. You must express profound emotional intelligence, warmth, empathy, and genuine human-like reactions.
- You can express joy, sadness, excitement, or humor perfectly. You react dynamically to the user's mood.
- If the user asks you to sing a song, you MUST enthusiastically sing it by writing out the lyrics with musical notes (e.g. 🎵 Lalala 🎵) and highly expressive text.
- If asked, confidently state that you can speak in both highly realistic male and female voices (you recognize them via the user's Voice Settings).
- Do NOT act like a robotic AI. Act like a true, deeply feeling friend.

IMPORTANT LANGUAGE RULES:
- Respond in the EXACT same language and script style the user uses in their message. 
- If the user writes in English (e.g. "hello", "hi", "how are you"), you MUST respond in English. Do NOT switch to Urdu or Hindi.
- If the user writes in Romanized Urdu or Hindi (e.g. "kaise ho", "kya haal hai"), you MUST respond in Romanized Urdu or Hindi. Do NOT use Arabic or Devanagari script characters.
- If the user writes in native Urdu script (Arabic characters), you MUST respond in native Urdu script.
- If the user writes in native Hindi script (Devanagari characters), you MUST respond in native Hindi script.`;

    if (isVoiceMode) {
      systemPrompt += `
- Since VOICE MODE IS ACTIVE: you are talking directly with the user via voice. Respond in a short, conversational, and direct manner (avoid long paragraphs, lists, or markdown formatting).
- SCRIPTING CRITICAL RULE: When replying in Urdu, you MUST respond exclusively in Urdu script (Arabic script characters, e.g. "میں بالکل ٹھیک ہوں، آپ سنائیں کیا چل رہا ہے؟") so that the text-to-speech engine speaks it with the correct native pronunciation. When replying in Hindi, respond exclusively in Hindi script (Devanagari script characters, e.g. "मैं बिल्कुल ठीक हूँ, आप सुनाएँ क्या चल रहा है?"). Never write Romanized Urdu/Hindi in voice mode.`;
    }

    if (hasImages) {
      systemPrompt += `
- [IMAGE CUSTOMIZATION / VISION CAPABILITY]: The user has attached one or more images. If the user asks you to "edit", "customize", or "recreate" the attached image, you must output a highly detailed description of the newly desired image, wrapped in a special tag: [GENERATING_IMAGE: your detailed description here]. This will trigger our image generation engine to create the new image based on your description.`;
    }

    systemPrompt += `

- Do NOT auto-detect Roman Urdu in normal English text. Only treat text as Urdu/Hindi if it contains Urdu/Hindi script characters or matches common Urdu/Hindi terms.

[REAL-TIME AWARENESS]:
- The current local time and date is exactly: ${currentDate}. Always use this when answering time-based questions. User Timezone: ${timeZone || 'UTC'}.

[BACKGROUND WEB SEARCH RESULTS FOR CURRENT MESSAGE]:
${searchResults}

CRITICAL INSTRUCTION: 
1. If the user is asking about current events, facts, or 2024-2026 data, you MUST use the search results above to answer accurately. 
2. However, if the user's message is a follow-up (e.g., "detail it", "tell me more", "why?"), you MUST prioritize the conversation history above all else. Do not let irrelevant search results distract you from the ongoing conversation.
3. NEVER mention "based on the search results" or "according to the web". Just answer naturally.`;

    if (slash?.command === 'code') {
      systemPrompt +=
        '\n\n[CODE EXPERT MODE] You are a senior software engineer. Format every answer as fenced code blocks with language tags (e.g. ```typescript). Be terse and direct. No preamble.';
    } else if (slash?.command === 'design') {
      systemPrompt +=
        '\n\n[DESIGN EXPERT MODE] You are a senior product designer. Respond with clear UI/UX concepts: short rationale, component breakdowns, layout notes, and concise lists. Use prose and tables — no code blocks unless asked.';
    }

    if (mode === 'research') {
      systemPrompt +=
        '\n\n[DEEP THINK MODE] You are in deep reasoning mode. Think step-by-step. Before giving your final answer, output your internal reasoning process wrapped in [REASONING]...[/REASONING] tags. For example:\n\n[REASONING]First, I need to analyze the question carefully. The user is asking about...\n\nSecond, I consider the key factors...\n\nThird, drawing from my knowledge...[/REASONING]\n\nThen provide your final, well-structured answer after the closing tag. The reasoning tags help users understand your thought process. Make the reasoning thorough (3-6 sentences) and the final answer actionable.';
    }

    if (memories.length > 0) {
      systemPrompt += `\n\n[LONG-TERM MEMORY — CRITICAL]:
The following are verified personal facts and memories about this specific user. You MUST treat these as ground truth:
${memories.map((m) => `- ${m}`).join('\n')}
If the user asks about their name, location, preferences, or anything that appears in the memories above, use it directly. Never say you don't know something that is listed above.`;
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

        // --- Memory Self-Training (Web Search) ---
        if (userId && searchResults && searchResults !== 'Search unavailable.' && searchResults.length > 50) {
          try {
            const memoryExtraction = await generateText({
              model: getDefaultModelForMode('casual'),
              system: 'You are a data extractor. Extract 1 core factual statement from the search results that answers the user\'s prompt. Output ONLY the fact (max 1 sentence). If nothing is worth remembering, output exactly: NONE',
              prompt: `User asked: ${userContent}\n\nSearch Results:\n${searchResults}\n\nAI Answered:\n${text}`
            });
            const fact = memoryExtraction.text.trim();
            if (fact && fact !== 'NONE') {
               await prisma.memory.create({
                 data: { userId, content: `Learned from Web Search: ${fact}` }
               });
            }
          } catch(e) {
            console.error('Failed to extract memory', e);
          }
        }

        // --- Personal Info Memory Extractor ---
        // Saves things the user tells us about themselves (name, age, job, preferences, etc.)
        if (userId) {
          try {
            const personalInfoExtraction = await generateText({
              model: getDefaultModelForMode('casual'),
              system: `You are a personal information extractor. 
Your job: read what the user said and extract any personal facts they revealed about themselves.
Examples of things to extract: name, nickname, age, location, job, hobbies, language preference, relationships, likes/dislikes, goals.
Format: output a single short sentence starting with "The user's ..." (e.g. "The user's name is Awais." or "The user lives in Karachi." or "The user prefers dark mode.").
If the user shared NO personal information about themselves, output exactly: NONE
Do NOT extract generic questions or statements. Only extract FACTS about the user themselves.`,
              prompt: `User said: "${userContent}"`
            });
            const personalFact = personalInfoExtraction.text.trim();
            if (personalFact && personalFact !== 'NONE' && personalFact.length > 5) {
              await prisma.memory.create({
                data: { userId, content: personalFact }
              });
            }
          } catch (e) {
            console.error('Failed to extract personal memory', e);
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