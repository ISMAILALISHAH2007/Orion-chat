import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

/**
 * Voice route — forwards to the TTS endpoint for text-to-speech.
 * This route validates auth and acts as a proxy.
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

    const { text, lang, gender } = await req.json();
    if (!text) return new NextResponse('Missing text', { status: 400 });

    // Forward to the TTS endpoint with the same request
    const ttsResponse = await fetch(`${req.url.replace('/api/voice', '/api/voice/tts')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang: lang || 'en', gender: gender || 'female' }),
    });

    if (!ttsResponse.ok) {
      throw new Error(`TTS proxy returned ${ttsResponse.status}`);
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Voice proxy error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Voice service unavailable' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
