import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/db';

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
      name: "Ultron Video Generation",
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
      // Only retry on 5xx server errors
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
  } catch (error: any) {
    console.error('[Media API Polling Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

async function generateImage(userId: string | undefined, prompt: string): Promise<string> {
  console.log(`[Media API] Using unlimited Pollinations.ai for image: "${prompt}"`);
  
  const encodedPrompt = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 1000000);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&seed=${seed}`;
  
  // We don't fetch the arrayBuffer here anymore to prevent Vercel backend timeouts.
  // The browser will load the image directly.

  let recordId = '';
  if (userId) {
    const record = await prisma.image.create({
      data: { userId, prompt, imageUrl: imageUrl },
      select: { id: true }
    });
    recordId = record.id;
  }
  return imageUrl; 
}

async function generateHuggingFaceVideo(prompt: string, userId?: string): Promise<string> {
  const hfToken = process.env.HUGGINGFACE_API_KEY || '';
  if (!hfToken) throw new Error('HUGGINGFACE_API_KEY missing');
  
  console.log(`[Media API] Starting Hugging Face video generation: "${prompt}"`);
  
  // Use a reliable text-to-video model on HF
  const res = await fetch("https://api-inference.huggingface.co/models/damo-vilab/text-to-video-ms-1.7b", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${hfToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ inputs: prompt })
  });

  if (!res.ok) {
     const error = await res.text();
     throw new Error(`Hugging Face API Error: ${error}`);
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

  return videoUrl;
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
      if (process.env.HUGGINGFACE_API_KEY) {
        try {
          const finalUrl = await generateHuggingFaceVideo(prompt, userId);
          
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

          return NextResponse.json({ url: finalUrl }, { status: 200 });
        } catch (e: any) {
          console.error("[Media API] Hugging Face failed, falling back to Magic Hour:", e.message);
          const jobId = await startVideoJob(prompt);
          return NextResponse.json({ jobId }, { status: 200 });
        }
      } else {
        const jobId = await startVideoJob(prompt);
        return NextResponse.json({ jobId }, { status: 200 });
      }
    } else if (type === 'image') {
      const finalUrl = await generateImage(userId, prompt);
      
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
  } catch (error: any) {
    console.error('[Media API] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
