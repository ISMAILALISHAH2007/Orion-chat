import { NextResponse } from 'next/server';
import { EdgeTTS } from 'node-edge-tts';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Edge TTS voice map with high-quality Neural voices
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

// Clean text for natural-sounding TTS output
function cleanTextForTTS(text: string): string {
  return text
    .replace(/\[VOICE:[^\]]+\]/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_#`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Add natural pauses by inserting commas after punctuation for more human-like speech
function addNaturalPauses(text: string): string {
  return text
    .replace(/([.!?])\s*/g, '$1, ')
    .replace(/([۔؟])\s*/g, '$1، ')
    .replace(/,\s*,/g, ','); // Remove duplicate commas
}

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
    lang = 'ur';
  } else if (/[\u0900-\u097F]/.test(text)) {
    lang = 'hi';
  }

  const baseLang = lang.split('-')[0];
  const voiceSet = VOICE_MAP[lang] || VOICE_MAP[baseLang] || VOICE_MAP['en'];
  const voice = gender === 'male' ? voiceSet.male : voiceSet.female;

  try {
    const cleanText = cleanTextForTTS(text);
    if (!cleanText) {
      return new NextResponse('', { status: 200 });
    }

    // Add natural pauses for more human-like speech
    const naturalText = addNaturalPauses(cleanText);

    const tts = new EdgeTTS({ voice });
    const tmpPath = path.join(os.tmpdir(), `edge-tts-${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`);

    await tts.ttsPromise(naturalText, tmpPath);

    const audioBuffer = fs.readFileSync(tmpPath);
    try { fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Edge TTS Error:', error);

    // Fallback to Google Translate TTS with better quality
    try {
      const fallbackText = cleanTextForTTS(text);
      const googleLang = lang === 'ur' ? 'ur-PK' : lang === 'en' ? 'en-US' : lang;
      const url = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${googleLang}&ttsspeed=1.0&q=${encodeURIComponent(fallbackText)}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'audio/mpeg'
        }
      });

      if (!response.ok) throw new Error(`Google TTS returned ${response.status}`);

      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength === 0) throw new Error('Empty audio response');

      return new NextResponse(arrayBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-store, max-age=0',
        },
      });
    } catch (fallbackError) {
      console.error('Google TTS fallback also failed:', fallbackError);
      return new NextResponse(
        JSON.stringify({ error: 'TTS unavailable' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
}
