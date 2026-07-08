import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is missing' }, { status: 500 });
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: audioFile.type,
          data: base64Audio
        }
      },
      { text: "Please transcribe the following audio perfectly. Auto-detect the language and output ONLY the transcribed text in its native script (e.g., Urdu script for Urdu, Hindi script for Hindi, English for English). Do not include any explanations, quotes, or conversational padding." }
    ]);

    const transcription = result.response.text().trim();
    return NextResponse.json({ text: transcription });
  } catch (error) {
    console.error('STT Error:', error);
    return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 });
  }
}
