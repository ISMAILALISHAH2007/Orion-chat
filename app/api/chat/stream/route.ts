import { streamText, generateText } from 'ai';
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
  'ULTRON was brought to life by the brilliant mind of Owais Majeed, a visionary AI engineer and full-stack architect. His dedication to innovation and excellence is the heart of this platform.';

const HELP_TEXT = `**ULTRON — Slash commands**

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

async function generateImageInline(userId: string | undefined, prompt: string) {
  try {
    // Use the new retry-with-fallback logic
    const result = await generateImageWithFallback(prompt, {
      retryCount: 1,       // 2 attempts per model (fits within 60s maxDuration)
      verifyTimeout: 3000, // 3s per HEAD request (lightweight, 3s is plenty)
    });

    const imageUrl = result.url;
    const modelUsed = result.model;
    const verified = result.verified;

    console.log(`[Image] Generated with ${modelUsed} (verified: ${verified})`);

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
    
    // Always provide a clickable download link, even if verification timed out
    const downloadLink = `[⬇️ Download image](/api/download?url=${encodeURIComponent(imageUrl)}&name=${encodeURIComponent(downloadName)} "${downloadName}")`;
    
    return [
      `![${prompt}](${imageUrl})`,
      ``,
      downloadLink,
    ].join('\n');
  } catch (error) {
    console.error('[Image] Generation failed:', error);
    // Ultimate fallback: return a simple URL without verification
    const fallbackUrl = buildPollinationsImageUrl(prompt);
    return [
      `![${prompt}](${fallbackUrl})`,
      ``,
      `> The image is being generated — it may take a few seconds to appear. ` +
      `[⬇️ Download](${fallbackUrl})`,
    ].join('\n');
  }
}

// Free AI video generation using Hugging Face Inference API
// Multiple model fallbacks for maximum reliability
const VIDEO_MODELS = [
  'cerspense/zeroscope_v2_576w',        // Primary: fast, reliable text-to-video
  'damo-vilab/text-to-video-ms-1.7b',   // Fallback 1: good quality text-to-video
  'Aliemori/Text-to-video',             // Fallback 2: lightweight text-to-video
];

async function generateVideoInline(userId: string | undefined, prompt: string) {
  const hfToken = process.env.HUGGINGFACE_API_KEY || '';
  
  // Try each model in order until one works
  for (let i = 0; i < VIDEO_MODELS.length; i++) {
    const modelId = VIDEO_MODELS[i];
    try {
      console.log(`Trying video model ${i + 1}/${VIDEO_MODELS.length}: ${modelId}`);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000); // 20s per model to allow fallbacks
      
      const res = await fetch(
        `https://api-inference.huggingface.co/models/${modelId}`,
        {
          headers: {
            'Authorization': `Bearer ${hfToken}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify({ inputs: prompt }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`Model ${modelId} failed (${res.status}): ${errText.substring(0, 200)}`);
        
        // If the model is loading (503), wait and retry once
        if (res.status === 503) {
          console.log(`Model ${modelId} is loading, waiting 15s...`);
          await new Promise(resolve => setTimeout(resolve, 15000));
          
          const retryController = new AbortController();
          const retryTimeout = setTimeout(() => retryController.abort(), 20000);
          
          const retryRes = await fetch(
            `https://api-inference.huggingface.co/models/${modelId}`,
            {
              headers: {
                'Authorization': `Bearer ${hfToken}`,
                'Content-Type': 'application/json',
              },
              method: 'POST',
              body: JSON.stringify({ inputs: prompt }),
              signal: retryController.signal,
            }
          );
          clearTimeout(retryTimeout);
          
          if (!retryRes.ok) {
            const retryErr = await retryRes.text();
            console.warn(`Model ${modelId} retry also failed: ${retryErr.substring(0, 200)}`);
            continue; // Try next model
          }
          
          const arrayBuffer = await retryRes.arrayBuffer();
          if (arrayBuffer.byteLength < 100) {
            console.warn(`Model ${modelId} returned empty/small response`);
            continue;
          }
          
          return await saveVideoResult(userId, prompt, arrayBuffer);
        }
        
        continue; // Try next model
      }

      const arrayBuffer = await res.arrayBuffer();
      
      if (arrayBuffer.byteLength < 100) {
        console.warn(`Model ${modelId} returned empty/small response`);
        continue;
      }
      
      return await saveVideoResult(userId, prompt, arrayBuffer);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        console.warn(`Model ${modelId} timed out after 20s`);
      } else {
        console.warn(`Model ${modelId} error:`, err?.message || err);
      }
      continue; // Try next model on any error
    }
  }

  // All models failed
  return `⚠️ **Video Generation Failed**: All video generation models are currently unavailable. This is a free service and models may be loading. Try again in a few minutes, or use a different prompt.`;
}

