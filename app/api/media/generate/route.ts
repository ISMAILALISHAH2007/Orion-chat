import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/db';
import Replicate from 'replicate';

// List of free Hugging Face text-to-video models to try in order
const HF_VIDEO_MODELS = [
  'https://api-inference.huggingface.co/models/damo-vilab/text-to-video-ms-1.7b',
  'https://api-inference.huggingface.co/models/ali-vilab/text-to-video-ms-1.7b',
  'https://api-inference.huggingface.co/models/THUDM/CogVideoX-2b',
];

/**
 * Generate a video using Replicate (free trial credits available).
 * Uses async predictions with polling.
 */
async function generateReplicateVideo(prompt: string): Promise<string> {
  const token = process.env.REPLICATE_API_KEY || '';
  if (!token) throw new Error('REPLICATE_API_KEY missing');

  console.log(`[Media API] Starting Replicate video generation: "${prompt}"`);

  const replicate = new Replicate({ auth: token });

  // Use a reliable open-source text-to-video model
  // Wan 2.1 is a strong open-source choice with fast inference
  const output = await replicate.run(
    "wavespeedai/wan-2.1-t2v:9de0b9cae97e65c1095934cf0f45b26cd0f7020c66426e354486e36af6f81836",
    {
      input: {
        prompt: prompt,
        num_frames: 16,
        frame_rate: 8,
        num_inference_steps: 25,
      },
    }
  );

  if (!output) throw new Error('Replicate returned no output');

  // Output can be a single URL string or an array of URLs
  const videoUrl = Array.isArray(output) ? output[0] : output;
  if (!videoUrl || typeof videoUrl !== 'string') throw new Error('Replicate returned invalid output');

  console.log(`[Media API] Replicate video ready: ${videoUrl}`);

  // Download and store the video
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error('Failed to download generated video from Replicate');

  const arrayBuffer = await videoRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  return `data:video/mp4;base64,${base64}`;
}

