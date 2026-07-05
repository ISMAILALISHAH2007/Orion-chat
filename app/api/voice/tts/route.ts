import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get('text');
  const lang = searchParams.get('lang') || 'en';

  if (!text) {
    return new NextResponse('Missing text', { status: 400 });
  }

  const url = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${lang}&q=${encodeURIComponent(text)}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      }
    });
    
    if (!response.ok) {
      throw new Error(`TTS fetch failed with status ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('TTS Proxy Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