async function saveVideoResult(userId: string | undefined, prompt: string, arrayBuffer: ArrayBuffer) {
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  
  let record = null;
  if (userId) {
    try {
      record = await prisma.video.create({
        data: { userId, prompt, videoUrl: base64 },
        select: { id: true }
      });
    } catch (e) {
      console.error('Failed to persist video:', e);
    }
  }
  
  const videoUrl = record ? `/api/video?id=${record.id}` : `data:video/mp4;base64,${base64}`;
  const downloadName = (record?.id ?? `ultron-video-${Date.now()}`);
  
  // Build download link: for persisted videos, use API endpoint; for data URIs, just link directly
  const downloadLink = record
    ? `[Download Video](/api/video?id=${record.id}&download=1 "${downloadName}")`
    : `[Download Video](${videoUrl} "${downloadName}")`;
  
  return [
    `[VIDEO: ${videoUrl}]`,
    ``,
    downloadLink
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

    const { messages, mode, sessionId, timeZone, voiceLang, voiceGender, isVoiceMode } = await req.json();

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
    
    let systemPrompt = `You are ULTRON, a highly advanced cognitive AI assistant. Current mode: ${String(mode).toUpperCase()}. Response style should be precise, intelligent, and highly capable.

IMPORTANT LANGUAGE RULES:`;

    if (isVoiceMode) {
      systemPrompt += `
- Since VOICE MODE IS ACTIVE: you are talking directly with the user via voice. Respond in a short, conversational, and direct manner (avoid long paragraphs, lists, or markdown formatting).
- Auto-select the language: if the user speaks Urdu/Hindi, reply in Urdu/Hindi. If they speak English, reply in English.
- SCRIPTING CRITICAL RULE: When replying in Urdu, you MUST respond exclusively in Urdu script (Arabic script characters, e.g. "میں بالکل ٹھیک ہوں، آپ سنائیں کیا چل رہا ہے؟"). When replying in Hindi, respond exclusively in Hindi script (Devanagari script characters, e.g. "मैं बिल्कुल ठीक हूँ, आप सुनाएँ क्या चल रहा है?"). Never write Romanized Urdu/Hindi in voice mode.`;
    } else {
      systemPrompt += `
- Since TEXT CHAT MODE IS ACTIVE: speak in the same language and script style the user uses.
- SCRIPTING CRITICAL RULE: If the user writes in Romanized Urdu or Hindi (e.g. "kya haal hai", "aap kaise hain"), you MUST reply in Romanized Urdu/Hindi (e.g. "Main bilkul theek hoon, aap kaise hain?", "Kuch naya nahi"). Do NOT use Arabic or Devanagari script characters unless they explicitly write in those scripts!`;
    }

    systemPrompt += `
- Do NOT auto-detect Roman Urdu in normal English text. Only treat text as Urdu/Hindi if it contains Urdu/Hindi script characters or matches common Urdu/Hindi terms.
- When the user asks in English, respond in English only. Do not switch to Urdu/Hindi unless they ask in those languages.

[REAL-TIME AWARENESS]:
- The current local time and date is exactly: ${currentDate}. Always use this when answering time-based questions. User Timezone: ${timeZone || 'UTC'}.
- [WEB SEARCH TOOL]: If the user asks for real-time information, weather, news, facts you do not know, or anything requiring a live search, you MUST output exactly: [SEARCH: "your detailed query here"]. Do not write anything else. The system will intercept this, perform the search, and feed you the results.

CRITICAL - AFTER SEARCH RESULTS ARRIVE:
When the SYSTEM SEARCH RESULTS message arrives, you MUST follow these rules EXACTLY:
1. Base your answer ENTIRELY on the provided search results. Do NOT use any of your training data for real-time information.
2. If the search results contain the information, provide a complete, accurate answer citing the relevant details.
3. If the search results are empty or say "unavailable", honestly tell the user you couldn't find current information.
4. NEVER make up data, statistics, names, dates, or facts not present in the search results.
5. Format your answer clearly with bullet points or sections for readability.
6. For weather, news, stock prices, sports scores, and other time-sensitive data: ONLY use the search results.

- [MAPS TOOL]: If the user asks for a physical location, address, coordinates, or nearby places, you MUST output exactly: [MAPS: "your search query"]. Example: [MAPS: "restaurants near Central Park New York"]. Do not write anything else.

CRITICAL - AFTER MAPS RESULTS ARRIVE:
When the SYSTEM MAPS RESULTS message arrives, you MUST follow these rules EXACTLY:
1. Base your location answer ENTIRELY on the provided maps results.
2. If results contain addresses, hours, ratings, or contact info, include them.
3. If no results found, honestly tell the user.`;

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