async function startVideoJob(prompt: string): Promise<string> {
  const mhToken = process.env.MAGIC_HOUR_API_KEY || '';
  if (!mhToken) throw new Error('MAGIC_HOUR_API_KEY missing');

  console.log(`[Media API] Starting Magic Hour video generation for prompt: "${prompt}"`);
  
  const createRes = await fetch('https://api.magichour.ai/v1/text-to-video', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${mhToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      name: "Orion Video Generation",
      style: { prompt },
      end_seconds: 5,
      aspect_ratio: "16:9"
    })
  });

  if (!createRes.ok) {
    let errMsg = `Could not start video job. (${createRes.status})`;
    try {
      const errData = await createRes.json();
      if (errData.message) errMsg = errData.message;
    } catch (e) {}
    console.error('[Media API] Magic Hour creation failed:', errMsg);
    throw new Error(errMsg);
  }

  const createData = await createRes.json();
  const jobId = createData.id;
  if (!jobId) throw new Error('Magic Hour returned no job ID');

  console.log(`[Media API] Magic Hour Job Created: ${jobId}. Returning to client for polling.`);
  return jobId;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    const prompt = searchParams.get('prompt') || 'Video';
    if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });

    const mhToken = process.env.MAGIC_HOUR_API_KEY || '';
    if (!mhToken) throw new Error('MAGIC_HOUR_API_KEY missing');

    const statusRes = await fetch(`https://api.magichour.ai/v1/text-to-video/${jobId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${mhToken}` }
    });

    if (!statusRes.ok) {
      if (statusRes.status >= 400 && statusRes.status < 500) {
        return NextResponse.json({ error: `Job not found or invalid (${statusRes.status})` }, { status: 500 });
      }
      return NextResponse.json({ status: 'processing' }, { status: 200 });
    }

    const statusData = await statusRes.json();
    console.log(`[Media API] Polling Job ${jobId} status: ${statusData.status}`);

    if (statusData.status === 'complete' || statusData.status === 'completed') {
      let videoUrl = null;
      if (statusData.downloads && statusData.downloads.length > 0) {
        videoUrl = typeof statusData.downloads[0] === 'string' 
          ? statusData.downloads[0] 
          : (statusData.downloads[0].url || statusData.downloads[0].download_url);
      } else if (statusData.url) videoUrl = statusData.url;
      else if (statusData.video_url) videoUrl = statusData.video_url;

      if (!videoUrl) return NextResponse.json({ error: 'Video completed but no URL found' }, { status: 500 });

      console.log(`[Media API] Downloading video from ${videoUrl}`);
      const videoRes = await fetch(videoUrl);
      if (!videoRes.ok) throw new Error('Failed to download generated video');

      const arrayBuffer = await videoRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');

      const session = await getServerSession(authOptions);
      const userId = session?.user?.id as string | undefined;

      let recordId = '';
      if (userId) {
        const record = await prisma.video.create({
          data: { userId, prompt, videoUrl: base64 },
          select: { id: true }
        });
        recordId = record.id;
      }
      
      const finalUrl = recordId ? `/api/video?id=${recordId}` : `data:video/mp4;base64,${base64}`;

      const sessionId = searchParams.get('sessionId');
      if (sessionId && sessionId !== 'current') {
        const searchTag = `[GENERATING_VIDEO: ${prompt}]`;
        const replacementTag = `[VIDEO: ${finalUrl}]`;

        const msg = await prisma.message.findFirst({
          where: { chatSessionId: sessionId, role: 'assistant', content: { contains: searchTag } },
          orderBy: { createdAt: 'desc' }
        });

        if (msg) {
          await prisma.message.update({
            where: { id: msg.id },
            data: { content: msg.content.replace(searchTag, replacementTag) }
          });
          console.log(`[Media API] Updated DB message ${msg.id} with final video URL`);
        }
      }

      return NextResponse.json({ status: 'complete', url: finalUrl }, { status: 200 });
    } else if (statusData.status === 'failed' || statusData.status === 'error' || statusData.status === 'canceled') {
      return NextResponse.json({ error: 'API reported an error during generation' }, { status: 500 });
    }

    return NextResponse.json({ status: 'processing' }, { status: 200 });
  } catch (error: unknown) {
    console.error('[Media API Polling Error]:', error);
    const errMsg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

async function generateHuggingFaceImage(prompt: string, userId?: string): Promise<string> {
  const hfToken = process.env.HUGGINGFACE_API_KEY || '';
  if (!hfToken) throw new Error('HUGGINGFACE_API_KEY missing');
  
  console.log(`[Media API] Starting Hugging Face image generation: "${prompt}"`);
  
  const truncatedPrompt = prompt.length > 800 ? prompt.substring(0, 800) : prompt;
  
  const res = await fetch("https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${hfToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ inputs: truncatedPrompt })
  });

  if (!res.ok) {
     const error = await res.text();
     throw new Error(`Hugging Face API Error: ${error}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  const imageUrl = `data:image/jpeg;base64,${base64}`;

  if (userId) {
    await prisma.image.create({
      data: { userId, prompt: truncatedPrompt, imageUrl },
      select: { id: true }
    });
  }

  return imageUrl;
}

async function generateImage(userId: string | undefined, prompt: string): Promise<string> {
  console.log(`[Media API] Using unlimited Pollinations.ai for image: "${prompt}"`);
  
  const truncatedPrompt = prompt.length > 600 ? prompt.substring(0, 600) : prompt;
  const encodedPrompt = encodeURIComponent(truncatedPrompt);
  const seed = Math.floor(Math.random() * 1000000);
  const targetUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&seed=${seed}`;
  
  console.log(`[Media API] Fetching image from Pollinations server-side to bypass mobile blockers...`);
  const response = await fetch(targetUrl);
  if (!response.ok) throw new Error(`Pollinations AI failed: ${response.status}`);
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  const imageUrl = `data:image/jpeg;base64,${base64}`;

  if (userId) {
    await prisma.image.create({
      data: { userId, prompt: truncatedPrompt, imageUrl },
      select: { id: true }
    });
  }
  return imageUrl; 
}

/**
 * Try to generate a video using Hugging Face Inference API.
 * Attempts multiple free models with timeout to find one that works.
 */
async function generateHuggingFaceVideo(prompt: string, userId?: string): Promise<string> {
  const hfToken = process.env.HUGGINGFACE_API_KEY || '';
  if (!hfToken) throw new Error('HUGGINGFACE_API_KEY missing');
  
  console.log(`[Media API] Starting Hugging Face video generation for: "${prompt}"`);
  
  let lastError: string = '';
  
  for (const modelUrl of HF_VIDEO_MODELS) {
    try {
      console.log(`[Media API] Trying HF model: ${modelUrl}`);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);
      
      const res = await fetch(modelUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${hfToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: prompt }),
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (!res.ok) {
        const errorText = await res.text();
        lastError = `Model ${modelUrl.split('/').pop()} failed: ${errorText.substring(0, 200)}`;
        console.warn(`[Media API] ${lastError}`);
        continue;
      }

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      const videoUrl = `data:video/mp4;base64,${base64}`;

      if (userId) {
        await prisma.video.create({
          data: { userId, prompt, videoUrl: base64 },
          select: { id: true }
        });
      }

      console.log(`[Media API] Video generated successfully with HF model!`);
      return videoUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = `Model ${modelUrl.split('/').pop()} error: ${msg.substring(0, 200)}`;
      console.warn(`[Media API] ${lastError}`);
    }
  }
  
  throw new Error(`All Hugging Face models failed. Last error: ${lastError}`);
}

/** Save video to DB and update message, then return final URL */
async function saveVideoAndUpdateMessage(
  base64: string, userId: string | undefined, prompt: string, sessionId: string
): Promise<string> {
  let recordId = '';
  if (userId) {
    const record = await prisma.video.create({
      data: { userId, prompt, videoUrl: base64 },
      select: { id: true }
    });
    recordId = record.id;
  }
  
  const finalUrl = recordId ? `/api/video?id=${recordId}` : `data:video/mp4;base64,${base64}`;

  if (sessionId !== 'current') {
    const searchTag = `[GENERATING_VIDEO: ${prompt}]`;
    const replacementTag = `[VIDEO: ${finalUrl}]`;
    const msg = await prisma.message.findFirst({
      where: { chatSessionId: sessionId, role: 'assistant', content: { contains: searchTag } },
      orderBy: { createdAt: 'desc' }
    });
    if (msg) {
      await prisma.message.update({
        where: { id: msg.id },
        data: { content: msg.content.replace(searchTag, replacementTag) }
      });
    }
  }
  
  return finalUrl;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id as string | undefined;

    const { prompt, type, sessionId } = await req.json();
    if (!prompt || !type || !sessionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    if (type === 'video') {
      // Strategy: Try free options first (Replicate → Hugging Face), then paid (Magic Hour)
      
      // 1. Try Replicate (free trial credits for new users)
      if (process.env.REPLICATE_API_KEY) {
        try {
          const base64 = await generateReplicateVideo(prompt);
          const finalUrl = await saveVideoAndUpdateMessage(base64, userId, prompt, sessionId);
          return NextResponse.json({ url: finalUrl }, { status: 200 });
        } catch (repErr) {
          const repMsg = repErr instanceof Error ? repErr.message : String(repErr);
          console.error("[Media API] Replicate failed:", repMsg);
          // Fall through to next option
        }
      }
      
      // 2. Try Hugging Face free models
      if (process.env.HUGGINGFACE_API_KEY) {
        try {
          const base64 = await generateHuggingFaceVideo(prompt, userId);
          const finalUrl = await saveVideoAndUpdateMessage(base64, userId, prompt, sessionId);
          return NextResponse.json({ url: finalUrl }, { status: 200 });
        } catch (hfErr) {
          const hfMsg = hfErr instanceof Error ? hfErr.message : String(hfErr);
          console.error("[Media API] Hugging Face video failed:", hfMsg);
          // Fall through to next option
        }
      }
      
      // 3. Try Magic Hour (paid) as last resort
      if (process.env.MAGIC_HOUR_API_KEY) {
        try {
          const jobId = await startVideoJob(prompt);
          return NextResponse.json({ jobId }, { status: 200 });
        } catch (mhErr) {
          const mhMsg = mhErr instanceof Error ? mhErr.message : String(mhErr);
          console.error("[Media API] Magic Hour failed:", mhMsg);
          
          if (mhMsg.toLowerCase().includes('credit')) {
            return NextResponse.json({ 
              error: 'Video generation needs API credits. All providers failed:\n' +
                '- Replicate: Check your REPLICATE_API_KEY and free trial status\n' +
                '- Hugging Face: Free tier may not support video models\n' +
                '- Magic Hour: Needs credits'
            }, { status: 402 });
          }
          
          return NextResponse.json({ error: `Video generation failed: ${mhMsg}` }, { status: 500 });
        }
      }
      
      // 4. No working API keys configured
      return NextResponse.json({ 
        error: 'Video generation requires an API key. Configure one in your .env:\n' +
          '- REPLICATE_API_KEY (free trial credits available → replicate.com)\n' +
          '- HUGGINGFACE_API_KEY (free tier)\n' +
          '- MAGIC_HOUR_API_KEY (paid, needs credits)'
      }, { status: 500 });
      
    } else if (type === 'image') {
      let finalUrl = '';
      if (process.env.HUGGINGFACE_API_KEY) {
        try {
          finalUrl = await generateHuggingFaceImage(prompt, userId);
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : String(e);
          console.error("[Media API] Hugging Face Image failed, falling back to Pollinations:", errMsg);
          finalUrl = await generateImage(userId, prompt);
        }
      } else {
        finalUrl = await generateImage(userId, prompt);
      }
      if (sessionId !== 'current') {
        const searchTag = `[GENERATING_IMAGE: ${prompt}]`;
        const replacementTag = `[IMAGE: ${finalUrl}]`;

        const msg = await prisma.message.findFirst({
          where: { chatSessionId: sessionId, role: 'assistant', content: { contains: searchTag } },
          orderBy: { createdAt: 'desc' }
        });

        if (msg) {
          await prisma.message.update({
            where: { id: msg.id },
            data: { content: msg.content.replace(searchTag, replacementTag) }
          });
          console.log(`[Media API] Updated DB message ${msg.id} with final image URL`);
        }
      }

      return NextResponse.json({ url: finalUrl }, { status: 200 });
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('[Media API] Error:', error);
    const errMsg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
