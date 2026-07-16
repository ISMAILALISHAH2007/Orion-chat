import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const download = searchParams.get('download');

  if (!id) return new NextResponse('Missing ID', { status: 400 });

  try {
    const video = await prisma.video.findUnique({ where: { id } });
    if (!video || !video.videoUrl) return new NextResponse('Not found', { status: 404 });

    const buffer = Buffer.from(video.videoUrl, 'base64');

    const headers = new Headers();
    headers.set('Content-Type', 'video/mp4');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    
    if (download) {
      headers.set('Content-Disposition', `attachment; filename="orion-video-${id}.mp4"`);
    }

    return new NextResponse(buffer, { headers });
  } catch (error) {
    console.error('Video API Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
