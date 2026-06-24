import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // STUB: Deepgram STT integration
  return NextResponse.json({ text: 'This is a mocked transcription.' });
}
