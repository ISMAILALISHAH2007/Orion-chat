import { NextResponse } from 'next/server';

export async function POST() {
  // STUB: ElevenLabs TTS integration
  // Should return audio stream or URL
  return NextResponse.json({ url: 'mock_audio_url.mp3' });
}
