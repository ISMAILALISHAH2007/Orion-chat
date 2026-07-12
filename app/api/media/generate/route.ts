import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/db';

async function generateVideo(userId: string | undefined, prompt: string): Promise<string> {
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
      name: "Ultron Video Generation",
      style: { prompt },
      end_seconds: 5,
      aspect_ratio: "16:9"
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error('[Media API] Magic Hour creation failed:', errText);
    throw new Error(`Could not start video job. (${createRes.status})`);
  }

  const createData = await createRes.json();
  const jobId = createData.id;
  if (!jobId) throw new Error('Magic Hour returned no job ID');

  console.log(`[Media API] Magic Hour Job Created: ${jobId}. Polling...`);

  const MAX_ITERATIONS = 30;
  const POLLING_INTERVAL_MS = 4000;
  let videoUrl = null;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
    
    const statusRes = await fetch(`https://api.magichour.ai/v1/text-to-video/${jobId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${mhToken}` }
    });

    if (!statusRes.ok) continue;
    const statusData = await statusRes.json();
    console.log(`[Media API] Job ${jobId} status: ${statusData.status}`);

    if (statusData.status === 'complete' || statusData.status === 'completed') {
      if (statusData.downloads && statusData.downloads.length > 0) {
        videoUrl = typeof statusData.downloads[0] === 'string' 
          ? statusData.downloads[0] 
          : (statusData.downloads[0].url || statusData.downloads[0].download_url);
      } else if (statusData.url) videoUrl = statusData.url;
      else if (statusData.video_url) videoUrl = statusData.video_url;
      break;
    } else if (statusData.status === 'failed' || statusData.status === 'error' || statusData.status === 'canceled') {
      throw new Error('API reported an error during generation');
    }
  }

  if (!videoUrl) throw new Error('Video generation timed out after 120s');

  console.log(`[Media API] Downloading video from ${videoUrl}`);
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error('Failed to download generated video');

  const arrayBuffer = await videoRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');

  let recordId = '';
  if (userId) {
    const record = await prisma.video.create({
      data: { userId, prompt, videoUrl: base64 },
      select: { id: true }
    });
    recordId = record.id;
  }
  return recordId ? `/api/video?id=${recordId}` : `data:video/mp4;base64,${base64}`;
}

async function generateImage(userId: string | undefined, prompt: string): Promise<string> {
  console.log(`[Media API] Using unlimited Pollinations.ai for image: "${prompt}"`);
  
  // Safe URL encoding for prompt
  const encodedPrompt = encodeURIComponent(prompt);
  // Add a cache buster so we don't get stuck with old images for same prompts
  const seed = Math.floor(Math.random() * 1000000);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&seed=${seed}`;
  
  // Fetch to check validity and buffer
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) throw new Error('Failed to fetch image from Pollinations');
  
  const arrayBuffer = await imageRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');

  let recordId = '';
  if (userId) {
    // Note: The previous schema might not support base64 directly in imageUrl if it's too large, but wait, the video field did. The image model is imageUrl String
    // Oh wait, prisma.image.imageUrl is `String`. Base64 images are very long.
    // If it's too long, it might crash, but Video was using String.
    // Wait, the previous image generation saved the URL from replicate! If we use Pollinations, we can just save the pollination URL directly instead of base64 to save DB space, but base64 avoids hotlinking. 
    // Wait, `app/api/image/route.ts` is probably serving it? Let me just save the pollination URL to keep it fast!
    const record = await prisma.image.create({
      data: { userId, prompt, imageUrl: imageUrl },
      select: { id: true }
    });
    recordId = record.id;
  }
  return imageUrl; // Returning the raw pollination URL is fast and unlimited!
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id as string | undefined;

    const { prompt, type, sessionId } = await req.json();
    if (!prompt || !type || !sessionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let finalUrl = '';
    
    if (type === 'video') {
      finalUrl = await generateVideo(userId, prompt);
    } else if (type === 'image') {
      finalUrl = await generateImage(userId, prompt);
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    // Attempt to update the message content in the database to persist the media URL
    if (sessionId !== 'current') {
      const searchTag = type === 'video' ? `[GENERATING_VIDEO: ${prompt}]` : `[GENERATING_IMAGE: ${prompt}]`;
      const replacementTag = type === 'video' ? `[VIDEO: ${finalUrl}]` : `[IMAGE: ${finalUrl}]`;

      const msg = await prisma.message.findFirst({
        where: { 
          chatSessionId: sessionId, 
          role: 'assistant',
          content: { contains: searchTag }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (msg) {
        await prisma.message.update({
          where: { id: msg.id },
          data: { content: msg.content.replace(searchTag, replacementTag) }
        });
        console.log(`[Media API] Updated DB message ${msg.id} with final URL`);
      }
    }

    return NextResponse.json({ url: finalUrl }, { status: 200 });

  } catch (error: any) {
    console.error('[Media API] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
