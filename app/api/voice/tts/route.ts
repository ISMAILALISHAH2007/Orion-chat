import { NextResponse } from 'next/server';
import { EdgeTTS } from 'node-edge-tts';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Map generic languages and genders to Edge TTS voices
const VOICE_MAP: Record<string, { male: string, female: string }> = {
  'en': { female: 'en-US-JennyNeural', male: 'en-US-AndrewNeural' },
  'en-gb': { female: 'en-GB-SoniaNeural', male: 'en-GB-RyanNeural' },
  'es': { female: 'es-ES-ElviraNeural', male: 'es-ES-AlvaroNeural' },
  'fr': { female: 'fr-FR-DeniseNeural', male: 'fr-FR-HenriNeural' },
  'de': { female: 'de-DE-KatjaNeural', male: 'de-DE-ConradNeural' },
  'it': { female: 'it-IT-ElsaNeural', male: 'it-IT-DiegoNeural' },
  'hi': { female: 'hi-IN-SwaraNeural', male: 'hi-IN-MadhurNeural' },
  'ur': { female: 'ur-PK-UzmaNeural', male: 'ur-PK-AsadNeural' },
  'ar': { female: 'ar-SA-ZariyahNeural', male: 'ar-SA-HamedNeural' },
  'zh-cn': { female: 'zh-CN-XiaoxiaoNeural', male: 'zh-CN-YunxiNeural' },
  'ja': { female: 'ja-JP-NanamiNeural', male: 'ja-JP-KeitaNeural' },
};

export async function POST(req: Request) {
  const body = await req.json();
  const text = body.text;
  let lang = (body.lang || 'en').toLowerCase();
  const gender = (body.gender || 'female').toLowerCase();

  if (!text) {
    return new NextResponse('Missing text', { status: 400 });
  }

  // Auto-detect language based on Unicode blocks for perfect native accents
  if (/[\u0600-\u06FF]/.test(text)) {
    lang = 'ur'; // Arabic/Urdu block
  } else if (/[\u0900-\u097F]/.test(text)) {
    lang = 'hi'; // Devanagari block
  }

  const baseLang = lang.split('-')[0];
  const voiceSet = VOICE_MAP[lang] || VOICE_MAP[baseLang] || VOICE_MAP['en'];
  const voice = gender === 'male' ? voiceSet.male : voiceSet.female;

  try {
    // Inject slight pauses for punctuation to mimic human breathing
    const naturalText = text
      .replace(/([.!?])\s*/g, '$1, ')
      .replace(/([۔؟])\s*/g, '$1، ');
    
    const tts = new EdgeTTS({ voice });
    const tmpPath = path.join(os.tmpdir(), `edge-tts-${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`);
    
    await tts.ttsPromise(naturalText, tmpPath);
    
    const audioBuffer = fs.readFileSync(tmpPath);
    fs.unlinkSync(tmpPath); // Clean up immediately

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Edge TTS Error:', error);
    // Fallback to Google Translate TTS
    const url = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${lang}&q=${encodeURIComponent(text)}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) return new NextResponse('Internal Server Error', { status: 500 });
    const arrayBuffer = await response.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  }
}
